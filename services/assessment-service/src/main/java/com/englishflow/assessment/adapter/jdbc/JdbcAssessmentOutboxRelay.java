package com.englishflow.assessment.adapter.jdbc;

import com.englishflow.assessment.port.AssessmentOutboxRelayPort;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Dormant JDBC claim/lease/mark adapter for canonical B10 {@code assessment.item.assessed.v2}
 * rows in the existing V1/V5 outbox table.
 *
 * <p>Admission is the WHERE predicate. It runs before {@code ORDER BY}, {@code LIMIT}, and
 * {@code FOR UPDATE SKIP LOCKED}, so an older non-canonical row cannot occupy a claim slot or
 * be reclaimed. Stored envelope columns are never assigned. Nothing in the application context
 * constructs this type. A permanent failure code on a still-live lease moves that row to
 * {@code DLQ} immediately; every other safe code keeps the attempt bound.
 */
public final class JdbcAssessmentOutboxRelay implements AssessmentOutboxRelayPort {

    /** Registered outbox attempt budget. The fifth claim is the last one that may publish. */
    public static final int MAX_ATTEMPTS = AssessmentOutboxRelayPort.MAX_ATTEMPTS;

    private static final String EVENT_NAME = "assessment.item.assessed.v2";
    private static final String SCHEMA_NAME = "assessment.event.v2";
    private static final String AGGREGATE_TYPE = "assessment_item";
    private static final String UUID_PATTERN =
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
    private static final String REQUEST_PATTERN = "^[A-Za-z][A-Za-z0-9._-]{7,127}$";
    private static final String TRACE_PATTERN = "^[a-f0-9]{32}$";
    private static final String AGGREGATE_ID_PATTERN = "^aitm_[A-Za-z0-9._:-]{8,127}$";
    private static final Pattern SAFE_ERROR_CODE = Pattern.compile("[A-Z][A-Z0-9_]{0,63}");
    private static final String EXPLICIT_FAILURE_MESSAGE = "publish failed";
    private static final String LEASE_EXPIRED = "LEASE_EXPIRED";
    private static final String LEASE_EXPIRED_MESSAGE = "publishing lease expired";
    private static final String ATTEMPTS_EXHAUSTED = "ATTEMPTS_EXHAUSTED";
    private static final String ATTEMPTS_EXHAUSTED_MESSAGE = "attempt budget exhausted";
    /**
     * Case-sensitive permanent-code checks. Each comparison is {@code BINARY ? = BINARY 'CODE'},
     * the same collation fence as {@code locked_by}.
     */
    private static final String PERMANENT_PREDICATE = permanentPredicate();

    /**
     * Case-sensitive canonical envelope. {@code BINARY} keeps the match strict under a
     * case-insensitive schema collation. Version must be the JSON integer 2.
     */
    private static final String ENVELOPE_PREDICATE = """
            event_name = BINARY ?
            AND schema_version = BINARY ?
            AND REGEXP_LIKE(event_id, ?, 'c')
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.eventId')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.eventId')) = BINARY event_id
            AND REGEXP_LIKE(request_id, ?, 'c')
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.requestId')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.requestId')) = BINARY request_id
            AND REGEXP_LIKE(trace_id, ?, 'c')
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.traceId')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.traceId')) = BINARY trace_id
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.eventName')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.eventName')) = BINARY event_name
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.schema')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.schema')) = BINARY schema_version
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.schemaVersion')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.schemaVersion')) = BINARY schema_version
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.version')) = 'INTEGER'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.version')) = '2'
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.aggregateType')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.aggregateType')) = BINARY ?
            AND REGEXP_LIKE(aggregate_id, ?, 'c')
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.aggregateId')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.aggregateId')) = BINARY aggregate_id
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.payload.itemAssessmentId')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.payload.itemAssessmentId')) = BINARY aggregate_id
            AND JSON_TYPE(JSON_EXTRACT(payload_json, '$.dedupeKey')) = 'STRING'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.dedupeKey')) = BINARY dedupe_key
            """.trim();

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final String claimSql;
    private final String markClaimedSql;
    private final String markPublishedSql;
    private final String markFailedSql;
    private final String reclaimSql;

    public JdbcAssessmentOutboxRelay(JdbcTemplate jdbc, TransactionTemplate transactions, String schema) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactions = Objects.requireNonNull(transactions, "transactions is required");
        if (schema == null || !schema.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException("schema is invalid");
        }
        String table = "`" + schema + "`.`assessment_outbox_event`";
        this.claimSql = sql("""
                SELECT event_id, aggregate_id, event_name, schema_version,
                       CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.version')) AS SIGNED) AS event_version,
                       dedupe_key, payload_json, request_id, trace_id, attempt_count
                  FROM __TABLE__
                 WHERE status IN ('PENDING', 'RETRY')
                   AND attempt_count < ?
                   AND available_at <= ?
                   AND (locked_until IS NULL OR locked_until <= ?)
                   AND __ENVELOPE__
                 ORDER BY available_at, created_at
                 LIMIT ?
                 FOR UPDATE SKIP LOCKED
                """, table);
        this.markClaimedSql = sql("""
                UPDATE __TABLE__
                   SET status = 'PUBLISHING', locked_by = ?, locked_until = ?,
                       attempt_count = attempt_count + 1
                 WHERE event_id = ?
                   AND status IN ('PENDING', 'RETRY')
                """, table);
        this.markPublishedSql = sql("""
                UPDATE __TABLE__
                   SET status = 'PUBLISHED', published_at = ?, locked_by = NULL, locked_until = NULL,
                       last_error_code = NULL, last_error_message = NULL
                 WHERE event_id = ?
                   AND status = 'PUBLISHING'
                   AND locked_by = BINARY ?
                   AND locked_until IS NOT NULL
                   AND locked_until > ?
                   AND __ENVELOPE__
                """, table);
        this.markFailedSql = sql("""
                UPDATE __TABLE__
                   SET status = CASE
                           WHEN attempt_count >= ? OR __PERMANENT__ THEN 'DLQ'
                           ELSE 'RETRY'
                       END,
                       available_at = CASE
                           WHEN attempt_count >= ? OR __PERMANENT__ THEN ?
                           ELSE ?
                       END,
                       locked_by = NULL, locked_until = NULL,
                       last_error_code = ?, last_error_message = ?
                 WHERE event_id = ?
                   AND status = 'PUBLISHING'
                   AND locked_by = BINARY ?
                   AND locked_until IS NOT NULL
                   AND locked_until > ?
                   AND __ENVELOPE__
                """, table);
        this.reclaimSql = sql("""
                UPDATE __TABLE__
                   SET status = CASE WHEN attempt_count >= ? THEN 'DLQ' ELSE 'RETRY' END,
                       available_at = ?, locked_by = NULL, locked_until = NULL,
                       last_error_code = CASE WHEN attempt_count >= ? THEN ? ELSE ? END,
                       last_error_message = CASE WHEN attempt_count >= ? THEN ? ELSE ? END
                 WHERE status = 'PUBLISHING'
                   AND locked_until IS NOT NULL
                   AND locked_until <= ?
                   AND __ENVELOPE__
                """, table);
    }

    @Override
    public List<ClaimedEvent> claim(Instant now, int batchSize, Duration lease) {
        Objects.requireNonNull(now, "now is required");
        Objects.requireNonNull(lease, "lease is required");
        if (lease.isZero() || lease.isNegative()) {
            throw new IllegalArgumentException("lease must be positive");
        }
        if (batchSize < 1) {
            throw new IllegalArgumentException("batchSize must be positive");
        }
        Timestamp at = Timestamp.from(now);
        List<ClaimedEvent> claimed = transactions.execute(status -> {
            List<Selected> rows = jdbc.query(claimSql, (resultSet, rowNum) -> selected(resultSet),
                    claimArguments(at, batchSize));
            if (rows.isEmpty()) {
                return List.<ClaimedEvent>of();
            }
            Timestamp lockedUntil = Timestamp.from(now.plus(lease));
            List<ClaimedEvent> updates = new ArrayList<>(rows.size());
            for (Selected row : rows) {
                String token = UUID.randomUUID().toString();
                int updated = jdbc.update(markClaimedSql, token, lockedUntil, row.eventId());
                if (updated != 1) {
                    throw new IllegalStateException("claim did not update the locked row");
                }
                updates.add(row.claimed(token));
            }
            return List.copyOf(updates);
        });
        return claimed == null ? List.of() : claimed;
    }

    @Override
    public boolean markPublished(String eventId, String leaseToken, Instant now) {
        Objects.requireNonNull(eventId, "eventId is required");
        Objects.requireNonNull(leaseToken, "leaseToken is required");
        Objects.requireNonNull(now, "now is required");
        Timestamp at = Timestamp.from(now);
        return jdbc.update(markPublishedSql, appendEnvelope(at, eventId, leaseToken, at)) == 1;
    }

    @Override
    public boolean markFailed(String eventId, String leaseToken, Instant now, Instant availableAt, String errorCode) {
        Objects.requireNonNull(eventId, "eventId is required");
        Objects.requireNonNull(leaseToken, "leaseToken is required");
        Objects.requireNonNull(now, "now is required");
        Objects.requireNonNull(availableAt, "availableAt is required");
        Timestamp at = Timestamp.from(now);
        String code = safeCode(errorCode);
        return jdbc.update(markFailedSql, appendEnvelope(markFailedArguments(
                at, Timestamp.from(availableAt), code, eventId, leaseToken))) == 1;
    }

    /**
     * Two copies of the permanent predicate surround the attempt bound, then the stored code.
     * The predicate length is the registered permanent-code list, so the binds cannot drift from it.
     */
    private static Object[] markFailedArguments(Timestamp at, Timestamp availableAt, String code,
            String eventId, String leaseToken) {
        int codes = AssessmentOutboxRelayPort.PERMANENT_FAILURE_CODES.size();
        Object[] leading = new Object[2 + (codes * 2) + 7];
        int index = 0;
        leading[index++] = MAX_ATTEMPTS;
        for (int nth = 0; nth < codes; nth++) {
            leading[index++] = code;
        }
        leading[index++] = MAX_ATTEMPTS;
        for (int nth = 0; nth < codes; nth++) {
            leading[index++] = code;
        }
        leading[index++] = at;
        leading[index++] = availableAt;
        leading[index++] = code;
        leading[index++] = EXPLICIT_FAILURE_MESSAGE;
        leading[index++] = eventId;
        leading[index++] = leaseToken;
        leading[index++] = at;
        return leading;
    }

    @Override
    public int reclaimExpiredLeases(Instant now) {
        Objects.requireNonNull(now, "now is required");
        Timestamp at = Timestamp.from(now);
        return jdbc.update(reclaimSql, appendEnvelope(
                MAX_ATTEMPTS,
                at,
                MAX_ATTEMPTS,
                ATTEMPTS_EXHAUSTED,
                LEASE_EXPIRED,
                MAX_ATTEMPTS,
                ATTEMPTS_EXHAUSTED_MESSAGE,
                LEASE_EXPIRED_MESSAGE,
                at));
    }

    private static Selected selected(ResultSet resultSet) throws SQLException {
        String eventId = resultSet.getString("event_id");
        String payload = resultSet.getString("payload_json");
        if (eventId == null || payload == null) {
            throw new IllegalStateException("claimed row is missing its identity or envelope");
        }
        return new Selected(
                eventId,
                resultSet.getString("aggregate_id"),
                resultSet.getString("event_name"),
                resultSet.getString("schema_version"),
                resultSet.getInt("event_version"),
                resultSet.getString("dedupe_key"),
                payload,
                resultSet.getString("request_id"),
                resultSet.getString("trace_id"),
                resultSet.getInt("attempt_count") + 1);
    }

    private static String safeCode(String errorCode) {
        if (errorCode != null && SAFE_ERROR_CODE.matcher(errorCode).matches()) {
            return errorCode;
        }
        return "UNCLASSIFIED";
    }

    private static Object[] envelopeArguments() {
        return new Object[] {
                EVENT_NAME,
                SCHEMA_NAME,
                UUID_PATTERN,
                REQUEST_PATTERN,
                TRACE_PATTERN,
                AGGREGATE_TYPE,
                AGGREGATE_ID_PATTERN
        };
    }

    /** Claim binds the envelope before {@code LIMIT}, so the batch size stays last. */
    private static Object[] claimArguments(Timestamp at, int batchSize) {
        Object[] envelope = envelopeArguments();
        Object[] args = new Object[3 + envelope.length + 1];
        args[0] = MAX_ATTEMPTS;
        args[1] = at;
        args[2] = at;
        System.arraycopy(envelope, 0, args, 3, envelope.length);
        args[args.length - 1] = batchSize;
        return args;
    }

    private static Object[] appendEnvelope(Object... leading) {
        Object[] envelope = envelopeArguments();
        Object[] args = new Object[leading.length + envelope.length];
        System.arraycopy(leading, 0, args, 0, leading.length);
        System.arraycopy(envelope, 0, args, leading.length, envelope.length);
        return args;
    }

    private static String permanentPredicate() {
        StringBuilder sql = new StringBuilder();
        for (String code : AssessmentOutboxRelayPort.PERMANENT_FAILURE_CODES) {
            if (!SAFE_ERROR_CODE.matcher(code).matches()) {
                throw new IllegalStateException("permanent failure code is invalid");
            }
            if (sql.length() > 0) {
                sql.append(" OR ");
            }
            sql.append("BINARY ? = BINARY '").append(code).append('\'');
        }
        if (sql.isEmpty()) {
            throw new IllegalStateException("permanent failure code is invalid");
        }
        return sql.toString();
    }

    private static String sql(String template, String table) {
        return template.replace("__TABLE__", table)
                .replace("__ENVELOPE__", ENVELOPE_PREDICATE)
                .replace("__PERMANENT__", PERMANENT_PREDICATE);
    }

    private record Selected(
            String eventId,
            String aggregateId,
            String eventName,
            String schemaVersion,
            int eventVersion,
            String dedupeKey,
            String payloadJson,
            String requestId,
            String traceId,
            int attemptCount) {

        private ClaimedEvent claimed(String leaseToken) {
            return new ClaimedEvent(eventId, aggregateId, eventName, schemaVersion, eventVersion, dedupeKey,
                    payloadJson, requestId, traceId, attemptCount, leaseToken);
        }
    }
}
