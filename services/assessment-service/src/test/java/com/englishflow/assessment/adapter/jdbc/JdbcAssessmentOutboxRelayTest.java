package com.englishflow.assessment.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import javax.sql.DataSource;

import com.englishflow.assessment.port.AssessmentOutboxRelayPort.ClaimedEvent;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real MySQL proof for the dormant assessment outbox relay.
 *
 * <p>The class is opt-in, like the other assessment JDBC tests. A skipped run does not prove the
 * adapter. Enable {@code assessment.relay.jdbc} and supply {@code ASSESSMENT_RELAY_TEST_ADMIN_URL},
 * {@code ASSESSMENT_RELAY_TEST_ADMIN_USER}, and {@code ASSESSMENT_RELAY_TEST_ADMIN_PASSWORD}.
 */
@EnabledIfSystemProperty(named = "assessment.relay.jdbc", matches = "true")
class JdbcAssessmentOutboxRelayTest {

    private static final String EVENT = "assessment.item.assessed.v2";
    private static final String SCHEMA_NAME = "assessment.event.v2";
    private static final String AGGREGATE = "assessment_item";
    private static final String TRACE = "0123456789abcdef0123456789abcdef";
    private static final Duration LEASE = Duration.ofSeconds(30);
    private static final Instant BASE = Instant.parse("2026-11-06T00:00:00Z");
    private static final int MAX_ATTEMPTS = JdbcAssessmentOutboxRelay.MAX_ATTEMPTS;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void staleTokenCannotMarkAReissuedClaim() throws Exception {
        withRelay((jdbc, relay, schema) -> {
            String id = insertCanonical(jdbc, schema, 1, "stale-marker", BASE);
            Stored original = read(jdbc, schema, id);

            ClaimedEvent first = claimOnly(relay, BASE);
            assertEquals(id, first.eventId());
            assertEquals(1, first.attemptCount());
            assertEquals(2, first.eventVersion());
            assertEquals(EVENT, first.eventName());
            assertEquals(SCHEMA_NAME, first.schemaVersion());
            assertNotEquals(id, first.leaseToken());
            assertFalse(first.leaseToken().contains("stale-marker"));
            assertEquals(original.payload(), first.payloadJson());
            assertTrue(relay.claim(BASE.plusSeconds(1), 8, LEASE).isEmpty());

            Instant expiry = BASE.plus(LEASE);
            assertFalse(relay.markPublished(id, first.leaseToken(), expiry));
            assertFalse(relay.markFailed(id, first.leaseToken(), expiry, expiry.plusSeconds(5),
                    "TimeoutException: {\"marker\":\"stale-marker\"}"));
            Stored stillLeased = read(jdbc, schema, id);
            assertEquals("PUBLISHING", stillLeased.status());
            assertEquals(first.leaseToken(), stillLeased.lockedBy());
            assertEquals(1, stillLeased.attemptCount());
            assertNull(stillLeased.errorCode());
            assertEquals(original.payload(), stillLeased.payload());

            assertEquals(1, relay.reclaimExpiredLeases(expiry));
            Stored reclaimed = read(jdbc, schema, id);
            assertEquals("RETRY", reclaimed.status());
            assertEquals(1, reclaimed.attemptCount());
            assertNull(reclaimed.lockedBy());
            assertEquals("LEASE_EXPIRED", reclaimed.errorCode());
            assertEquals("publishing lease expired", reclaimed.errorMessage());
            assertNoPayloadLeak(reclaimed, "stale-marker");
            assertFalse(relay.markPublished(id, first.leaseToken(), expiry.plusSeconds(1)));

            ClaimedEvent second = claimOnly(relay, expiry);
            assertEquals(id, second.eventId());
            assertEquals(2, second.attemptCount());
            assertNotEquals(first.leaseToken(), second.leaseToken());
            Instant during = expiry.plusSeconds(1);
            assertFalse(relay.markPublished(id, first.leaseToken(), during));
            assertFalse(relay.markFailed(id, first.leaseToken(), during, during,
                    "TimeoutException: {\"marker\":\"stale-marker\"}"));
            Stored superseded = read(jdbc, schema, id);
            assertEquals("PUBLISHING", superseded.status());
            assertEquals(second.leaseToken(), superseded.lockedBy());
            assertEquals(2, superseded.attemptCount());
            assertEquals("LEASE_EXPIRED", superseded.errorCode());
            assertEquals(original.payload(), superseded.payload());
            assertEquals(original.requestId(), superseded.requestId());
            assertEquals(original.traceId(), superseded.traceId());

            assertTrue(relay.markPublished(id, second.leaseToken(), during));
            Stored published = read(jdbc, schema, id);
            assertEquals("PUBLISHED", published.status());
            assertEquals(2, published.attemptCount());
            assertNull(published.lockedBy());
            assertNull(published.errorCode());
            assertNull(published.errorMessage());
            assertEquals(original.payload(), published.payload());
            assertEquals(original.requestId(), published.requestId());
            assertEquals(original.traceId(), published.traceId());
            assertEquals(original.eventName(), published.eventName());
            assertEquals(original.dedupeKey(), published.dedupeKey());
            assertEquals(original.aggregateId(), published.aggregateId());
            assertFalse(relay.markPublished(id, second.leaseToken(), during.plusSeconds(1)));
            assertEquals(signature(published), signature(read(jdbc, schema, id)));
        });
    }

    @Test
    void leaseExpiryAndExplicitFailureStayInsideTheAttemptBound() throws Exception {
        withRelay((jdbc, relay, schema) -> {
            explicitFailureReachesDlq(jdbc, relay, schema);
            expiryReachesDlq(jdbc, relay, schema);
            fifthAttemptCanStillPublish(jdbc, relay, schema);
        });
    }

    @Test
    void legacyAndMismatchedRowsStayOutsideTheBatchAndReclaim() throws Exception {
        withRelay((jdbc, relay, schema) -> {
            Instant early = BASE;
            int n = 1;
            List<Draft> rejected = List.of(
                    fault(n++, early, d -> d.eventName = "learning.report.ready.v1"),
                    fault(n++, early, d -> d.eventName = "Assessment.item.assessed.v2"),
                    fault(n++, early, d -> {
                        d.columnSchema = "Assessment.event.v2";
                        d.jsonSchema = "Assessment.event.v2";
                        d.jsonSchemaVersion = "Assessment.event.v2";
                    }),
                    fault(n++, early, d -> d.version = "2"),
                    fault(n++, early, d -> d.version = 1),
                    fault(n++, early, d -> {
                        String upper = "0123456789ABCDEF0123456789ABCDEF";
                        d.columnTraceId = upper;
                        d.jsonTraceId = upper;
                    }),
                    fault(n++, early, d -> d.jsonEventId = UUID.randomUUID().toString()),
                    fault(n++, early, d -> d.jsonRequestId = "req_json_mismatch_01"),
                    fault(n++, early, d -> d.jsonTraceId = "fedcba9876543210fedcba9876543210"),
                    fault(n++, early, d -> d.jsonSchema = "assessment.event.v1"),
                    fault(n++, early, d -> d.jsonSchemaVersion = "assessment.event.v1"),
                    fault(n++, early, d -> d.aggregateType = "Assessment_Item"),
                    fault(n++, early, d -> d.jsonAggregateId = "aitm_other_" + d.suffix),
                    fault(n++, early, d -> d.itemAssessmentId = "aitm_itemx_" + d.suffix),
                    fault(n++, early, d -> d.jsonDedupeKey = "other_" + d.suffix),
                    fault(n++, early, d -> {
                        String bare = "item_" + d.suffix + "xxxx";
                        d.aggregateId = bare;
                        d.jsonAggregateId = bare;
                        d.itemAssessmentId = bare;
                    }),
                    fault(n++, early, d -> {
                        d.columnRequestId = "req";
                        d.jsonRequestId = "req";
                    }),
                    fault(n++, early, d -> d.writeEventId = false),
                    fault(n++, early, d -> {
                        String notUuid = "z".repeat(36);
                        d.columnEventId = notUuid;
                        d.jsonEventId = notUuid;
                    }));
            for (Draft draft : rejected) {
                insert(jdbc, schema, draft);
            }
            Draft weak = fault(n++, early, d -> {
                d.version = "2";
                d.status = "PUBLISHING";
                d.lockedBy = "expired-name-only";
                d.lockedUntil = BASE.minusSeconds(1);
                d.attempts = 2;
            });
            insert(jdbc, schema, weak);
            Draft live = fault(n++, BASE, d -> {
                d.status = "PUBLISHING";
                d.lockedBy = "live-lease-token";
                d.lockedUntil = BASE.plus(Duration.ofHours(2));
                d.attempts = 1;
            });
            insert(jdbc, schema, live);
            Draft published = fault(n++, early, d -> {
                d.status = "PUBLISHED";
                d.attempts = 2;
            });
            insert(jdbc, schema, published);
            Draft dlq = fault(n++, early, d -> {
                d.status = "DLQ";
                d.attempts = 5;
            });
            insert(jdbc, schema, dlq);
            Draft future = new Draft(n++, BASE.plus(Duration.ofHours(3)));
            insert(jdbc, schema, future);
            String legacyId = insertLegacy(jdbc, schema, n++, early);
            Draft pending = new Draft(n++, BASE.plusSeconds(10));
            pending.marker = "admitted-pending";
            insert(jdbc, schema, pending);
            Draft retry = new Draft(n, BASE.plusSeconds(20));
            retry.status = "RETRY";
            retry.attempts = 2;
            retry.marker = "admitted-retry";
            insert(jdbc, schema, retry);

            Instant now = BASE.plusSeconds(20);
            Map<String, Stored> before = snapshot(jdbc, schema);
            assertEquals(0, relay.reclaimExpiredLeases(now));
            assertFalse(relay.markPublished(weak.columnEventId, "expired-name-only", now));
            assertFalse(relay.markFailed(legacyId, "not-a-lease", now, now, "PUBLISH_FAILED"));
            assertUntouched(before, snapshot(jdbc, schema));

            List<ClaimedEvent> first = relay.claim(now, 1, LEASE);
            assertEquals(1, first.size());
            assertEquals(pending.columnEventId, first.get(0).eventId());
            assertEquals(1, first.get(0).attemptCount());
            assertEquals(2, first.get(0).eventVersion());
            assertEquals(EVENT, first.get(0).eventName());

            List<ClaimedEvent> second = relay.claim(now, 50, LEASE);
            assertEquals(List.of(retry.columnEventId), second.stream().map(ClaimedEvent::eventId).toList());
            assertEquals(3, second.get(0).attemptCount());
            assertNotEquals(first.get(0).leaseToken(), second.get(0).leaseToken());
            assertTrue(relay.claim(now, 50, LEASE).isEmpty());
            assertEquals(0, relay.reclaimExpiredLeases(now));

            Map<String, Stored> after = snapshot(jdbc, schema);
            assertUntouched(before, after, pending.columnEventId, retry.columnEventId);
            assertClaimed(before.get(pending.columnEventId), after.get(pending.columnEventId), first.get(0));
            assertClaimed(before.get(retry.columnEventId), after.get(retry.columnEventId), second.get(0));
            Stored weakAfter = after.get(weak.columnEventId);
            assertEquals("PUBLISHING", weakAfter.status());
            assertEquals("expired-name-only", weakAfter.lockedBy());
            assertEquals(2, weakAfter.attemptCount());
            assertEquals("PUBLISHING", after.get(live.columnEventId).status());
            assertEquals("live-lease-token", after.get(live.columnEventId).lockedBy());
            assertEquals("PUBLISHED", after.get(published.columnEventId).status());
            assertEquals(2, after.get(published.columnEventId).attemptCount());
            assertEquals("DLQ", after.get(dlq.columnEventId).status());
            assertEquals(5, after.get(dlq.columnEventId).attemptCount());
            assertEquals("PENDING", after.get(legacyId).status());
            assertEquals(0, after.get(legacyId).attemptCount());
            assertNull(after.get(legacyId).requestId());
            assertNull(after.get(legacyId).traceId());
            assertFalse(after.get(legacyId).payload().contains("\"eventId\""));
        });
    }

    @Test
    void lockedOlderRowIsSkippedAndStaysAtFirstAttempt() throws Exception {
        withRelay((jdbc, relay, schema) -> {
            long boundSeconds = 5;
            Instant now = BASE.plusSeconds(10);
            String older = insertCanonical(jdbc, schema, 1, "older-lock", BASE);
            String newer = insertCanonical(jdbc, schema, 2, "newer-lock", now);
            assertNotEquals(older, newer);
            DataSource dataSource = jdbc.getDataSource();
            CountDownLatch lockAcquired = new CountDownLatch(1);
            CountDownLatch release = new CountDownLatch(1);
            AtomicReference<Connection> held = new AtomicReference<>();
            ExecutorService executor = Executors.newFixedThreadPool(2, task -> {
                Thread thread = new Thread(task, "assessment-outbox-skip-lock");
                thread.setDaemon(true);
                return thread;
            });
            Future<Void> holder = null;
            List<ClaimedEvent> skipped;
            try {
                holder = executor.submit(() -> {
                    Connection connection = dataSource.getConnection();
                    held.set(connection);
                    try {
                        connection.setAutoCommit(false);
                        try (PreparedStatement statement = connection.prepareStatement(
                                "SELECT event_id FROM " + table(schema) + " WHERE event_id = ? FOR UPDATE")) {
                            statement.setString(1, older);
                            try (ResultSet rows = statement.executeQuery()) {
                                assertTrue(rows.next(), "older row lock was not acquired");
                                assertEquals(older, rows.getString(1));
                                assertFalse(rows.next(), "older row lock was not acquired");
                            }
                        }
                        lockAcquired.countDown();
                        release.await(boundSeconds * 2, TimeUnit.SECONDS);
                        return null;
                    } finally {
                        rollbackHeld(held, connection);
                    }
                });
                // Older available_at is the first claim candidate. Claim uses another pool thread.
                assertTrue(lockAcquired.await(boundSeconds, TimeUnit.SECONDS), "older row lock was not acquired");
                Future<List<ClaimedEvent>> claim = executor.submit(() -> relay.claim(now, 1, LEASE));
                skipped = claim.get(boundSeconds, TimeUnit.SECONDS);
            } finally {
                try {
                    Connection connection = held.get();
                    if (connection != null) {
                        rollbackHeld(held, connection);
                    }
                } finally {
                    release.countDown();
                    try {
                        if (holder != null) {
                            holder.get(boundSeconds, TimeUnit.SECONDS);
                        }
                    } finally {
                        executor.shutdownNow();
                        assertTrue(executor.awaitTermination(boundSeconds, TimeUnit.SECONDS),
                                "skip-lock executor did not stop");
                    }
                }
            }
            assertEquals(1, skipped.size());
            assertEquals(newer, skipped.get(0).eventId());
            assertNotEquals(older, skipped.get(0).eventId());
            assertEquals(1, skipped.get(0).attemptCount());
            List<ClaimedEvent> remaining = relay.claim(now, 1, LEASE);
            assertEquals(List.of(older), remaining.stream().map(ClaimedEvent::eventId).toList());
            assertEquals(1, remaining.get(0).attemptCount());
        });
    }

    private static void rollbackHeld(AtomicReference<Connection> held, Connection connection) throws SQLException {
        if (held.compareAndSet(connection, null)) {
            try {
                connection.rollback();
            } finally {
                connection.close();
            }
        }
    }

    private void explicitFailureReachesDlq(JdbcTemplate jdbc, JdbcAssessmentOutboxRelay relay, String schema)
            throws Exception {
        String id = insertCanonical(jdbc, schema, 1, "secret-payload", BASE);
        Instant cursor = BASE;
        for (int attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
            ClaimedEvent claimed = claimOnly(relay, cursor);
            assertEquals(id, claimed.eventId());
            assertEquals(attempt, claimed.attemptCount());
            Instant failedAt = cursor.plusSeconds(1);
            Instant retryAt = failedAt.plusSeconds(5);
            String code = attempt == 1
                    ? "TimeoutException: {\"marker\":\"secret-payload\"}"
                    : "PUBLISH_FAILED";
            assertTrue(relay.markFailed(id, claimed.leaseToken(), failedAt, retryAt, code));
            Stored stored = read(jdbc, schema, id);
            assertEquals("RETRY", stored.status());
            assertEquals(attempt, stored.attemptCount());
            assertEquals(attempt == 1 ? "UNCLASSIFIED" : "PUBLISH_FAILED", stored.errorCode());
            assertEquals("publish failed", stored.errorMessage());
            assertNoPayloadLeak(stored, "secret-payload");
            assertTrue(relay.claim(failedAt, 8, LEASE).isEmpty());
            cursor = retryAt;
        }
        ClaimedEvent last = claimOnly(relay, cursor);
        assertEquals(MAX_ATTEMPTS, last.attemptCount());
        Instant failedAt = cursor.plusSeconds(1);
        assertTrue(relay.markFailed(id, last.leaseToken(), failedAt, failedAt.plusSeconds(30), "PUBLISH_FAILED"));
        Stored dlq = read(jdbc, schema, id);
        assertEquals("DLQ", dlq.status());
        assertEquals(MAX_ATTEMPTS, dlq.attemptCount());
        assertEquals("PUBLISH_FAILED", dlq.errorCode());
        assertEquals("publish failed", dlq.errorMessage());
        assertNoPayloadLeak(dlq, "secret-payload");
        for (int extra = 0; extra < 3; extra++) {
            Instant later = failedAt.plusSeconds(extra + 1L);
            assertTrue(relay.claim(later, 8, LEASE).isEmpty());
            assertEquals(0, relay.reclaimExpiredLeases(later));
            assertFalse(relay.markFailed(id, last.leaseToken(), later, later, "PUBLISH_FAILED"));
            assertFalse(relay.markPublished(id, last.leaseToken(), later));
        }
        Stored still = read(jdbc, schema, id);
        assertEquals(signature(dlq), signature(still));
    }

    private void expiryReachesDlq(JdbcTemplate jdbc, JdbcAssessmentOutboxRelay relay, String schema) throws Exception {
        String id = insertCanonical(jdbc, schema, 41, "expiry-marker", BASE);
        Instant cursor = BASE;
        for (int attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
            ClaimedEvent claimed = claimOnly(relay, cursor);
            assertEquals(id, claimed.eventId());
            assertEquals(attempt, claimed.attemptCount());
            Instant expired = cursor.plus(LEASE);
            assertFalse(relay.markPublished(id, claimed.leaseToken(), expired));
            assertFalse(relay.markFailed(id, claimed.leaseToken(), expired, expired,
                    "TimeoutException: {\"marker\":\"expiry-marker\"}"));
            Stored late = read(jdbc, schema, id);
            assertEquals("PUBLISHING", late.status());
            assertEquals(claimed.leaseToken(), late.lockedBy());
            assertEquals(attempt, late.attemptCount());
            assertEquals(1, relay.reclaimExpiredLeases(expired));
            Stored stored = read(jdbc, schema, id);
            assertEquals("RETRY", stored.status());
            assertEquals(attempt, stored.attemptCount());
            assertNull(stored.lockedBy());
            assertEquals("LEASE_EXPIRED", stored.errorCode());
            assertEquals("publishing lease expired", stored.errorMessage());
            assertNoPayloadLeak(stored, "expiry-marker");
            cursor = expired;
        }
        ClaimedEvent last = claimOnly(relay, cursor);
        assertEquals(MAX_ATTEMPTS, last.attemptCount());
        Instant expired = cursor.plus(LEASE);
        assertFalse(relay.markFailed(id, last.leaseToken(), expired, expired, "PUBLISH_FAILED"));
        assertEquals(1, relay.reclaimExpiredLeases(expired));
        Stored dlq = read(jdbc, schema, id);
        assertEquals("DLQ", dlq.status());
        assertEquals(MAX_ATTEMPTS, dlq.attemptCount());
        assertEquals("ATTEMPTS_EXHAUSTED", dlq.errorCode());
        assertEquals("attempt budget exhausted", dlq.errorMessage());
        assertNoPayloadLeak(dlq, "expiry-marker");
        assertEquals(0, relay.reclaimExpiredLeases(expired.plusSeconds(1)));
        assertTrue(relay.claim(expired.plusSeconds(1), 8, LEASE).isEmpty());
        assertEquals(signature(dlq), signature(read(jdbc, schema, id)));
    }

    private void fifthAttemptCanStillPublish(JdbcTemplate jdbc, JdbcAssessmentOutboxRelay relay, String schema)
            throws Exception {
        String id = insertCanonical(jdbc, schema, 81, "publish-marker", BASE);
        Instant cursor = BASE;
        for (int attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
            ClaimedEvent claimed = claimOnly(relay, cursor);
            assertEquals(id, claimed.eventId());
            Instant expired = cursor.plus(LEASE);
            assertEquals(1, relay.reclaimExpiredLeases(expired));
            cursor = expired;
        }
        ClaimedEvent last = claimOnly(relay, cursor);
        assertEquals(MAX_ATTEMPTS, last.attemptCount());
        Instant during = cursor.plusSeconds(1);
        assertTrue(relay.markPublished(id, last.leaseToken(), during));
        Stored published = read(jdbc, schema, id);
        assertEquals("PUBLISHED", published.status());
        assertEquals(MAX_ATTEMPTS, published.attemptCount());
        assertNull(published.errorCode());
        assertNull(published.errorMessage());
        assertTrue(published.payload().contains("publish-marker"));
        assertFalse(relay.markPublished(id, last.leaseToken(), during.plusSeconds(1)));
        assertTrue(relay.claim(during.plusSeconds(1), 8, LEASE).isEmpty());
    }

    private static void assertClaimed(Stored before, Stored after, ClaimedEvent claimed) {
        assertEquals(before.payload(), after.payload());
        assertEquals(before.payload(), claimed.payloadJson());
        assertEquals(before.requestId(), after.requestId());
        assertEquals(before.requestId(), claimed.requestId());
        assertEquals(before.traceId(), after.traceId());
        assertEquals(before.traceId(), claimed.traceId());
        assertEquals(before.eventName(), after.eventName());
        assertEquals(before.schemaVersion(), after.schemaVersion());
        assertEquals(before.dedupeKey(), after.dedupeKey());
        assertEquals(before.dedupeKey(), claimed.dedupeKey());
        assertEquals(before.aggregateId(), after.aggregateId());
        assertEquals(before.aggregateId(), claimed.aggregateId());
        assertEquals(before.eventId(), after.eventId());
        assertEquals("PUBLISHING", after.status());
        assertEquals(before.attemptCount() + 1, after.attemptCount());
        assertEquals(after.attemptCount(), claimed.attemptCount());
        assertEquals(claimed.leaseToken(), after.lockedBy());
        assertTrue(after.lockedUntil() != null);
    }

    private static void assertNoPayloadLeak(Stored stored, String marker) {
        String code = String.valueOf(stored.errorCode());
        String message = String.valueOf(stored.errorMessage());
        assertFalse(code.contains(marker), code);
        assertFalse(message.contains(marker), message);
        assertFalse(message.contains("{"), message);
        assertFalse(message.contains("Exception"), message);
        assertTrue(stored.payload().contains(marker));
    }

    private static void assertUntouched(Map<String, Stored> before, Map<String, Stored> after, String... changedIds) {
        assertEquals(before.keySet(), after.keySet());
        Set<String> changed = Set.of(changedIds);
        for (String id : before.keySet()) {
            if (!changed.contains(id)) {
                assertEquals(signature(before.get(id)), signature(after.get(id)), id);
            }
        }
    }

    private static ClaimedEvent claimOnly(JdbcAssessmentOutboxRelay relay, Instant now) {
        List<ClaimedEvent> claimed = relay.claim(now, 8, LEASE);
        assertEquals(1, claimed.size(), String.valueOf(claimed));
        return claimed.get(0);
    }

    private String insertCanonical(JdbcTemplate jdbc, String schema, int n, String marker, Instant at)
            throws Exception {
        Draft draft = new Draft(n, at);
        draft.marker = marker;
        insert(jdbc, schema, draft);
        return draft.columnEventId;
    }

    private String insertLegacy(JdbcTemplate jdbc, String schema, int n, Instant at) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("aggregateType", "assessment_attempt");
        body.put("tenantId", "platform");
        body.put("actorId", "prn_learner0000000001");
        body.put("requestId", "req-placement-legacy");
        body.put("traceId", "trace-placement-legacy");
        body.put("version", 1);
        body.put("payload", Map.of("marker", "legacy-marker"));
        String eventId = UUID.randomUUID().toString();
        insertRaw(jdbc, schema, eventId, "attemptlegacy01", "attempt.saved.v1", "assessment.event.v1",
                "legacy_" + n, mapper.writeValueAsString(body), "PENDING", 0, at, null, null, null, null);
        return eventId;
    }

    private void insert(JdbcTemplate jdbc, String schema, Draft draft) throws Exception {
        insertRaw(jdbc, schema, draft.columnEventId, draft.aggregateId, draft.eventName, draft.columnSchema,
                draft.dedupeKey, json(draft), draft.status, draft.attempts, draft.availableAt,
                draft.columnRequestId, draft.columnTraceId, draft.lockedBy, draft.lockedUntil);
    }

    private void insertRaw(JdbcTemplate jdbc, String schema, String eventId, String aggregateId, String eventName,
            String schemaName, String dedupeKey, String payload, String status, int attempts, Instant at,
            String requestId, String traceId, String lockedBy, Instant lockedUntil) {
        String sql = """
                INSERT INTO %s
                    (event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json,
                     status, attempt_count, available_at, created_at, occurred_at, request_id, trace_id,
                     locked_by, locked_until)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.formatted(table(schema));
        jdbc.update(connection -> bindInsert(connection, sql, eventId, aggregateId, eventName, schemaName, dedupeKey,
                payload, status, attempts, at, requestId, traceId, lockedBy, lockedUntil));
    }

    private static PreparedStatement bindInsert(Connection connection, String sql, String eventId, String aggregateId,
            String eventName, String schemaName, String dedupeKey, String payload, String status, int attempts,
            Instant at, String requestId, String traceId, String lockedBy, Instant lockedUntil) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql);
        statement.setString(1, eventId);
        statement.setString(2, aggregateId);
        statement.setString(3, eventName);
        statement.setString(4, schemaName);
        statement.setString(5, dedupeKey);
        statement.setString(6, payload);
        statement.setString(7, status);
        statement.setInt(8, attempts);
        Timestamp stamp = Timestamp.from(at);
        statement.setTimestamp(9, stamp);
        statement.setTimestamp(10, stamp);
        statement.setTimestamp(11, stamp);
        setNullable(statement, 12, requestId);
        setNullable(statement, 13, traceId);
        setNullable(statement, 14, lockedBy);
        if (lockedUntil == null) {
            statement.setNull(15, Types.TIMESTAMP);
        } else {
            statement.setTimestamp(15, Timestamp.from(lockedUntil));
        }
        return statement;
    }

    private static void setNullable(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    private String json(Draft draft) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("itemAssessmentId", draft.itemAssessmentId);
        payload.put("marker", draft.marker);
        Map<String, Object> body = new LinkedHashMap<>();
        if (draft.writeEventId) {
            body.put("eventId", draft.jsonEventId);
        }
        body.put("eventName", draft.eventName);
        body.put("schema", draft.jsonSchema);
        body.put("version", draft.version);
        body.put("aggregateType", draft.aggregateType);
        body.put("aggregateId", draft.jsonAggregateId);
        body.put("actorId", "prn_learner0000000001");
        body.put("tenantId", "platform");
        if (draft.writeRequest) {
            body.put("requestId", draft.jsonRequestId);
        }
        if (draft.writeTrace) {
            body.put("traceId", draft.jsonTraceId);
        }
        body.put("schemaVersion", draft.jsonSchemaVersion);
        body.put("dedupeKey", draft.jsonDedupeKey);
        body.put("payload", payload);
        return mapper.writeValueAsString(body);
    }

    private static Map<String, Stored> snapshot(JdbcTemplate jdbc, String schema) {
        Map<String, Stored> rows = new LinkedHashMap<>();
        for (Stored row : readAll(jdbc, schema)) {
            rows.put(row.eventId(), row);
        }
        return rows;
    }

    private static Stored read(JdbcTemplate jdbc, String schema, String eventId) {
        List<Stored> rows = jdbc.query(selectSql(schema) + " WHERE event_id = ?",
                (resultSet, rowNum) -> mapRow(resultSet), eventId);
        assertEquals(1, rows.size());
        return rows.get(0);
    }

    private static List<Stored> readAll(JdbcTemplate jdbc, String schema) {
        return jdbc.query(selectSql(schema), (resultSet, rowNum) -> mapRow(resultSet));
    }

    private static String selectSql(String schema) {
        return """
                SELECT event_id, status, attempt_count, payload_json, request_id, trace_id, locked_by,
                       locked_until, last_error_code, last_error_message, event_name, schema_version,
                       dedupe_key, aggregate_id, published_at, available_at
                  FROM %s
                """.formatted(table(schema));
    }

    private static Stored mapRow(ResultSet resultSet) throws SQLException {
        return new Stored(
                resultSet.getString("event_id"),
                resultSet.getString("status"),
                resultSet.getInt("attempt_count"),
                resultSet.getString("payload_json"),
                resultSet.getString("request_id"),
                resultSet.getString("trace_id"),
                resultSet.getString("locked_by"),
                resultSet.getTimestamp("locked_until"),
                resultSet.getString("last_error_code"),
                resultSet.getString("last_error_message"),
                resultSet.getString("event_name"),
                resultSet.getString("schema_version"),
                resultSet.getString("dedupe_key"),
                resultSet.getString("aggregate_id"),
                resultSet.getTimestamp("published_at"),
                resultSet.getTimestamp("available_at"));
    }

    private static String signature(Stored row) {
        return String.join("|",
                row.status(),
                Integer.toString(row.attemptCount()),
                row.payload(),
                String.valueOf(row.requestId()),
                String.valueOf(row.traceId()),
                String.valueOf(row.lockedBy()),
                String.valueOf(row.lockedUntil()),
                String.valueOf(row.errorCode()),
                String.valueOf(row.errorMessage()),
                row.eventName(),
                row.schemaVersion(),
                row.dedupeKey(),
                row.aggregateId(),
                String.valueOf(row.publishedAt()),
                String.valueOf(row.availableAt()));
    }

    private void withRelay(RelayWork work) throws Exception {
        String adminUrl = required("ASSESSMENT_RELAY_TEST_ADMIN_URL");
        String adminUser = required("ASSESSMENT_RELAY_TEST_ADMIN_USER");
        String adminPassword = required("ASSESSMENT_RELAY_TEST_ADMIN_PASSWORD");
        String schema = "assessment_relay_" + Long.toUnsignedString(System.nanoTime());
        execute(adminUrl, adminUser, adminPassword, "CREATE DATABASE `" + schema
                + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        try {
            DataSource dataSource = new DriverManagerDataSource(adminUrl, adminUser, adminPassword);
            Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .defaultSchema(schema)
                    .createSchemas(false)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            TransactionTemplate transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
            work.run(jdbc, new JdbcAssessmentOutboxRelay(jdbc, transactions, schema), schema);
        } finally {
            execute(adminUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS `" + schema + "`");
        }
    }

    private static String table(String schema) {
        if (!schema.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException("schema is invalid");
        }
        return "`" + schema + "`.`assessment_outbox_event`";
    }

    private static Draft fault(int n, Instant at, Consumer<Draft> change) {
        Draft draft = new Draft(n, at);
        change.accept(draft);
        return draft;
    }

    private static void execute(String url, String user, String password, String sql) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            value = System.getProperty(name);
        }
        if (value == null || value.isBlank()) {
            throw new AssertionError(name + " is required");
        }
        return value;
    }

    @FunctionalInterface
    private interface RelayWork {
        void run(JdbcTemplate jdbc, JdbcAssessmentOutboxRelay relay, String schema) throws Exception;
    }

    private static final class Draft {
        private final String suffix;
        private String columnEventId;
        private String jsonEventId;
        private boolean writeEventId = true;
        private String eventName = EVENT;
        private String columnSchema = SCHEMA_NAME;
        private String jsonSchema = SCHEMA_NAME;
        private String jsonSchemaVersion = SCHEMA_NAME;
        private Object version = 2;
        private String aggregateType = AGGREGATE;
        private String aggregateId;
        private String jsonAggregateId;
        private String itemAssessmentId;
        private String columnRequestId = "req_relay_ok_01";
        private String jsonRequestId = columnRequestId;
        private boolean writeRequest = true;
        private String columnTraceId = TRACE;
        private String jsonTraceId = columnTraceId;
        private boolean writeTrace = true;
        private String dedupeKey;
        private String jsonDedupeKey;
        private String status = "PENDING";
        private int attempts;
        private Instant availableAt;
        private String lockedBy;
        private Instant lockedUntil;
        private String marker;

        private Draft(int n, Instant at) {
            suffix = String.format("%08x", n);
            columnEventId = UUID.randomUUID().toString();
            jsonEventId = columnEventId;
            aggregateId = "aitm_row_" + suffix;
            jsonAggregateId = aggregateId;
            itemAssessmentId = aggregateId;
            dedupeKey = "dedupe_" + suffix;
            jsonDedupeKey = dedupeKey;
            availableAt = at;
            marker = "marker-" + suffix;
        }
    }

    private record Stored(
            String eventId,
            String status,
            int attemptCount,
            String payload,
            String requestId,
            String traceId,
            String lockedBy,
            Timestamp lockedUntil,
            String errorCode,
            String errorMessage,
            String eventName,
            String schemaVersion,
            String dedupeKey,
            String aggregateId,
            Timestamp publishedAt,
            Timestamp availableAt) {
    }
}
