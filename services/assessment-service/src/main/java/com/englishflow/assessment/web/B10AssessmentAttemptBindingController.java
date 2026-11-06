package com.englishflow.assessment.web;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.englishflow.assessment.security.AssessmentJwtAuthenticationConverter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Read-only owner match for one admitted {@code assessment.item.assessed.v2} fact.
 * JDBC persistence only. Route workload verification is a separate chain.
 * This handler does not lock, write, publish, or read another service schema.
 */
@RestController
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class B10AssessmentAttemptBindingController {

    static final String TENANT = "platform";
    static final String SERVICE_ID = "learning-service";
    static final String PERMISSION = "assessment:attempt-binding:read";
    static final String EVENT_NAME = "assessment.item.assessed.v2";
    static final String SCHEMA = "assessment.event.v2";
    static final String AGGREGATE_TYPE = "assessment_item";
    static final String PIN_SOURCE = "b10_assessment_session.started_at";
    static final String OWNER = "assessment-service";

    private static final String CLOSED_REQUEST = "closed request is invalid";
    private static final String UNAUTHENTICATED = "authentication required";
    private static final String FORBIDDEN = "access denied";
    private static final String NOT_OWNED = "ATTEMPT_NOT_OWNED";
    private static final String PIN_SUBSTITUTED = "PIN_SUBSTITUTED";
    private static final String ITEM_IDENTITY_ABSENT = "ITEM_IDENTITY_ABSENT";
    private static final String EVIDENCE_REUSED = "EVIDENCE_REUSED";
    private static final String PIN_MISMATCH = "PIN_MISMATCH";
    private static final String FALLBACK_PIN = "FALLBACK_PIN";
    private static final String REPORT_PIN_ABSENT = "REPORT_PIN_ABSENT";
    private static final String UNAVAILABLE = "assessment owner binding is unavailable";
    private static final String NOT_OWNED_MESSAGE = "attempt is not available";
    private static final String CONFLICT_MESSAGE = "owner match was rejected";
    private static final Set<String> CONFLICT_CODES = Set.of(
            PIN_SUBSTITUTED, ITEM_IDENTITY_ABSENT, EVIDENCE_REUSED,
            PIN_MISMATCH, FALLBACK_PIN, REPORT_PIN_ABSENT);

    private static final Pattern ATTEMPT_ID = Pattern.compile("^aatm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern EVENT_ID = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern PRINCIPAL_ID = Pattern.compile(
            "^(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
    private static final Pattern ITEM_ID = Pattern.compile("^aitm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern LOGICAL_ID = Pattern.compile("^li_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SESSION_ID = Pattern.compile("^asess_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SNAPSHOT_ID = Pattern.compile("^snap_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern REQUEST_ID = Pattern.compile("^[A-Za-z][A-Za-z0-9._-]{7,127}$");
    private static final Pattern TRACE_ID = Pattern.compile("^[a-f0-9]{32}$");
    private static final Set<String> REQUEST_FIELDS = Set.of(
            "eventId", "learnerPrincipalId", "itemAssessmentId", "logicalItemId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash");
    private static final Set<String> PIN_FIELDS = Set.of(
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash");

    private static final String OWNER_SQL = """
            SELECT a.attempt_id, a.session_id, a.principal_id, a.tenant_id,
                   s.session_id AS session_session_id, s.principal_id AS session_principal_id,
                   s.tenant_id AS session_tenant_id, s.content_version_id, s.content_epoch,
                   s.snapshot_id, s.snapshot_hash, s.owner_snapshot_ref,
                   s.alternative_content_version_id, s.started_at
              FROM b10_assessment_attempt a
              INNER JOIN b10_assessment_session s
                ON s.session_id = BINARY a.session_id
               AND s.tenant_id = BINARY a.tenant_id
               AND s.principal_id = BINARY a.principal_id
             WHERE a.attempt_id = BINARY ?
               AND a.tenant_id = BINARY 'platform'
               AND a.principal_id = BINARY ?
            """;

    private static final String EVENT_SQL = """
            SELECT event_id, aggregate_id, event_name, schema_version, dedupe_key,
                   payload_json, request_id, trace_id
              FROM assessment_outbox_event
             WHERE event_id = BINARY ? OR dedupe_key = BINARY ?
            """;

    private static final String REPORT_SQL = """
            SELECT pin_json
              FROM b10_assessment_report
             WHERE attempt_id = BINARY ?
               AND tenant_id = BINARY 'platform'
               AND principal_id = BINARY ?
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TransactionTemplate transactions;

    public B10AssessmentAttemptBindingController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        DataSource dataSource = jdbc.getDataSource();
        if (dataSource == null) {
            throw new IllegalArgumentException("assessment owner binding requires JDBC");
        }
        TransactionTemplate template = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        template.setReadOnly(true);
        this.transactions = template;
    }

    @PostMapping("/internal/v1/assessment/attempts/{attemptId}/binding")
    public Map<String, Object> matchB10AssessmentAttemptBinding(
            Authentication authentication,
            @PathVariable String attemptId,
            @RequestBody JsonNode body) {
        MatchRequest request = closedRequest(attemptId, body);
        requireWorkload(authentication);
        try {
            ReadResult result = transactions.execute(status -> read(request));
            if (result == null || result.failure() != null) {
                throw result == null ? unavailable() : result.failure();
            }
            return result.body();
        } catch (ResponseStatusException expected) {
            throw expected;
        } catch (DataAccessException | TransactionException failure) {
            throw unavailable();
        }
    }

    private MatchRequest closedRequest(String attemptId, JsonNode body) {
        if (!matches(ATTEMPT_ID, attemptId) || body == null || !body.isObject()) {
            throw bad();
        }
        Set<String> names = new LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : body.properties()) {
            names.add(entry.getKey());
        }
        if (!names.equals(REQUEST_FIELDS)) {
            throw bad();
        }
        String eventId = exactText(body.get("eventId"));
        String learner = exactText(body.get("learnerPrincipalId"));
        String itemId = exactText(body.get("itemAssessmentId"));
        String logicalId = exactText(body.get("logicalItemId"));
        String snapshotId = exactText(body.get("snapshotId"));
        String snapshotHash = exactText(body.get("snapshotHash"));
        Long version = integral(body.get("contentVersionId"), 1L);
        Long epoch = integral(body.get("contentEpoch"), 0L);
        if (!matches(EVENT_ID, eventId) || !matches(PRINCIPAL_ID, learner) || !matches(ITEM_ID, itemId)
                || !matches(LOGICAL_ID, logicalId) || !matches(SNAPSHOT_ID, snapshotId)
                || !matches(SHA256, snapshotHash) || version == null || epoch == null) {
            throw bad();
        }
        return new MatchRequest(attemptId, eventId, learner, itemId, logicalId,
                new Pin(version, epoch, snapshotId, snapshotHash));
    }

    /**
     * Identity facts already on a verified JWT. Signature, issuer, audience, and lifetime
     * stay on the route chain. A learner access token is not this workload.
     */
    private static void requireWorkload(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw unauthenticated();
        }
        Jwt token = jwt.getToken();
        if (token == null || !SERVICE_ID.equals(token.getSubject())
                || !SERVICE_ID.equals(token.getClaimAsString("service_id"))
                || !"service".equals(token.getClaimAsString("token_type"))
                || !TENANT.equals(token.getClaimAsString("tenant_id"))) {
            throw token == null || token.getSubject() == null || token.getSubject().isBlank()
                    ? unauthenticated() : forbidden();
        }
        String clientId = token.getClaimAsString("client_id");
        if (clientId != null && !SERVICE_ID.equals(clientId)) {
            throw forbidden();
        }
        if (!AssessmentJwtAuthenticationConverter.strings(token.getClaim("roles")).isEmpty()
                || !AssessmentJwtAuthenticationConverter.strings(token.getClaim("permissions")).contains(PERMISSION)
                || !scopeContains(token.getClaimAsString("scope"), PERMISSION)) {
            throw forbidden();
        }
    }

    private ReadResult read(MatchRequest request) {
        List<Map<String, Object>> owners = jdbc.queryForList(OWNER_SQL, request.attemptId(), request.learnerPrincipalId());
        if (owners == null) {
            return ReadResult.fail(unavailable());
        }
        if (owners.isEmpty()) {
            return ReadResult.fail(notOwned());
        }
        if (owners.size() != 1) {
            return ReadResult.fail(unavailable());
        }
        Map<String, Object> owner = owners.getFirst();
        if (!request.attemptId().equals(dbString(owner.get("attempt_id")))
                || !request.learnerPrincipalId().equals(dbString(owner.get("principal_id")))
                || !request.learnerPrincipalId().equals(dbString(owner.get("session_principal_id")))
                || !TENANT.equals(dbString(owner.get("tenant_id")))
                || !TENANT.equals(dbString(owner.get("session_tenant_id")))) {
            return ReadResult.fail(notOwned());
        }
        String sessionId = dbString(owner.get("session_id"));
        if (sessionId == null || !sessionId.equals(dbString(owner.get("session_session_id")))
                || !matches(SESSION_ID, sessionId)) {
            return ReadResult.fail(unavailable());
        }
        if (owner.get("alternative_content_version_id") != null) {
            return ReadResult.fail(conflict(PIN_SUBSTITUTED));
        }
        TextColumn ownerRef = dbText(owner.get("owner_snapshot_ref"));
        TextColumn hashColumn = dbText(owner.get("snapshot_hash"));
        if (!ownerRef.readable() || !hashColumn.readable()) {
            return ReadResult.fail(unavailable());
        }
        Long version = dbLong(owner.get("content_version_id"));
        Long epoch = dbLong(owner.get("content_epoch"));
        String synthesized = synthesizedSnapshot(owner.get("snapshot_id"));
        if (ownerRef.value() == null || ownerRef.value().isBlank()
                || same(ownerRef.value(), synthesized) || same(request.pin().snapshotId(), synthesized)) {
            return ReadResult.fail(conflict(FALLBACK_PIN));
        }
        if (version == null || epoch == null || hashColumn.value() == null) {
            return ReadResult.fail(conflict(PIN_MISMATCH));
        }
        Pin sessionPin = new Pin(version, epoch, ownerRef.value(), hashColumn.value());

        String dedupe = request.attemptId() + ":" + request.itemAssessmentId();
        List<Map<String, Object>> events = jdbc.queryForList(EVENT_SQL, request.eventId(), dedupe);
        if (events == null) {
            return ReadResult.fail(unavailable());
        }
        if (events.isEmpty()) {
            return ReadResult.fail(conflict(ITEM_IDENTITY_ABSENT));
        }
        if (events.size() != 1) {
            return ReadResult.fail(conflict(EVIDENCE_REUSED));
        }
        Map<String, Object> event = events.getFirst();
        if (!request.eventId().equals(dbString(event.get("event_id")))
                || !dedupe.equals(dbString(event.get("dedupe_key")))
                || !request.itemAssessmentId().equals(dbString(event.get("aggregate_id")))) {
            return ReadResult.fail(conflict(EVIDENCE_REUSED));
        }
        JsonNode envelope = jsonObject(event.get("payload_json"));
        if (envelope == null) {
            return ReadResult.fail(conflict(ITEM_IDENTITY_ABSENT));
        }
        String identity = eventIdentity(envelope, event, request, dedupe, sessionId);
        if (identity != null) {
            return ReadResult.fail(conflict(identity));
        }
        JsonNode contentPin = envelope.path("payload").path("contentPin");
        if (!contentPin.isObject() || !fieldNames(contentPin).equals(PIN_FIELDS)) {
            return ReadResult.fail(conflict(ITEM_IDENTITY_ABSENT));
        }
        Pin eventPin = pinOf(contentPin);
        if (eventPin == null) {
            return ReadResult.fail(conflict(ITEM_IDENTITY_ABSENT));
        }
        if (same(eventPin.snapshotId(), synthesized)) {
            return ReadResult.fail(conflict(FALLBACK_PIN));
        }
        if (!eventPin.equals(sessionPin) || !eventPin.equals(request.pin())) {
            return ReadResult.fail(conflict(PIN_MISMATCH));
        }

        Instant pinnedAt;
        try {
            pinnedAt = pinInstant(owner.get("started_at"));
        } catch (ResponseStatusException unreadable) {
            return ReadResult.fail(unreadable);
        }

        List<Map<String, Object>> reports = jdbc.queryForList(
                REPORT_SQL, request.attemptId(), request.learnerPrincipalId());
        if (reports == null) {
            return ReadResult.fail(unavailable());
        }
        if (reports.size() > 1) {
            return ReadResult.fail(unavailable());
        }
        if (reports.isEmpty()) {
            return ReadResult.fail(conflict(REPORT_PIN_ABSENT));
        }
        String reporting = reporting(jsonObject(reports.getFirst().get("pin_json")), sessionPin, pinnedAt);
        if (reporting == null) {
            return ReadResult.fail(conflict(REPORT_PIN_ABSENT));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", request.attemptId());
        data.put("itemAssessmentId", request.itemAssessmentId());
        data.put("logicalItemId", request.logicalItemId());
        data.put("learnerPrincipalId", request.learnerPrincipalId());
        data.put("tenantId", TENANT);
        data.put("contentVersionId", sessionPin.contentVersionId());
        data.put("contentEpoch", sessionPin.contentEpoch());
        data.put("snapshotId", sessionPin.snapshotId());
        data.put("snapshotHash", sessionPin.snapshotHash());
        data.put("pinnedAt", pinnedAt.toString());
        data.put("pinSource", PIN_SOURCE);
        data.put("reporting", reporting);
        data.put("owner", OWNER);
        return ReadResult.ok(Map.of("data", data));
    }

    /**
     * @return a G165 conflict code, or null when the envelope and payload identity hold
     */
    private static String eventIdentity(JsonNode envelope, Map<String, Object> event, MatchRequest request,
                                        String dedupe, String sessionId) {
        if (!requiredEnvelope(envelope)) {
            return ITEM_IDENTITY_ABSENT;
        }
        if (!request.eventId().equals(exactText(envelope.get("eventId")))
                || !EVENT_NAME.equals(exactText(envelope.get("eventName")))
                || !EVENT_NAME.equals(dbString(event.get("event_name")))
                || !SCHEMA.equals(exactText(envelope.get("schema")))
                || !SCHEMA.equals(exactText(envelope.get("schemaVersion")))
                || !SCHEMA.equals(dbString(event.get("schema_version")))
                || !Integer.valueOf(2).equals(integralInt(envelope.get("version")))
                || !AGGREGATE_TYPE.equals(exactText(envelope.get("aggregateType")))
                || !request.itemAssessmentId().equals(exactText(envelope.get("aggregateId")))
                || !dedupe.equals(exactText(envelope.get("dedupeKey")))) {
            return envelopeIdentityCode(envelope, event, request, dedupe);
        }
        String requestId = exactText(envelope.get("requestId"));
        String traceId = exactText(envelope.get("traceId"));
        String occurredAt = exactText(envelope.get("occurredAt"));
        String actorId = exactText(envelope.get("actorId"));
        if (!matches(REQUEST_ID, requestId) || !requestId.equals(dbString(event.get("request_id")))
                || !matches(TRACE_ID, traceId) || !traceId.equals(dbString(event.get("trace_id")))
                || occurredAt == null || occurredAt.isBlank() || actorId == null || actorId.isBlank()) {
            return ITEM_IDENTITY_ABSENT;
        }
        if (!request.learnerPrincipalId().equals(actorId)) {
            return PIN_MISMATCH;
        }
        JsonNode tenant = envelope.get("tenantId");
        if (tenant != null && !tenant.isNull() && !TENANT.equals(exactText(tenant))) {
            return PIN_MISMATCH;
        }
        JsonNode payload = envelope.get("payload");
        if (payload == null || !payload.isObject()) {
            return ITEM_IDENTITY_ABSENT;
        }
        String payloadItem = exactText(payload.get("itemAssessmentId"));
        String payloadAttempt = exactText(payload.get("attemptId"));
        String payloadSession = exactText(payload.get("sessionId"));
        String payloadTenant = exactText(payload.get("tenantId"));
        String payloadPrincipal = exactText(payload.get("principalId"));
        String payloadLogical = exactText(payload.get("logicalItemId"));
        if (!matches(ITEM_ID, payloadItem) || !matches(ATTEMPT_ID, payloadAttempt)
                || !matches(SESSION_ID, payloadSession) || !matches(PRINCIPAL_ID, payloadPrincipal)
                || !matches(LOGICAL_ID, payloadLogical) || payloadTenant == null) {
            return ITEM_IDENTITY_ABSENT;
        }
        if (!request.itemAssessmentId().equals(payloadItem)
                || !request.attemptId().equals(payloadAttempt)
                || !sessionId.equals(payloadSession)
                || !TENANT.equals(payloadTenant)
                || !request.learnerPrincipalId().equals(payloadPrincipal)
                || !request.logicalItemId().equals(payloadLogical)) {
            return PIN_MISMATCH;
        }
        return null;
    }

    private static String envelopeIdentityCode(JsonNode envelope, Map<String, Object> event,
                                               MatchRequest request, String dedupe) {
        String envelopeEvent = exactText(envelope.get("eventId"));
        String envelopeDedupe = exactText(envelope.get("dedupeKey"));
        String envelopeAggregate = exactText(envelope.get("aggregateId"));
        boolean keysPresent = envelopeEvent != null && envelopeDedupe != null && envelopeAggregate != null;
        boolean keysMatch = request.eventId().equals(envelopeEvent)
                && dedupe.equals(envelopeDedupe)
                && request.itemAssessmentId().equals(envelopeAggregate)
                && EVENT_NAME.equals(dbString(event.get("event_name")))
                && SCHEMA.equals(dbString(event.get("schema_version")));
        if (keysPresent && !keysMatch) {
            return EVIDENCE_REUSED;
        }
        return ITEM_IDENTITY_ABSENT;
    }

    private static boolean requiredEnvelope(JsonNode envelope) {
        return exactText(envelope.get("eventId")) != null
                && exactText(envelope.get("eventName")) != null
                && exactText(envelope.get("schema")) != null
                && envelope.get("version") != null
                && exactText(envelope.get("occurredAt")) != null
                && exactText(envelope.get("aggregateType")) != null
                && exactText(envelope.get("aggregateId")) != null
                && exactText(envelope.get("actorId")) != null
                && exactText(envelope.get("traceId")) != null
                && exactText(envelope.get("requestId")) != null
                && exactText(envelope.get("schemaVersion")) != null
                && exactText(envelope.get("dedupeKey")) != null
                && envelope.get("payload") != null;
    }

    /**
     * CURRENT compares the receipt version, epoch, hash, and pinnedAt instant with the session.
     * The receipt snapshot id is not a binding field. A readable older stamp is HISTORICAL.
     * The receipt is not rewritten.
     */
    private String reporting(JsonNode pin, Pin sessionPin, Instant pinnedAt) {
        if (pin == null || !pin.isObject()) {
            return null;
        }
        Long version = integral(pin.get("contentVersionId"), 1L);
        Long epoch = integral(pin.get("contentEpoch"), 0L);
        String hash = exactText(pin.get("snapshotHash"));
        String stamped = exactText(pin.get("pinnedAt"));
        if (version == null || epoch == null || hash == null || stamped == null) {
            return null;
        }
        Instant receiptAt;
        try {
            receiptAt = Instant.parse(stamped);
        } catch (DateTimeParseException invalid) {
            return null;
        }
        if (version.longValue() == sessionPin.contentVersionId()
                && epoch.longValue() == sessionPin.contentEpoch()
                && hash.equals(sessionPin.snapshotHash())
                && receiptAt.equals(pinnedAt)) {
            return "CURRENT";
        }
        return "HISTORICAL";
    }

    private Pin pinOf(JsonNode pin) {
        Long version = integral(pin.get("contentVersionId"), 1L);
        Long epoch = integral(pin.get("contentEpoch"), 0L);
        String snapshotId = exactText(pin.get("snapshotId"));
        String hash = exactText(pin.get("snapshotHash"));
        if (version == null || epoch == null || snapshotId == null || hash == null) {
            return null;
        }
        return new Pin(version, epoch, snapshotId, hash);
    }

    private JsonNode jsonObject(Object raw) {
        try {
            JsonNode node;
            if (raw instanceof JsonNode json) {
                node = json;
            } else if (raw instanceof byte[] bytes) {
                node = mapper.readTree(bytes);
            } else if (raw instanceof String text) {
                node = mapper.readTree(text);
            } else if (raw instanceof Map<?, ?> map) {
                node = mapper.valueToTree(map);
            } else {
                return null;
            }
            return node != null && node.isObject() ? node : null;
        } catch (RuntimeException invalid) {
            return null;
        }
    }

    /**
     * Same conversion as the session pin: Timestamp keeps its instant, a zone-less
     * LocalDateTime is the UTC owner convention, and an ISO string parses as itself.
     * This route maps a missing or malformed value to 503. It does not read the clock.
     */
    private static Instant pinInstant(Object value) {
        if (value == null) {
            throw unavailable();
        }
        try {
            if (value instanceof Timestamp timestamp) {
                return timestamp.toInstant();
            }
            if (value instanceof LocalDateTime localDateTime) {
                return localDateTime.toInstant(ZoneOffset.UTC);
            }
            return Instant.parse(String.valueOf(value));
        } catch (DateTimeParseException | IllegalArgumentException invalid) {
            throw unavailable();
        }
    }

    private static String synthesizedSnapshot(Object snapshotId) {
        Long numeric = dbLong(snapshotId);
        if (numeric == null) {
            return null;
        }
        return "snap_assessment_" + numeric;
    }

    private static boolean same(String left, String right) {
        return left != null && left.equals(right);
    }

    private static Long integral(JsonNode node, long minimum) {
        if (node == null || !node.isNumber()) {
            return null;
        }
        String rendered = node.asText();
        if (rendered == null || !rendered.matches("-?\\d+")) {
            Object raw = node.numberValue();
            if (!(raw instanceof Number number) || raw instanceof Double || raw instanceof Float) {
                return null;
            }
            rendered = number.toString();
            if (!rendered.matches("-?\\d+")) {
                return null;
            }
        }
        try {
            long value = Long.parseLong(rendered);
            return value < minimum ? null : value;
        } catch (NumberFormatException invalid) {
            return null;
        }
    }

    private static Integer integralInt(JsonNode node) {
        Long value = integral(node, 0L);
        if (value == null || value > Integer.MAX_VALUE) {
            return null;
        }
        return value.intValue();
    }

    private static Long dbLong(Object value) {
        if (value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long) {
            return ((Number) value).longValue();
        }
        if (value instanceof java.math.BigInteger integer) {
            try {
                return integer.longValueExact();
            } catch (ArithmeticException invalid) {
                return null;
            }
        }
        if (value instanceof java.math.BigDecimal decimal) {
            try {
                return decimal.longValueExact();
            } catch (ArithmeticException invalid) {
                return null;
            }
        }
        return null;
    }

    private static String dbString(Object value) {
        TextColumn column = dbText(value);
        return column.readable() ? column.value() : null;
    }

    private static TextColumn dbText(Object value) {
        if (value == null) {
            return new TextColumn(null, true);
        }
        if (value instanceof String text) {
            return new TextColumn(text, true);
        }
        if (value instanceof byte[] bytes) {
            return new TextColumn(new String(bytes, StandardCharsets.UTF_8), true);
        }
        return new TextColumn(null, false);
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            names.add(entry.getKey());
        }
        return names;
    }

    private static String exactText(JsonNode node) {
        if (node == null || node.isNull() || !node.isTextual()) {
            return null;
        }
        return node.asText();
    }

    private static boolean matches(Pattern pattern, String value) {
        return value != null && pattern.matcher(value).matches();
    }

    private static boolean scopeContains(String scope, String permission) {
        if (scope == null) {
            return false;
        }
        for (String token : scope.split(" ", -1)) {
            if (permission.equals(token)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Route-local wire for this handler only. A missing attempt and a wrong subject share
     * {@code ATTEMPT_NOT_OWNED}. The six owner-match conflicts stay distinct. The body is the
     * closed code plus the one generic sentence the schema allows. Other statuses, including
     * 400, 401, 403, and 503, are thrown again so the existing status path is unchanged.
     */
    @ExceptionHandler(ResponseStatusException.class)
    void serializeClosedBindingStatus(ResponseStatusException failure, HttpServletResponse response) throws IOException {
        int status = failure.getStatusCode().value();
        String code = failure.getReason();
        String message = null;
        if (status == HttpStatus.NOT_FOUND.value() && NOT_OWNED.equals(code)) {
            message = NOT_OWNED_MESSAGE;
            code = NOT_OWNED;
        } else if (status == HttpStatus.CONFLICT.value() && CONFLICT_CODES.contains(code)) {
            message = CONFLICT_MESSAGE;
        } else {
            throw failure;
        }
        Map<String, String> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        String json;
        try {
            json = mapper.writeValueAsString(body);
        } catch (JacksonException invalid) {
            throw failure;
        }
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(json);
    }

    private static ResponseStatusException bad() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, CLOSED_REQUEST);
    }

    private static ResponseStatusException unauthenticated() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, UNAUTHENTICATED);
    }

    private static ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, FORBIDDEN);
    }

    private static ResponseStatusException notOwned() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_OWNED);
    }

    private static ResponseStatusException conflict(String code) {
        return new ResponseStatusException(HttpStatus.CONFLICT, code);
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE);
    }

    private record MatchRequest(String attemptId, String eventId, String learnerPrincipalId,
                                String itemAssessmentId, String logicalItemId, Pin pin) {
    }

    private record Pin(long contentVersionId, long contentEpoch, String snapshotId, String snapshotHash) {
    }

    private record TextColumn(String value, boolean readable) {
    }

    private record ReadResult(Map<String, Object> body, ResponseStatusException failure) {
        static ReadResult ok(Map<String, Object> body) {
            return new ReadResult(body, null);
        }

        static ReadResult fail(ResponseStatusException failure) {
            return new ReadResult(null, failure);
        }
    }
}
