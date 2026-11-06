package com.englishflow.content.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.GradableQuestions;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** JDBC reading opt-in snapshot and closed FULL/ZERO score. No answer material leaves the controller. */
class GradableAssessmentSnapshotControllerTest {

    private static final long VERSION = 1001L;
    private static final String CODE = "reading.unit.one";
    private static final String GRANTED = "[\"LEARNER\",\"ASSESSMENT\"]";
    private static final String CONTENT_ID = "reading-unit-one";
    private static final String SEAL = "0123456789abcdef".repeat(4);
    private static final String PATH = Long.toString(VERSION);

    private CountingJdbc jdbc;
    private GradableAssessmentSnapshotController controller;
    private JwtAuthenticationToken assessment;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:reading-score-" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new CountingJdbc(dataSource);
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(128),
                    content_code VARCHAR(128), content_epoch BIGINT, projection_version BIGINT,
                    current_published_version_id BIGINT)
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY, content_id VARCHAR(128), status VARCHAR(32),
                    payload_json VARCHAR(8000), published_at TIMESTAMP, archived_at TIMESTAMP,
                    copyright_status VARCHAR(32), rights_allows_learning BOOLEAN,
                    rights_source_code VARCHAR(128), rights_license_code VARCHAR(128),
                    rights_permitted_channels VARCHAR(256), rights_starts_at TIMESTAMP,
                    rights_expires_at TIMESTAMP, authorization_evidence_ref VARCHAR(128),
                    editor VARCHAR(128), first_reviewer VARCHAR(128), final_reviewer VARCHAR(128),
                    publisher VARCHAR(128))
                """);
        controller = new GradableAssessmentSnapshotController(jdbc, mapper);
        assessment = jwt("assessment-service", "service", "assessment-service",
                List.of(), List.of("content:answer-rules:read"));
        reset(GRANTED);
    }

    @Test
    @DisplayName("learner and other workloads are denied before the database")
    void workloadIsDeniedBeforeTheDatabase() {
        JdbcTemplate denying = new JdbcTemplate(new DriverManagerDataSource()) {
            @Override
            public List<Map<String, Object>> queryForList(String sql, Object... args) {
                throw new AssertionError("denied caller must not read the version");
            }
        };
        GradableAssessmentSnapshotController gated = new GradableAssessmentSnapshotController(denying, mapper);
        Map<String, Object> body = scoreBody(CODE, 9L, "beta", "snap_reading.unit.one-1001", "ab".repeat(32), "cd".repeat(32));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> gated.scoreB10AssessmentContentSnapshot(null, PATH, body));
        assertStatus(HttpStatus.FORBIDDEN, () -> gated.getB10AssessmentContentSnapshot(
                jwt("learner-1", "access", null, List.of("learner"), List.of("content.read")), PATH));
        assertStatus(HttpStatus.FORBIDDEN, () -> gated.scoreB10AssessmentContentSnapshot(
                jwt("learning-service", "service", "learning-service", List.of(), List.of("content:answer-rules:read")),
                PATH, body));
        assertStatus(HttpStatus.FORBIDDEN, () -> gated.scoreB10AssessmentContentSnapshot(
                jwt("assessment-service", "access", "assessment-service", List.of(), List.of("content:answer-rules:read")),
                PATH, body));
        assertStatus(HttpStatus.FORBIDDEN, () -> gated.scoreB10AssessmentContentSnapshot(
                jwt("assessment-service", "service", "learning-service", List.of(), List.of("content:answer-rules:read")),
                PATH, body));
        assertStatus(HttpStatus.FORBIDDEN, () -> gated.scoreB10AssessmentContentSnapshot(
                jwt("assessment-service", "service", "assessment-service", List.of(), List.of("content.read")),
                PATH, body));
        int reads = jdbc.reads;
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.getB10AssessmentContentSnapshot(assessment, "01"));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.scoreB10AssessmentContentSnapshot(assessment, PATH, Map.of(
                "contentCode", CODE, "itemId", "9", "selectedOptionId", "beta",
                "snapshotId", "snap_reading.unit.one-1001", "snapshotHash", "ab".repeat(32), "ruleDigest", "cd".repeat(32))));
        Map<String, Object> extra = new LinkedHashMap<>(body);
        extra.put("role", "learner");
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.scoreB10AssessmentContentSnapshot(assessment, PATH, extra));
        assertEquals(reads, jdbc.reads);
    }

    @Test
    @DisplayName("rights, four eyes, stale versions and the sealed bank fail closed")
    @SuppressWarnings("unchecked")
    void rightsActorsStaleAndUnavailableFailClosed() throws Exception {
        for (String channels : List.of("[\"LEARNER\",\"ASSESSMENT\"]", "[\"LEARNER\",\"SEALED\"]", "[\"*\"]")) {
            reset(channels);
            Map<String, Object> granted = snapshot();
            assertEquals(2, items(granted).size(), channels);
            assertEquals("snap_reading_" + VERSION, ((Map<?, ?>) granted.get("pin")).get("snapshotId"), channels);
            assertFalse(mapper.writeValueAsString(granted).contains(SEAL), channels);
        }
        for (String channels : List.of(
                "[\"LEARNER\"]", "[\"LEARNER\",\"PUBLIC\"]", "[\"SEALED\"]", "[\"ASSESSMENT\"]",
                "[\"PUBLIC\"]", "[\"ADMIN\"]", "[\"VIEW\"]")) {
            reset(channels);
            assertStatus(HttpStatus.FORBIDDEN, () -> snapshot(), channels);
        }

        reset(GRANTED);
        jdbc.update("UPDATE content_version SET rights_allows_learning = FALSE");
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshot());
        jdbc.update("UPDATE content_version SET rights_allows_learning = TRUE, copyright_status = 'REVOKED'");
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshot());
        jdbc.update("UPDATE content_version SET copyright_status = 'ACTIVE', rights_expires_at = ?",
                Timestamp.from(Instant.parse("2000-01-01T00:00:00Z")));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshot());
        jdbc.update("UPDATE content_version SET rights_expires_at = NULL, authorization_evidence_ref = NULL");
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshot());

        reset(GRANTED);
        jdbc.update("UPDATE content_version SET publisher = 'editor-1'");
        assertStatus(HttpStatus.GONE, () -> snapshot());
        jdbc.update("UPDATE content_version SET publisher = 'publisher-1', status = 'ARCHIVED'");
        assertStatus(HttpStatus.GONE, () -> snapshot());
        jdbc.update("UPDATE content_version SET status = 'PUBLISHED', archived_at = CURRENT_TIMESTAMP");
        assertStatus(HttpStatus.GONE, () -> snapshot());
        jdbc.update("UPDATE content_version SET archived_at = NULL");
        jdbc.update("UPDATE content_definition SET current_published_version_id = 1002");
        int before = jdbc.reads;
        assertStatus(HttpStatus.GONE, () -> snapshot());
        assertEquals(VERSION, ((Number) jdbc.args[1]).longValue());
        assertEquals(1, jdbc.reads - before);
        assertFalse(jdbc.sql.contains("current_published_version_id ="));
        assertFalse(jdbc.sql.contains("rights_proposed"));

        reset(GRANTED);
        jdbc.update("UPDATE content_definition SET content_code = ?", GradableQuestions.SEALED_CODE);
        assertStatus(HttpStatus.GONE, () -> snapshot());
        reset(GRANTED);
        jdbc.update("UPDATE content_definition SET content_id = ?", GradableQuestions.SEALED_OWNER_ID);
        jdbc.update("UPDATE content_version SET content_id = ?", GradableQuestions.SEALED_OWNER_ID);
        assertStatus(HttpStatus.GONE, () -> snapshot());

        reset(GRANTED);
        jdbc.update("UPDATE content_version SET payload_json = ?",
                mapper.writeValueAsString(Map.of("answerRule", Map.of("correctOption", "legacy-secret"))));
        assertStatus(HttpStatus.GONE, () -> snapshot());
        jdbc.update("UPDATE content_version SET payload_json = ?",
                "{\"" + GradableQuestions.FIELD + "\":[{\"itemId\":1}],\"" + GradableQuestions.SEAL_FIELD + "\":\"" + SEAL + "\"}");
        ResponseStatusException invalid = assertStatus(HttpStatus.GONE, () -> snapshot());
        assertFalse(String.valueOf(invalid.getReason()).contains(SEAL));
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.getB10AssessmentContentSnapshot(assessment, "9999"));
    }

    @Test
    @DisplayName("snapshot order and proofs stay stable and the score is only FULL or ZERO")
    @SuppressWarnings("unchecked")
    void snapshotStaysStableAnswerFreeAndScoresFullOrZero() throws Exception {
        Map<String, Object> first = snapshot();
        Map<String, Object> second = snapshot();
        assertEquals(first, second);
        Map<String, Object> pin = (Map<String, Object>) first.get("pin");
        assertEquals(Set.of("contentCode", "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash",
                "pinStatus", "pinnedAt", "recoveryReasonCode"), pin.keySet());
        assertEquals("PINNED", pin.get("pinStatus"));
        assertEquals("NONE", pin.get("recoveryReasonCode"));
        assertEquals("snap_reading_" + VERSION, pin.get("snapshotId"));
        assertEquals(CODE, pin.get("contentCode"));
        assertEquals(VERSION, ((Number) pin.get("contentVersionId")).longValue());
        assertEquals(4L, ((Number) pin.get("contentEpoch")).longValue());
        assertEquals(3L, ((Number) first.get("snapshotVersion")).longValue());
        assertEquals(pin.get("pinnedAt"), first.get("generatedAt"));
        assertFalse(pin.containsKey("fallbackVersionId"));

        List<Map<String, Object>> rows = items(first);
        assertEquals(9L, ((Number) rows.get(0).get("itemId")).longValue());
        assertEquals(2L, ((Number) rows.get(1).get("itemId")).longValue());
        assertEquals(0, ((Number) rows.get(0).get("displayOrder")).intValue());
        assertEquals(1, ((Number) rows.get(1).get("displayOrder")).intValue());
        assertEquals("READING", rows.get(0).get("itemType"));
        assertEquals("item.9", rows.get(0).get("itemCode"));
        assertEquals("Second", rows.get(0).get("stem"));
        List<Map<String, Object>> options = (List<Map<String, Object>>) rows.get(0).get("options");
        assertEquals(List.of("beta", "alpha"), List.of(options.get(0).get("optionId"), options.get(1).get("optionId")));
        assertEquals(List.of("L-beta", "R-alpha"), List.of(options.get(0).get("label"), options.get(1).get("label")));

        Map<String, Object> rule = (Map<String, Object>) rows.get(0).get("ruleContract");
        Map<String, Object> otherRule = (Map<String, Object>) rows.get(1).get("ruleContract");
        String digest = (String) rule.get("ruleDigest");
        String otherDigest = (String) otherRule.get("ruleDigest");
        String versionDigest = (String) first.get("answerRuleSetVersion");
        assertEquals(versionDigest, rule.get("answerRuleVersion"));
        assertEquals("DETERMINISTIC", rule.get("evaluationMode"));
        assertEquals(Boolean.TRUE, rule.get("sealed"));
        assertEquals("rule:reading.9", rule.get("ruleRef"));
        assertNotEquals(digest, otherDigest);
        assertEquals(hmac(SEAL, "item|" + VERSION + "|9|beta"), digest);
        assertEquals(hmac(SEAL, "item|" + VERSION + "|2|aye"), otherDigest);
        assertEquals(hmac(SEAL, "version|" + VERSION + "|" + CODE + "|" + digest + "," + otherDigest), versionDigest);
        assertNotEquals(sha256("beta"), digest);
        assertNotEquals(sha256("item|" + VERSION + "|9|beta"), digest);
        assertNotEquals(sha256(SEAL), digest);
        assertEquals(pin.get("snapshotHash"), ContentPayloadHash.sha256(canonical(first)));
        assertQueryShape();

        String json = mapper.writeValueAsString(first);
        assertFalse(json.contains(SEAL), json);
        assertFalse(json.contains("\"correctOption\""), json);
        assertFalse(json.contains("\"answerRule\""), json);
        assertFalse(json.contains("readingRuleSeal"), json);
        assertFalse(json.contains("legacy-secret"), json);

        Map<String, Object> full = score(9L, "beta", pin, digest);
        Map<String, Object> zero = score(9L, "alpha", pin, digest);
        Map<String, Object> replay = score(9L, "beta", pin, digest);
        assertEquals(Set.of("itemId", "snapshotId", "ruleDigest", "outcome"), full.keySet());
        assertEquals("FULL", full.get("outcome"));
        assertEquals("ZERO", zero.get("outcome"));
        assertEquals(full, replay);
        assertEquals(pin.get("snapshotId"), full.get("snapshotId"));
        assertEquals(digest, full.get("ruleDigest"));
        String scored = mapper.writeValueAsString(Map.of("full", full, "zero", zero));
        assertFalse(scored.contains("beta"), scored);
        assertFalse(scored.contains("alpha"), scored);
        assertFalse(scored.contains("legacy-secret"), scored);
        assertFalse(scored.contains(SEAL), scored);
        assertFalse(scored.contains("correctOption"), scored);
        assertFalse(scored.contains("readingRuleSeal"), scored);

        Map<String, Object> wrongHash = new LinkedHashMap<>(pin);
        String hash = (String) pin.get("snapshotHash");
        wrongHash.put("snapshotHash", hash.substring(0, 63) + (hash.charAt(63) == '0' ? '1' : '0'));
        ResponseStatusException mismatch = assertStatus(HttpStatus.CONFLICT, () -> score(9L, "beta", wrongHash, digest));
        assertFalse(String.valueOf(mismatch.getReason()).contains("beta"));
        assertStatus(HttpStatus.CONFLICT, () -> score(9L, "beta", pin, otherDigest));
        Map<String, Object> wrongId = new LinkedHashMap<>(pin);
        wrongId.put("snapshotId", "snap_reading_1002");
        assertStatus(HttpStatus.CONFLICT, () -> score(9L, "beta", wrongId, digest));
        Map<String, Object> wrongCode = new LinkedHashMap<>(pin);
        wrongCode.put("contentCode", "reading.unit.two");
        assertStatus(HttpStatus.CONFLICT, () -> score(9L, "beta", wrongCode, digest));
        assertStatus(HttpStatus.GONE, () -> score(99L, "beta", pin, digest));

        reset(GRANTED, "Changed", "beta");
        Map<String, Object> changedStem = snapshot();
        assertNotEquals(pin.get("snapshotHash"), ((Map<?, ?>) changedStem.get("pin")).get("snapshotHash"));
        assertEquals(digest, ((Map<?, ?>) items(changedStem).get(0).get("ruleContract")).get("ruleDigest"));
        assertTrue(mapper.writeValueAsString(changedStem).contains("Changed"));

        reset(GRANTED, "Second", "alpha");
        Map<String, Object> changedAnswer = snapshot();
        String shifted = (String) ((Map<?, ?>) items(changedAnswer).get(0).get("ruleContract")).get("ruleDigest");
        assertNotEquals(digest, shifted);
        assertEquals(hmac(SEAL, "item|" + VERSION + "|9|alpha"), shifted);
        String answerJson = mapper.writeValueAsString(changedAnswer);
        assertFalse(answerJson.contains("\"correctOption\""));
        assertFalse(answerJson.contains(SEAL));
        assertTrue(answerJson.contains("beta"));
        assertTrue(answerJson.contains("alpha"));
    }

    @Test
    @DisplayName("snapshot id is snap_reading_<versionId> at the code and int64 bounds")
    @SuppressWarnings("unchecked")
    void snapshotIdStaysInsideTheContractAtLegalBounds() throws Exception {
        String longCode = "r" + "a".repeat(127);
        assertEquals(128, longCode.length());
        assertBoundedSnapshot(1L, longCode);
        assertBoundedSnapshot(Long.MAX_VALUE, longCode);
    }

    @SuppressWarnings("unchecked")
    private void assertBoundedSnapshot(long versionId, String code) throws Exception {
        seed(versionId, code, GRANTED, "Second", "beta");
        String path = Long.toString(versionId);
        Map<String, Object> data = (Map<String, Object>) controller
                .getB10AssessmentContentSnapshot(assessment, path).get("data");
        assertEquals(data, (Map<String, Object>) controller
                .getB10AssessmentContentSnapshot(assessment, path).get("data"), path);
        Map<String, Object> pin = (Map<String, Object>) data.get("pin");
        String snapshotId = "snap_reading_" + versionId;
        String legacy = "snap_" + code + "-" + versionId;
        assertEquals(snapshotId, pin.get("snapshotId"));
        assertTrue(snapshotId.matches("snap_[A-Za-z0-9._:-]{8,127}"), snapshotId);
        assertFalse(legacy.matches("snap_[A-Za-z0-9._:-]{8,127}"), legacy);
        assertEquals(code, pin.get("contentCode"));
        assertEquals(versionId, ((Number) pin.get("contentVersionId")).longValue());
        assertFalse(snapshotId.contains(code));

        List<Map<String, Object>> rows = items(data);
        Map<String, Object> rule = (Map<String, Object>) rows.get(0).get("ruleContract");
        Map<String, Object> otherRule = (Map<String, Object>) rows.get(1).get("ruleContract");
        String digest = (String) rule.get("ruleDigest");
        String otherDigest = (String) otherRule.get("ruleDigest");
        assertEquals(hmac(SEAL, "item|" + versionId + "|9|beta"), digest);
        assertEquals(hmac(SEAL, "item|" + versionId + "|2|aye"), otherDigest);
        assertEquals(hmac(SEAL, "version|" + versionId + "|" + code + "|" + digest + "," + otherDigest),
                data.get("answerRuleSetVersion"));
        assertEquals(pin.get("snapshotHash"), ContentPayloadHash.sha256(canonical(data)));

        String json = mapper.writeValueAsString(data);
        assertFalse(json.contains(SEAL), json);
        assertFalse(json.contains("\"correctOption\""), json);
        assertFalse(json.contains("readingRuleSeal"), json);

        Map<String, Object> full = score(9L, "beta", pin, digest);
        Map<String, Object> zero = score(9L, "alpha", pin, digest);
        assertEquals(Set.of("itemId", "snapshotId", "ruleDigest", "outcome"), full.keySet());
        assertEquals("FULL", full.get("outcome"));
        assertEquals("ZERO", zero.get("outcome"));
        assertEquals(snapshotId, full.get("snapshotId"));
        String scored = mapper.writeValueAsString(zero);
        assertFalse(scored.contains("correctOption"), scored);
        assertFalse(scored.contains(SEAL), scored);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> snapshot() {
        return (Map<String, Object>) controller.getB10AssessmentContentSnapshot(assessment, PATH).get("data");
    }

    private Map<String, Object> score(long itemId, String selected, Map<String, Object> pin, String digest) {
        String path = Long.toString(((Number) pin.get("contentVersionId")).longValue());
        return controller.scoreB10AssessmentContentSnapshot(assessment, path, scoreBody(
                String.valueOf(pin.get("contentCode")), itemId, selected,
                String.valueOf(pin.get("snapshotId")), String.valueOf(pin.get("snapshotHash")), digest));
    }

    private static Map<String, Object> scoreBody(
            String contentCode, long itemId, String selected, String snapshotId, String snapshotHash, String digest) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contentCode", contentCode);
        body.put("itemId", itemId);
        body.put("selectedOptionId", selected);
        body.put("snapshotId", snapshotId);
        body.put("snapshotHash", snapshotHash);
        body.put("ruleDigest", digest);
        return body;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> data) {
        return (List<Map<String, Object>>) data.get("items");
    }

    private static Map<String, Object> canonical(Map<String, Object> data) {
        Map<?, ?> pin = (Map<?, ?>) data.get("pin");
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("answerRuleSetVersion", data.get("answerRuleSetVersion"));
        canonical.put("contentCode", pin.get("contentCode"));
        canonical.put("contentEpoch", ((Number) pin.get("contentEpoch")).longValue());
        canonical.put("contentVersionId", ((Number) pin.get("contentVersionId")).longValue());
        canonical.put("items", data.get("items"));
        canonical.put("publishedAt", pin.get("pinnedAt"));
        canonical.put("snapshotId", pin.get("snapshotId"));
        return canonical;
    }

    private void assertQueryShape() {
        String sql = jdbc.sql;
        assertTrue(sql.contains("v.content_version_id = ?"));
        assertTrue(sql.contains("c.tenant_id = ?"));
        assertTrue(sql.contains("current_published_version_id"));
        assertTrue(sql.contains("copyright_status"));
        assertTrue(sql.contains("rights_allows_learning"));
        assertTrue(sql.contains("rights_source_code"));
        assertTrue(sql.contains("rights_license_code"));
        assertTrue(sql.contains("authorization_evidence_ref"));
        assertTrue(sql.contains("rights_permitted_channels"));
        assertTrue(sql.contains("rights_starts_at"));
        assertTrue(sql.contains("rights_expires_at"));
        assertTrue(sql.contains("first_reviewer"));
        assertTrue(sql.contains("final_reviewer"));
        assertTrue(sql.contains("publisher"));
        assertFalse(sql.contains("rights_proposed"));
        assertFalse(sql.contains("current_published_version_id ="));
        assertEquals("platform", jdbc.args[0]);
        assertEquals(VERSION, ((Number) jdbc.args[1]).longValue());
        assertEquals("platform", jdbc.args[2]);
    }

    private void reset(String channels) throws Exception {
        reset(channels, "Second", "beta");
    }

    private void reset(String channels, String stem, String correct) throws Exception {
        seed(VERSION, CODE, channels, stem, correct);
    }

    private void seed(long versionId, String code, String channels, String stem, String correct) throws Exception {
        jdbc.update("DELETE FROM content_version");
        jdbc.update("DELETE FROM content_definition");
        jdbc.update("""
                INSERT INTO content_definition
                    (content_id, tenant_id, content_code, content_epoch, projection_version,
                     current_published_version_id)
                VALUES (?, 'platform', ?, 4, 3, ?)
                """, CONTENT_ID, code, versionId);
        jdbc.update("""
                INSERT INTO content_version (
                    content_version_id, content_id, status, payload_json, published_at, archived_at,
                    copyright_status, rights_allows_learning, rights_source_code, rights_license_code,
                    rights_permitted_channels, rights_starts_at, rights_expires_at,
                    authorization_evidence_ref, editor, first_reviewer, final_reviewer, publisher)
                VALUES (?, ?, 'PUBLISHED', ?, TIMESTAMP '2026-04-01 08:00:00', NULL,
                        'ACTIVE', TRUE, 'publisher-source', 'licensed-use', ?,
                        NULL, NULL, 'approved-rights-record',
                        'editor-1', 'reviewer-1', 'reviewer-2', 'publisher-1')
                """, versionId, CONTENT_ID, payload(stem, correct), channels);
    }

    private String payload(String stem, String correct) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("summary", "Reading");
        body.put(GradableQuestions.FIELD, List.of(
                question(9, stem, "beta", "alpha", correct),
                question(2, "First", "aye", "bee", "aye")));
        body.put(GradableQuestions.SEAL_FIELD, SEAL);
        body.put("answerRule", Map.of("correctOption", "legacy-secret"));
        return mapper.writeValueAsString(body);
    }

    private static Map<String, Object> question(
            long itemId, String stem, String left, String right, String correct) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("itemId", itemId);
        question.put("stem", stem);
        question.put("options", List.of(
                Map.of("optionId", left, "label", "L-" + left),
                Map.of("optionId", right, "label", "R-" + right)));
        question.put("answerRule", Map.of("correctOption", correct));
        return question;
    }

    private static ResponseStatusException assertStatus(HttpStatus status, Runnable call) {
        return assertStatus(status, call, null);
    }

    private static ResponseStatusException assertStatus(HttpStatus status, Runnable call, String message) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, call::run, message);
        assertEquals(status, error.getStatusCode(), message);
        return error;
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String hmac(String seal, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(HexFormat.of().parseHex(seal), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

    private static JwtAuthenticationToken jwt(
            String subject, String tokenType, String serviceId, List<String> roles, List<String> permissions) {
        Jwt.Builder builder = Jwt.withTokenValue("token-" + subject).header("alg", "RS256")
                .subject(subject).issuedAt(Instant.parse("2026-11-06T00:00:00Z"))
                .expiresAt(Instant.parse("2026-11-06T00:05:00Z"))
                .claim("tenant_id", "platform").claim("token_type", tokenType)
                .claim("roles", roles).claim("permissions", permissions);
        if (serviceId != null) {
            builder.claim("service_id", serviceId);
        }
        if ("access".equals(tokenType) && roles.contains("learner")) {
            builder.claim("adult_gate", "PASSED").claim("consent_state", "GRANTED");
        }
        Jwt token = builder.build();
        return new JwtAuthenticationToken(token, Set.of(), subject);
    }

    private static final class CountingJdbc extends JdbcTemplate {
        private int reads;
        private String sql;
        private Object[] args;

        private CountingJdbc(DriverManagerDataSource dataSource) {
            super(dataSource);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            this.reads++;
            this.sql = sql;
            this.args = args;
            return super.queryForList(sql, args);
        }

        @Override
        public int update(String sql, Object... args) {
            String command = sql.stripLeading().toUpperCase(java.util.Locale.ROOT);
            if (command.startsWith("DELETE") || command.startsWith("INSERT") || command.startsWith("UPDATE")) {
                return super.update(sql, args);
            }
            throw new AssertionError("snapshot read must not write");
        }
    }
}
