package com.englishflow.assessment.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.sql.DataSource;

import com.englishflow.assessment.adapter.content.HttpPlacementRuleScorePort;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Disposable Flyway V12 proof for the G188 owner reader after the G206 Jackson compile fix.
 *
 * <p>The class stays skipped unless {@code assessment.pin.mysql} is {@code true}. It uses the
 * G157 dedicated {@code asm_pin_[a-f0-9]+} schema on {@code jdbc:mysql://127.0.0.1:13306/} and
 * does not create or drop that schema. The write side is the production B10 create/submit
 * transaction used by the B110 single-grammar placement bank. No attempt, score, report, or
 * outbox row is inserted by this test. Assertion text omits the account, the password, and the
 * synthetic token. This DataSource has no statement interceptor, so SELECT cardinality is not
 * asserted.
 */
@EnabledIfSystemProperty(named = "assessment.pin.mysql", matches = "true")
class AssessmentAttemptBindingActualMySqlTest {

    private static final String ENDPOINT = "jdbc:mysql://127.0.0.1:13306/";
    private static final String CONTENT_BASE = "http://127.0.0.1:18089";
    private static final String CONTENT_CODE = "p1.placement.v1";
    private static final long CONTENT_VERSION = 266100L;
    private static final long GRAMMAR_ITEM_ID = 266004L;
    private static final String CREATE_KEY = "binding-mysql-create";
    private static final String SUBMIT_KEY = "binding-mysql-submit";
    private static final String CLIENT_REF = "h5-grammar-266004";
    private static final String SUBJECT = "prn_bindmysql0000001";
    private static final String OTHER_SUBJECT = "prn_bindother0000001";
    private static final String DENIED_ATTEMPT = "aatm_bindingdeny01";
    private static final String DENIED_EVENT = "11111111-1111-4111-8111-111111111111";
    private static final String DENIED_ITEM = "aitm_bindingitem01";
    private static final String DENIED_LOGICAL = "li_bindingitem01";
    private static final String DENIED_SNAPSHOT = "snap_bindingdeny0001";
    private static final String DENIED_HASH = "00".repeat(32);
    private static final String OTHER_EVENT = "22222222-2222-4222-8222-222222222222";
    private static final String SYNTHETIC = "synthetic-in-process";
    private static final String PERMISSION = B10AssessmentAttemptBindingController.PERMISSION;
    private static final List<String> VERSIONS = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12");
    private static final List<String> BUSINESS_TABLES = List.of(
            "b10_assessment_session", "b10_assessment_attempt", "b10_assessment_report",
            "assessment_outbox_event", "assessment_idempotency", "assessment_mistake",
            "b25_assessment_item_rule");
    private static final List<String> DATA_FIELDS = List.of(
            "attemptId", "itemAssessmentId", "logicalItemId", "learnerPrincipalId", "tenantId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash", "pinnedAt",
            "pinSource", "reporting", "owner");

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void productionGrammarWriteFeedsOwnerReadbackWhenBankPinExists() {
        String schema = dedicatedSchema(required("ASSESSMENT_PIN_TEST_SCHEMA"));
        String user = required("ASSESSMENT_PIN_TEST_USER");
        String password = required("ASSESSMENT_PIN_TEST_PASSWORD");
        JdbcTemplate jdbc = connect(schema, user, password);
        TransactionTemplate transactions = new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource()));
        transactions.setTimeout(30);

        assertUtcSession(jdbc);
        assertEmpty(jdbc);
        migrate(jdbc.getDataSource(), schema);
        assertMigratedThroughV12(jdbc);

        B10AssessmentAttemptBindingController reader = new B10AssessmentAttemptBindingController(jdbc, mapper);
        assertDeniedPrincipalWritesNothing(jdbc, reader);

        B10AssessmentJdbcController writer = new B10AssessmentJdbcController(jdbc, mapper, CONTENT_BASE,
                new HttpPlacementRuleScorePort(mapper, CONTENT_BASE, "", Duration.ofSeconds(5)));
        Produced produced = produce(jdbc, transactions, writer);
        if (produced.gap() != null) {
            fail(produced.gap());
        }
        assertOwnerReadback(jdbc, reader, produced);
    }

    private void assertDeniedPrincipalWritesNothing(JdbcTemplate jdbc,
                                                    B10AssessmentAttemptBindingController reader) {
        Map<String, Long> before = census(jdbc);
        String fingerprint = fingerprint(jdbc);
        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> reader.matchB10AssessmentAttemptBinding(
                        learnerAccessToken(), DENIED_ATTEMPT, deniedBody()));
        assertTrue(denied.getStatusCode().isSameCodeAs(HttpStatus.FORBIDDEN));
        assertEquals("access denied", denied.getReason());
        assertEquals(before, census(jdbc));
        assertEquals(fingerprint, fingerprint(jdbc), "owner rows changed during a denied read");
    }

    private Produced produce(JdbcTemplate jdbc, TransactionTemplate transactions,
                             B10AssessmentJdbcController writer) {
        JwtAuthenticationToken learner = learnerPrincipal();
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("contentCode", CONTENT_CODE);
        request.put("contentVersionId", CONTENT_VERSION);
        request.put("mode", "PRACTICE");
        request.put("itemIds", List.of(GRAMMAR_ITEM_ID));
        request.put("clientSessionRef", CLIENT_REF);

        Map<String, Object> created;
        try {
            created = owner(transactions, () -> writer.createSession(
                    learner, request, CREATE_KEY, "Bearer " + SYNTHETIC));
        } catch (ResponseStatusException ex) {
            assertNoCreateResidue(jdbc);
            return Produced.gap(prerequisite(publicReason(ex)));
        }

        Map<String, Object> createdData = data(created);
        String sessionId = id(createdData, "sessionId", "asess_");
        long stateVersion = number(createdData.get("stateVersion"), 1L);
        long itemId = responseItemId(createdData);
        Map<String, Object> submission = new LinkedHashMap<>();
        submission.put("submissionId", "bindmysqlsub0001");
        submission.put("expectedStateVersion", stateVersion);
        submission.put("items", List.of(Map.of(
                "itemId", itemId,
                "response", Map.of("selectedOptionKey", "a"))));
        SecurityContextHolder.getContext().setAuthentication(learner);
        try {
            owner(transactions, () -> writer.submitAttempt(
                    learner, sessionId, submission, SUBMIT_KEY, "req-binding-0001",
                    "0123456789abcdef0123456789abcdef"));
        } catch (ResponseStatusException ex) {
            assertNoAttemptEvidence(jdbc);
            return Produced.gap(prerequisite("submitAttempt " + ex.getStatusCode().value()
                    + " " + publicReason(ex)));
        } finally {
            SecurityContextHolder.clearContext();
        }
        return readProduced(jdbc, sessionId);
    }

    private Produced readProduced(JdbcTemplate jdbc, String sessionId) {
        List<Map<String, Object>> sessions = jdbc.queryForList("""
                SELECT session_id, content_code, content_version_id, content_epoch, snapshot_id,
                       snapshot_hash, owner_snapshot_ref, alternative_content_version_id,
                       started_at, items_json, principal_id
                  FROM b10_assessment_session
                 WHERE session_id = ?
                """, sessionId);
        if (sessions.size() != 1) {
            return Produced.gap(prerequisite("session lookup returned " + sessions.size() + " rows"));
        }
        Map<String, Object> session = sessions.getFirst();
        if (!SUBJECT.equals(String.valueOf(session.get("principal_id")))) {
            return Produced.gap(prerequisite("stored principal does not match the synthetic learner"));
        }
        if (!CONTENT_CODE.equals(String.valueOf(session.get("content_code")))) {
            return Produced.gap(prerequisite("stored content code is not the placement bank"));
        }
        if (session.get("alternative_content_version_id") != null) {
            return Produced.gap(prerequisite("stored session has a substitute pin"));
        }
        if (!oneGrammarItem(session.get("items_json"))) {
            return Produced.gap(prerequisite("stored session is not one GRAMMAR item"));
        }
        String ownerRef = textOrNull(session.get("owner_snapshot_ref"));
        String synthesized = "snap_assessment_" + number(session.get("snapshot_id"), -1L);
        if (ownerRef == null || ownerRef.isBlank()) {
            return Produced.gap(prerequisite("owner_snapshot_ref is empty"));
        }
        if (ownerRef.equals(synthesized)) {
            return Produced.gap(prerequisite("owner_snapshot_ref equals the synthesized snapshot id"));
        }
        if (!ownerRef.matches("snap_[A-Za-z0-9._:-]{8,127}")) {
            return Produced.gap(prerequisite("owner_snapshot_ref is not a canonical snap_ token"));
        }
        long version = number(session.get("content_version_id"), -1L);
        long epoch = number(session.get("content_epoch"), -1L);
        String hash = textOrNull(session.get("snapshot_hash"));
        if (version < 1 || epoch < 0 || hash == null || !hash.matches("[a-f0-9]{64}")) {
            return Produced.gap(prerequisite("stored session pin is incomplete"));
        }

        List<Map<String, Object>> events = jdbc.queryForList("""
                SELECT event_id, aggregate_id, event_name, schema_version, dedupe_key,
                       payload_json, request_id, trace_id
                  FROM assessment_outbox_event
                 WHERE event_name = 'assessment.item.assessed.v2'
                """);
        if (events.size() != 1) {
            return Produced.gap(prerequisite("producer emitted " + events.size()
                    + " assessment.item.assessed.v2 rows"));
        }
        Map<String, Object> event = events.getFirst();
        JsonNode envelope = tree(event.get("payload_json"));
        if (envelope == null || !envelope.isObject()) {
            return Produced.gap(prerequisite("assessed payload_json is not an object"));
        }
        JsonNode contentPin = envelope.path("payload").path("contentPin");
        if (!contentPin.isObject() || !fieldNames(contentPin).equals(java.util.Set.of(
                "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash"))) {
            return Produced.gap(prerequisite("assessed contentPin is not the closed four-field pin"));
        }
        String eventId = textOrNull(event.get("event_id"));
        String itemId = textOrNull(envelope.path("payload").path("itemAssessmentId"));
        String logicalId = textOrNull(envelope.path("payload").path("logicalItemId"));
        String attemptId = textOrNull(envelope.path("payload").path("attemptId"));
        String dedupe = attemptId + ":" + itemId;
        if (eventId == null || itemId == null || logicalId == null || attemptId == null
                || !eventId.equals(textOrNull(envelope.get("eventId")))
                || !itemId.equals(textOrNull(event.get("aggregate_id")))
                || !dedupe.equals(textOrNull(event.get("dedupe_key")))
                || !"assessment.item.assessed.v2".equals(textOrNull(event.get("event_name")))
                || !"assessment.event.v2".equals(textOrNull(event.get("schema_version")))
                || !SUBJECT.equals(textOrNull(envelope.get("actorId")))
                || !SUBJECT.equals(textOrNull(envelope.path("payload").path("principalId")))
                || !sessionId.equals(textOrNull(envelope.path("payload").path("sessionId")))
                || !ownerRef.equals(textOrNull(contentPin.get("snapshotId")))
                || version != integral(contentPin.get("contentVersionId"))
                || epoch != integral(contentPin.get("contentEpoch"))
                || !hash.equals(textOrNull(contentPin.get("snapshotHash")))) {
            return Produced.gap(prerequisite("assessed event tuple does not equal the session owner pin"));
        }

        List<Map<String, Object>> reports = jdbc.queryForList("""
                SELECT pin_json FROM b10_assessment_report
                 WHERE attempt_id = ? AND principal_id = ? AND tenant_id = 'platform'
                """, attemptId, SUBJECT);
        if (reports.size() != 1) {
            return Produced.gap(prerequisite("producer stored " + reports.size() + " report receipts"));
        }
        JsonNode receipt = tree(reports.getFirst().get("pin_json"));
        String reporting = reporting(receipt, version, epoch, hash, columnInstant(session.get("started_at")));
        if (reporting == null) {
            return Produced.gap(prerequisite("report pin_json is not a readable receipt"));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", eventId);
        body.put("learnerPrincipalId", SUBJECT);
        body.put("itemAssessmentId", itemId);
        body.put("logicalItemId", logicalId);
        body.put("contentVersionId", version);
        body.put("contentEpoch", epoch);
        body.put("snapshotId", ownerRef);
        body.put("snapshotHash", hash);
        return Produced.ready(attemptId, mapper.valueToTree(body),
                columnInstant(session.get("started_at")), reporting, hash);
    }

    private void assertOwnerReadback(JdbcTemplate jdbc, B10AssessmentAttemptBindingController reader,
                                     Produced produced) {
        String fingerprint = fingerprint(jdbc);
        Map<String, Long> before = census(jdbc);
        Authentication workload = learningWorkload();

        Map<String, Object> response = reader.matchB10AssessmentAttemptBinding(
                workload, produced.attemptId(), produced.body());
        assertEquals(List.of("data"), List.copyOf(response.keySet()));
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        assertEquals(DATA_FIELDS, List.copyOf(data.keySet()));
        if (!produced.attemptId().equals(data.get("attemptId"))) {
            throw new AssertionError("reader attempt id does not match the stored attempt");
        }
        if (!SUBJECT.equals(data.get("learnerPrincipalId"))) {
            throw new AssertionError("reader principal does not match the stored learner");
        }
        assertEquals("platform", data.get("tenantId"));
        assertEquals(CONTENT_VERSION, number(data.get("contentVersionId"), -1L));
        if (!textOrNull(produced.body().get("snapshotId")).equals(data.get("snapshotId"))) {
            throw new AssertionError("reader snapshot id is not the stored owner ref");
        }
        if (String.valueOf(data.get("snapshotId")).startsWith("snap_assessment_")) {
            throw new AssertionError("reader returned the synthesized snapshot id");
        }
        if (!produced.hash().equals(data.get("snapshotHash"))) {
            throw new AssertionError("reader hash does not match the stored session hash");
        }
        if (!textOrNull(produced.body().get("itemAssessmentId")).equals(data.get("itemAssessmentId"))
                || !textOrNull(produced.body().get("logicalItemId")).equals(data.get("logicalItemId"))) {
            throw new AssertionError("reader item identity does not match the stored event");
        }
        assertEquals(produced.body().get("contentEpoch").asLong(), number(data.get("contentEpoch"), -1L));
        assertEquals(produced.startedAt().toString(), data.get("pinnedAt"));
        assertEquals("b10_assessment_session.started_at", data.get("pinSource"));
        assertEquals(produced.reporting(), data.get("reporting"));
        assertEquals("assessment-service", data.get("owner"));
        assertClosedProjection(mapper.valueToTree(response).toString());

        Map<String, Object> wrongPin = bodyMap(produced.body());
        wrongPin.put("snapshotHash", otherHash(produced.hash()));
        ResponseStatusException mismatched = assertThrows(ResponseStatusException.class,
                () -> reader.matchB10AssessmentAttemptBinding(
                        workload, produced.attemptId(), mapper.valueToTree(wrongPin)));
        assertTrue(mismatched.getStatusCode().isSameCodeAs(HttpStatus.CONFLICT));
        assertEquals("PIN_MISMATCH", mismatched.getReason());
        if (mismatched.getReason() != null
                && mismatched.getReason().toLowerCase(Locale.ROOT).contains(produced.hash().toLowerCase(Locale.ROOT))) {
            throw new AssertionError("conflict reason contains the snapshot hash");
        }

        Map<String, Object> wrongIdentity = bodyMap(produced.body());
        wrongIdentity.put("learnerPrincipalId", OTHER_SUBJECT);
        ResponseStatusException unowned = assertThrows(ResponseStatusException.class,
                () -> reader.matchB10AssessmentAttemptBinding(
                        workload, produced.attemptId(), mapper.valueToTree(wrongIdentity)));
        assertTrue(unowned.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND));
        assertEquals("ATTEMPT_NOT_OWNED", unowned.getReason());

        Map<String, Object> wrongEvent = bodyMap(produced.body());
        wrongEvent.put("eventId", OTHER_EVENT);
        ResponseStatusException reused = assertThrows(ResponseStatusException.class,
                () -> reader.matchB10AssessmentAttemptBinding(
                        workload, produced.attemptId(), mapper.valueToTree(wrongEvent)));
        assertTrue(reused.getStatusCode().isSameCodeAs(HttpStatus.CONFLICT));
        assertEquals("EVIDENCE_REUSED", reused.getReason());

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> reader.matchB10AssessmentAttemptBinding(
                        learnerAccessToken(), produced.attemptId(), produced.body()));
        assertTrue(denied.getStatusCode().isSameCodeAs(HttpStatus.FORBIDDEN));
        assertEquals("access denied", denied.getReason());

        if ("HISTORICAL".equals(produced.reporting())) {
            assertEquals(fingerprint, fingerprint(jdbc), "historical read rewrote the receipt");
        } else {
            assertEquals("CURRENT", produced.reporting());
        }
        assertEquals(before, census(jdbc));
        assertEquals(fingerprint, fingerprint(jdbc), "owner rows changed during readback");
    }

    private JsonNode deniedBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", DENIED_EVENT);
        body.put("learnerPrincipalId", SUBJECT);
        body.put("itemAssessmentId", DENIED_ITEM);
        body.put("logicalItemId", DENIED_LOGICAL);
        body.put("contentVersionId", CONTENT_VERSION);
        body.put("contentEpoch", 1L);
        body.put("snapshotId", DENIED_SNAPSHOT);
        body.put("snapshotHash", DENIED_HASH);
        return mapper.valueToTree(body);
    }

    private boolean oneGrammarItem(Object raw) {
        JsonNode items = tree(raw);
        return items != null && items.isArray() && items.size() == 1
                && "GRAMMAR".equals(textOrNull(items.get(0).get("itemType")));
    }

    private String reporting(JsonNode pin, long version, long epoch, String hash, Instant startedAt) {
        if (pin == null || !pin.isObject() || startedAt == null) {
            return null;
        }
        long receiptVersion = integral(pin.get("contentVersionId"));
        long receiptEpoch = integral(pin.get("contentEpoch"));
        String receiptHash = textOrNull(pin.get("snapshotHash"));
        String stamped = textOrNull(pin.get("pinnedAt"));
        if (receiptVersion < 1 || receiptEpoch < 0 || receiptHash == null || stamped == null) {
            return null;
        }
        Instant receiptAt;
        try {
            receiptAt = Instant.parse(stamped);
        } catch (DateTimeParseException invalid) {
            return null;
        }
        if (receiptVersion == version && receiptEpoch == epoch && receiptHash.equals(hash)
                && receiptAt.equals(startedAt)) {
            return "CURRENT";
        }
        return "HISTORICAL";
    }

    private static Instant columnInstant(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime.toInstant(ZoneOffset.UTC);
        }
        if (value == null) {
            return null;
        }
        return Instant.parse(String.valueOf(value));
    }

    private JsonNode tree(Object raw) {
        try {
            if (raw instanceof byte[] bytes) {
                return mapper.readTree(bytes);
            }
            if (raw instanceof String text) {
                return mapper.readTree(text);
            }
            return null;
        } catch (RuntimeException invalid) {
            return null;
        }
    }

    private static String textOrNull(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        if (value instanceof JsonNode node) {
            return node.isTextual() ? node.asText() : null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static long integral(JsonNode node) {
        if (node == null || !node.isNumber() || !node.asText().matches("-?\\d+")) {
            return -1L;
        }
        try {
            return Long.parseLong(node.asText());
        } catch (NumberFormatException invalid) {
            return -1L;
        }
    }

    private static long number(Object value, long fallback) {
        return value instanceof Number number ? number.longValue() : fallback;
    }

    private static java.util.Set<String> fieldNames(JsonNode node) {
        java.util.LinkedHashSet<String> names = new java.util.LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            names.add(entry.getKey());
        }
        return names;
    }

    private Map<String, Object> bodyMap(JsonNode body) {
        Map<String, Object> copy = new LinkedHashMap<>();
        copy.put("eventId", body.get("eventId").asText());
        copy.put("learnerPrincipalId", body.get("learnerPrincipalId").asText());
        copy.put("itemAssessmentId", body.get("itemAssessmentId").asText());
        copy.put("logicalItemId", body.get("logicalItemId").asText());
        copy.put("contentVersionId", body.get("contentVersionId").asLong());
        copy.put("contentEpoch", body.get("contentEpoch").asLong());
        copy.put("snapshotId", body.get("snapshotId").asText());
        copy.put("snapshotHash", body.get("snapshotHash").asText());
        return copy;
    }

    private static String otherHash(String hash) {
        char[] chars = hash.toCharArray();
        chars[chars.length - 1] = chars[chars.length - 1] == '0' ? '1' : '0';
        return new String(chars);
    }

    private static long responseItemId(Map<String, Object> body) {
        Object items = body.get("items");
        if (!(items instanceof List<?> list) || list.isEmpty() || !(list.getFirst() instanceof Map<?, ?> item)) {
            throw new AssertionError("session item id is missing");
        }
        Object itemId = item.get("itemId");
        if (!(itemId instanceof Number) || ((Number) itemId).longValue() != GRAMMAR_ITEM_ID) {
            throw new AssertionError("session item is not the single grammar item");
        }
        return ((Number) itemId).longValue();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        Object value = envelope.get("data");
        if (!(value instanceof Map<?, ?> map)) {
            throw new AssertionError("assessment envelope is missing");
        }
        return (Map<String, Object>) map;
    }

    private static String id(Map<String, Object> body, String key, String prefix) {
        Object value = body.get(key);
        if (!(value instanceof String text) || !text.startsWith(prefix) || text.length() <= prefix.length()) {
            throw new AssertionError(key + " is missing");
        }
        return text;
    }

    private static void assertClosedProjection(String raw) {
        for (String secret : List.of("scoreBucket", "objectiveOutcome", "contentCode", "correctOption",
                "answer", "rawResponse", "mastery", "mistake")) {
            if (raw.contains(secret)) {
                throw new AssertionError("reader projection contains " + secret);
            }
        }
    }

    private static void assertNoCreateResidue(JdbcTemplate jdbc) {
        assertNoAttemptEvidence(jdbc);
        assertEquals(0L, count(jdbc, "b10_assessment_session"));
        assertEquals(0L, count(jdbc, "assessment_idempotency"));
    }

    private static void assertNoAttemptEvidence(JdbcTemplate jdbc) {
        assertEquals(0L, count(jdbc, "b10_assessment_attempt"));
        assertEquals(0L, count(jdbc, "b10_assessment_report"));
        assertEquals(0L, count(jdbc, "assessment_outbox_event"));
        assertEquals(0L, count(jdbc, "assessment_mistake"));
        assertEquals(0L, count(jdbc, "b25_assessment_item_rule"));
    }

    private static String prerequisite(String observed) {
        return "OWNER_PIN_PREREQUISITE_MISSING. "
                + "The production create/submit path did not leave an eligible owner pin, "
                + "so this test does not insert an attempt, score, report, or outbox row. "
                + "Required before owner readback: sealed bank GET "
                + CONTENT_BASE + "/internal/v1/content/placement-bank/sealed "
                + "with a non-blank learner Authorization, bankCode P1_PLACEMENT_V1, "
                + "contentVersionId 266100, contentEpoch >= 0, snapshotHash [a-f0-9]{64}, "
                + "snapshotId matching snap_[A-Za-z0-9._:-]{8,127} and different from "
                + "snap_assessment_266100, and named BASIC_GRAMMAR itemId 266004; "
                + "submit re-reads that bank from the learner JwtAuthenticationToken; "
                + "HttpPlacementRuleScorePort requires a service token for POST "
                + CONTENT_BASE + "/internal/v1/content/placement-bank/score. "
                + "A local b25_assessment_item_rule row leaves owner_snapshot_ref empty and is not seeded. "
                + "No legacy negative receipt is seeded. Observed: " + observed;
    }

    private static String publicReason(ResponseStatusException ex) {
        String reason = ex.getReason() == null ? "" : ex.getReason();
        if (containsCredential(reason)) {
            return "status text contained a dedicated credential";
        }
        return reason + " (" + ex.getStatusCode().value() + ")";
    }

    private static boolean containsCredential(String text) {
        if (text.contains(SYNTHETIC) || text.contains("Bearer ")) {
            return true;
        }
        for (String name : List.of("ASSESSMENT_PIN_TEST_USER", "ASSESSMENT_PIN_TEST_PASSWORD")) {
            String value = System.getenv(name);
            if (value == null || value.isBlank()) {
                value = System.getProperty(name);
            }
            if (value != null && !value.isBlank() && text.contains(value)) {
                return true;
            }
        }
        return false;
    }

    private Map<String, Long> census(JdbcTemplate jdbc) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : BUSINESS_TABLES) {
            counts.put(table, count(jdbc, table));
        }
        return counts;
    }

    private static String fingerprint(JdbcTemplate jdbc) {
        StringBuilder raw = new StringBuilder();
        append(raw, jdbc, """
                SELECT session_id, owner_snapshot_ref, snapshot_hash, items_json, answers_json, started_at
                  FROM b10_assessment_session ORDER BY session_id
                """);
        append(raw, jdbc, """
                SELECT attempt_id, session_id, submission_digest FROM b10_assessment_attempt ORDER BY attempt_id
                """);
        append(raw, jdbc, "SELECT report_id, pin_json FROM b10_assessment_report ORDER BY report_id");
        append(raw, jdbc, """
                SELECT event_id, event_name, dedupe_key, payload_json
                  FROM assessment_outbox_event ORDER BY event_id
                """);
        return sha256(raw.toString());
    }

    private static void append(StringBuilder raw, JdbcTemplate jdbc, String sql) {
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            raw.append(row.size()).append('\n');
            for (Object value : row.values()) {
                if (value instanceof byte[] bytes) {
                    raw.append(new String(bytes, StandardCharsets.UTF_8));
                } else if (value != null) {
                    raw.append(value);
                }
                raw.append('\n');
            }
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable");
        }
    }

    private static JdbcTemplate connect(String schema, String user, String password) {
        String url = url(schema);
        DriverManagerDataSource dataSource = new DriverManagerDataSource(url, user, password);
        if (!url.equals(dataSource.getUrl())) {
            throw new AssertionError("connection url is not the fixed assessment endpoint");
        }
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertFixedEndpoint(jdbc, schema);
        return jdbc;
    }

    private static void assertFixedEndpoint(JdbcTemplate jdbc, String schema) {
        try {
            jdbc.execute((ConnectionCallback<Void>) connection -> {
                String reported = connection.getMetaData().getURL();
                String prefix = ENDPOINT + schema;
                if (reported == null || !(reported.equals(prefix) || reported.startsWith(prefix + "?"))
                        || reported.contains("@") || reported.contains("localhost")) {
                    throw new AssertionError("connection is not the fixed assessment MySQL endpoint");
                }
                if (!schema.equals(connection.getCatalog())) {
                    throw new AssertionError("connection catalog is not the dedicated schema");
                }
                return null;
            });
        } catch (DataAccessException ex) {
            throw new AssertionError("dedicated binding schema connection was rejected");
        }
        if (!schema.equals(jdbc.queryForObject("SELECT DATABASE()", String.class))) {
            throw new AssertionError("connection database is not the dedicated schema");
        }
    }

    private static void assertUtcSession(JdbcTemplate jdbc) {
        String zone = jdbc.queryForObject("SELECT @@session.time_zone", String.class);
        if (!"UTC".equals(zone) && !"+00:00".equals(zone)) {
            throw new AssertionError("session time zone is not UTC");
        }
    }

    private static void assertEmpty(JdbcTemplate jdbc) {
        if (!jdbc.queryForList("SHOW FULL TABLES").isEmpty()) {
            throw new AssertionError("dedicated schema is not empty");
        }
    }

    private static void migrate(DataSource dataSource, String schema) {
        var result = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(false)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        if (!result.success || result.migrationsExecuted < 12) {
            throw new AssertionError("Flyway did not apply real migrations through V12");
        }
    }

    private static void assertMigratedThroughV12(JdbcTemplate jdbc) {
        List<String> versions = jdbc.query("""
                SELECT version FROM flyway_schema_history
                 WHERE success = 1 AND version IS NOT NULL
                 ORDER BY installed_rank
                """, (rs, rowNum) -> rs.getString(1));
        if (versions.size() < VERSIONS.size() || !versions.subList(0, VERSIONS.size()).equals(VERSIONS)) {
            throw new AssertionError("Flyway did not apply real migrations V1 through V12");
        }
        assertEquals(0L, countRows(jdbc, "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0"));
        String script = jdbc.queryForObject(
                "SELECT script FROM flyway_schema_history WHERE version = '12' AND success = 1", String.class);
        if (!"V12__persist_bank_owner_snapshot_ref.sql".equals(script)) {
            throw new AssertionError("Flyway V12 script is not the owner snapshot migration");
        }
        if (jdbc.queryForList("SHOW COLUMNS FROM b10_assessment_session LIKE 'owner_snapshot_ref'").size() != 1) {
            throw new AssertionError("Flyway V12 owner snapshot column is missing");
        }
    }

    private static long count(JdbcTemplate jdbc, String table) {
        if (!table.matches("[a-z0-9_]+")) {
            throw new AssertionError("table name is invalid");
        }
        return countRows(jdbc, "SELECT COUNT(*) FROM `" + table + "`");
    }

    private static long countRows(JdbcTemplate jdbc, String sql) {
        Long count = jdbc.queryForObject(sql, Long.class);
        return count == null ? 0L : count;
    }

    private static <T> T owner(TransactionTemplate transactions, java.util.function.Supplier<T> work) {
        T value = transactions.execute(status -> {
            if (!TransactionSynchronizationManager.isActualTransactionActive() || !status.isNewTransaction()) {
                throw new IllegalStateException("owner transaction is not active");
            }
            return work.get();
        });
        if (value == null) {
            throw new AssertionError("owner transaction returned no result");
        }
        return value;
    }

    private static JwtAuthenticationToken learnerPrincipal() {
        Jwt jwt = Jwt.withTokenValue(SYNTHETIC)
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-11-06T00:00:00Z"))
                .expiresAt(Instant.parse("2026-11-06T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write", "assessment.session.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private static Authentication learningWorkload() {
        return serviceToken("learning-service", "service", List.of(), List.of(PERMISSION), PERMISSION);
    }

    private static Authentication learnerAccessToken() {
        return serviceToken(SUBJECT, "access", List.of("learner"),
                List.of("assessment.session.read", PERMISSION),
                "assessment.session.read " + PERMISSION);
    }

    private static Authentication serviceToken(String subject, String tokenType, List<String> roles,
                                               List<String> permissions, String scope) {
        Jwt jwt = Jwt.withTokenValue(SYNTHETIC)
                .header("alg", "RS256")
                .header("typ", "JWT")
                .subject(subject)
                .issuer("http://127.0.0.1:18087")
                .audience(List.of("yuxuexing-api"))
                .issuedAt(Instant.parse("2026-11-06T00:00:00Z"))
                .expiresAt(Instant.parse("2026-11-06T01:00:00Z"))
                .claim("service_id", "learning-service")
                .claim("client_id", "learning-service")
                .claim("token_type", tokenType)
                .claim("tenant_id", "platform")
                .claim("roles", roles)
                .claim("permissions", permissions)
                .claim("scope", scope)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("SCOPE_" + scope)), subject);
    }

    private static String url(String schema) {
        return ENDPOINT + schema
                + "?useUnicode=true"
                + "&characterEncoding=utf8"
                + "&useSSL=false"
                + "&serverTimezone=UTC"
                + "&connectionTimeZone=UTC"
                + "&forceConnectionTimeZoneToSession=true"
                + "&preserveInstants=true"
                + "&sendFractionalSeconds=true"
                + "&connectTimeout=5000"
                + "&socketTimeout=30000";
    }

    private static String dedicatedSchema(String value) {
        if (value.length() > 64 || !value.matches("asm_pin_[a-f0-9]+")) {
            throw new AssertionError("ASSESSMENT_PIN_TEST_SCHEMA is not a dedicated asm_pin schema");
        }
        return value;
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

    private record Produced(String gap, String attemptId, JsonNode body, Instant startedAt,
                            String reporting, String hash) {
        static Produced gap(String gap) {
            return new Produced(gap, null, null, null, null, null);
        }

        static Produced ready(String attemptId, JsonNode body, Instant startedAt, String reporting, String hash) {
            return new Produced(null, attemptId, body, startedAt, reporting, hash);
        }
    }
}
