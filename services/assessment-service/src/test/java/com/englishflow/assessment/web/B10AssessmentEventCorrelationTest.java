package com.englishflow.assessment.web;

import com.englishflow.assessment.port.PlacementRuleScorePort;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Submit-attempt correlation is observability only. Canonical X-Request-Id and
 * X-Trace-Id propagate; absent or malformed values are replaced once per write.
 * B105 / MB-013: canonical D2 {@code assessment.item.assessed.v2} is one owner
 * fact for each item actually submitted on the current attempt.
 */
class B10AssessmentEventCorrelationTest {

    private static final String SUBJECT = "prn_learner0000000001";
    private static final String OWNER_PIN = "snap_owner_b95_pin";
    private static final String CANONICAL_REQUEST = "req-b10-corr-01";
    private static final String CANONICAL_TRACE = "0123456789abcdef0123456789abcdef";
    private static final Pattern REQUEST_ID = Pattern.compile("^[A-Za-z][A-Za-z0-9._-]{7,127}$");
    private static final Pattern TRACE_ID = Pattern.compile("^[a-f0-9]{32}$");
    private static final Pattern EVENT_UUID = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final List<String> EVENT_NAMES = List.of(
            "assessment.item.assessed.v2",
            "learning.report.ready.v1",
            "learning.mistake.admitted.v1",
            "learning.practice.completed.v1");

    @Test
    void canonicalHeadersPropagateAsOnePairAndReplayDoesNotRewrite() throws Exception {
        Harness harness = new Harness();
        String sessionId = "asess_corr_propagate";
        String submissionId = "sub_b10_kept_0001";
        Map<String, Object> response = harness.submit(sessionId, submissionId, "idem-propagate",
                CANONICAL_REQUEST, CANONICAL_TRACE);
        List<JsonNode> events = harness.envelopes(0);

        assertEquals("ZERO", data(response).get("scoreBucket"));
        assertFalse(data(response).containsKey("requestId"));
        assertFalse(data(response).containsKey("traceId"));
        assertPair(events, CANONICAL_REQUEST, CANONICAL_TRACE, sessionId, submissionId);
        assertEquals(OWNER_PIN, events.get(0).path("payload").path("contentPin").path("snapshotId").asText());

        Map<String, Object> replay = harness.submit(sessionId, submissionId, "idem-propagate",
                "req-replay-ignored", CANONICAL_TRACE);
        assertEquals(data(response).get("attemptId"), data(replay).get("attemptId"));
        assertEquals(4, harness.jdbc.events.size());
    }

    @Test
    void absentOrMalformedHeadersMintOneCanonicalPairPerWrite() throws Exception {
        Harness harness = new Harness();
        String malformedRequest = "sub_bad:colon_1";
        String malformedTrace = "ABCDEF0123456789ABCDEF0123456789";
        harness.submit("asess_corr_malformed", malformedRequest, "idem-malformed", malformedRequest, malformedTrace);
        List<JsonNode> malformed = harness.envelopes(0);
        String mintedRequest = malformed.get(0).path("requestId").asText();
        String mintedTrace = malformed.get(0).path("traceId").asText();

        assertPair(malformed, mintedRequest, mintedTrace, "asess_corr_malformed", malformedRequest);
        assertNotEquals(malformedRequest, mintedRequest);
        assertNotEquals(malformedTrace, mintedTrace);
        assertTrue(mintedRequest.startsWith("req_"));

        harness.submit("asess_corr_absent", "sub_b10_absent_0001", "idem-absent", null, null);
        List<JsonNode> absent = harness.envelopes(4);
        assertPair(absent, absent.get(0).path("requestId").asText(), absent.get(0).path("traceId").asText(),
                "asess_corr_absent", "sub_b10_absent_0001");
        assertNotEquals(mintedRequest, absent.get(0).path("requestId").asText());
        assertNotEquals(mintedTrace, absent.get(0).path("traceId").asText());
    }

    /**
     * B105 / MB-013. A partial submit emits D2 {@code assessment.item.assessed.v2}
     * only for the item graded on this attempt. A previously answered sibling and
     * an untouched sibling stay off the new attempt. The same key replays that attempt.
     */
    @Test
    void partialSubmitEmitsOnlyTheAttemptedItemAndReplaysThatAttempt() throws Exception {
        Harness harness = partialHarness();
        Map<String, Object> first = submitPartial(harness, "idem-b105-partial");
        String attemptId = String.valueOf(data(first).get("attemptId"));
        List<JsonNode> events = harness.envelopes(0);
        List<JsonNode> assessedEvents = assessed(events);

        assertEquals("ZERO", data(first).get("scoreBucket"));
        assertEquals(1L, ((Number) data(first).get("itemCount")).longValue());
        assertEquals(1, assessedEvents.size());
        assertEquals(List.of("assessment.item.assessed.v2", "learning.report.ready.v1"),
                events.stream().map(event -> event.path("eventName").asText()).toList());
        assertOwnerFact(assessedEvents.get(0), attemptId, "asess_b105_partial");
        assertEquals("li_10010000", assessedEvents.get(0).path("payload").path("logicalItemId").asText());
        assertTuple(assessedEvents.get(0).path("payload"), "INCORRECT", 0, false, "NO_MATCH");
        JsonNode report = events.get(1).path("payload");
        assertEquals("PARTIAL", report.path("scoreBucket").asText());
        assertEquals(3, report.path("totalItems").asInt());
        assertEquals(1, report.path("totalCorrect").asInt());
        assertEquals(2, report.path("totalMistakes").asInt());
        assertEquals(attemptId, report.path("attemptId").asText());

        Map<String, Object> replay = submitPartial(harness, "idem-b105-partial");
        assertEquals(attemptId, data(replay).get("attemptId"));
        assertEquals(1, harness.jdbc.attempts.size());
        assertEquals(events.size(), harness.jdbc.events.size());
        assertEquals(1, assessed(harness.envelopes(0)).size());
    }

    /**
     * Real grades keep the current score buckets. An explicit blank stays a miss
     * and emits the D2 UNANSWERED tuple (0/1, false, false).
     */
    @Test
    void submittedGradeEmitsCorrectIncorrectOrBlankUnanswered() throws Exception {
        assertSubmittedOutcome("A", "FULL", "CORRECT_VERIFIED", 1, true, "FULL_MATCH", false);
        assertSubmittedOutcome("B", "ZERO", "INCORRECT", 0, false, "NO_MATCH", true);
        assertSubmittedOutcome("", "ZERO", "UNANSWERED", 0, false, "UNANSWERED", true);
    }

    /**
     * The same canonical rule via numeric id and itemCode is rejected before an
     * attempt or event. A single alias still grades. An item outside the session
     * pin is rejected without another attempt or event.
     */
    @Test
    void duplicateAliasesAndOutOfSessionItemsCreateNoAttemptOrEvent() throws Exception {
        Harness duplicates = new Harness();
        ResponseStatusException duplicated = assertThrows(ResponseStatusException.class, () -> duplicates.submitItems(
                "asess_b105_dup", "sub_b105_dup", "idem-b105-dup",
                List.of(
                        Map.of("itemId", 1001, "response", "A"),
                        Map.of("itemId", 42, "itemCode", "1001", "response", "B")),
                CANONICAL_REQUEST, CANONICAL_TRACE));
        assertEquals(400, duplicated.getStatusCode().value());
        assertEquals("assessment item was submitted more than once", duplicated.getReason());
        assertEquals(0, duplicates.jdbc.attempts.size());
        assertEquals(0, duplicates.jdbc.events.size());

        Harness aliased = new Harness();
        Map<String, Object> alias = aliased.submitItems(
                "asess_b105_alias", "sub_b105_alias", "idem-b105-alias",
                List.of(Map.of("itemId", 42, "itemCode", "1001", "response", "A")),
                CANONICAL_REQUEST, CANONICAL_TRACE);
        assertEquals("FULL", data(alias).get("scoreBucket"));
        assertEquals(1L, ((Number) data(alias).get("itemCount")).longValue());
        List<JsonNode> aliasEvents = assessed(aliased.envelopes(0));
        assertEquals(1, aliasEvents.size());
        assertEquals("li_10010000", aliasEvents.get(0).path("payload").path("logicalItemId").asText());
        assertTuple(aliasEvents.get(0).path("payload"), "CORRECT_VERIFIED", 1, true, "FULL_MATCH");
        assertOwnerFact(aliasEvents.get(0), String.valueOf(data(alias).get("attemptId")), "asess_b105_alias");

        Harness stable = new Harness(new FakeJdbc(
                List.of(answerRule("stem-item", "A")),
                sessionItems("stem-item"),
                "{}"));
        Map<String, Object> byCode = stable.submitItems(
                "asess_b105_code", "sub_b105_code", "idem-b105-code",
                List.of(Map.of("itemCode", "stem-item", "response", "A")),
                CANONICAL_REQUEST, CANONICAL_TRACE);
        assertEquals("FULL", data(byCode).get("scoreBucket"));
        List<JsonNode> codeEvents = assessed(stable.envelopes(0));
        assertEquals(1, codeEvents.size());
        assertEquals("li_stem-item", codeEvents.get(0).path("payload").path("logicalItemId").asText());
        assertOwnerFact(codeEvents.get(0), String.valueOf(data(byCode).get("attemptId")), "asess_b105_code");

        Harness outside = new Harness(new FakeJdbc(
                List.of(answerRule("1001", "A"), answerRule("1003", "C")),
                sessionItems("1001"),
                "{}"));
        outside.submitItems("asess_b105_out", "sub_b105_kept", "idem-b105-kept",
                List.of(Map.of("itemId", 1001, "response", "B")),
                CANONICAL_REQUEST, CANONICAL_TRACE);
        int attempts = outside.jdbc.attempts.size();
        int events = outside.jdbc.events.size();
        assertEquals(1, attempts);
        assertTrue(events > 0);
        ResponseStatusException rejected = assertThrows(ResponseStatusException.class, () -> outside.submitItems(
                "asess_b105_out", "sub_b105_out", "idem-b105-out",
                List.of(Map.of("itemId", 1003, "response", "C")),
                CANONICAL_REQUEST, CANONICAL_TRACE));
        assertEquals(404, rejected.getStatusCode().value());
        assertEquals("assessment item is unavailable", rejected.getReason());
        assertEquals(attempts, outside.jdbc.attempts.size());
        assertEquals(events, outside.jdbc.events.size());
    }

    /**
     * A sealed score is read once for the submitted answer. The canonical event
     * and the cumulative report both use that result. Earlier answers stay on
     * the local report grade, and an untouched item stays a report mistake.
     */
    @Test
    void sealedScoreIsReadOnceAndMatchesTheCurrentReport() throws Exception {
        OnceScorer blocked = new OnceScorer();
        Harness rejected = new Harness(new FakeJdbc(
                List.of(placementRule("1001"), answerRule("1002", "A"), answerRule("1003", "A")),
                sessionItems("1001", "1002", "1003"),
                "{\"1002\":\"A\"}"), blocked);
        ResponseStatusException duplicate = assertThrows(ResponseStatusException.class, () -> rejected.submitItems(
                "asess_b105_once_dup", "sub_b105_once_dup", "idem-b105-once-dup",
                List.of(
                        Map.of("itemId", 1001, "response", "A"),
                        Map.of("itemId", 42, "itemCode", "1001", "response", "B")),
                CANONICAL_REQUEST, CANONICAL_TRACE));
        assertEquals(400, duplicate.getStatusCode().value());
        assertEquals(0, blocked.calls);
        assertEquals(0, rejected.jdbc.attempts.size());
        assertEquals(0, rejected.jdbc.events.size());

        OnceScorer outsideScore = new OnceScorer();
        Harness outside = new Harness(new FakeJdbc(
                List.of(placementRule("1001"), placementRule("1009")),
                sessionItems("1001"),
                "{}"), outsideScore);
        ResponseStatusException missing = assertThrows(ResponseStatusException.class, () -> outside.submitItems(
                "asess_b105_once_out", "sub_b105_once_out", "idem-b105-once-out",
                List.of(Map.of("itemId", 1009, "response", "A")),
                CANONICAL_REQUEST, CANONICAL_TRACE));
        assertEquals(404, missing.getStatusCode().value());
        assertEquals(0, outsideScore.calls);
        assertEquals(0, outside.jdbc.attempts.size());
        assertEquals(0, outside.jdbc.events.size());

        OnceScorer scores = new OnceScorer();
        Harness harness = new Harness(new FakeJdbc(
                List.of(placementRule("1001"), answerRule("1002", "A"), answerRule("1003", "A")),
                sessionItems("1001", "1002", "1003"),
                "{\"1002\":\"A\"}"), scores);
        Map<String, Object> response = harness.submitItems(
                "asess_b105_once", "sub_b105_once", "idem-b105-once",
                List.of(Map.of("itemId", 1001, "response", "A")),
                CANONICAL_REQUEST, CANONICAL_TRACE);
        assertEquals(1, scores.calls);
        assertEquals("FULL", data(response).get("scoreBucket"));
        assertEquals(1L, ((Number) data(response).get("itemCount")).longValue());
        List<JsonNode> events = harness.envelopes(0);
        List<JsonNode> assessedEvents = assessed(events);
        assertEquals(List.of("assessment.item.assessed.v2", "learning.report.ready.v1"),
                events.stream().map(event -> event.path("eventName").asText()).toList());
        assertEquals(1, assessedEvents.size());
        assertEquals("li_10010000", assessedEvents.get(0).path("payload").path("logicalItemId").asText());
        assertTuple(assessedEvents.get(0).path("payload"), "CORRECT_VERIFIED", 1, true, "FULL_MATCH");
        assertOwnerFact(assessedEvents.get(0), String.valueOf(data(response).get("attemptId")), "asess_b105_once");
        JsonNode report = events.get(1).path("payload");
        assertEquals("PARTIAL", report.path("scoreBucket").asText());
        assertEquals(3, report.path("totalItems").asInt());
        assertEquals(2, report.path("totalCorrect").asInt());
        assertEquals(1, report.path("totalMistakes").asInt());
        assertEquals(data(response).get("attemptId"), report.path("attemptId").asText());
        assertEquals(1, scores.calls);
    }

    private static void assertPair(List<JsonNode> events, String requestId, String traceId, String sessionId,
            String submissionId) {
        assertEquals(EVENT_NAMES, events.stream().map(event -> event.path("eventName").asText()).toList());
        assertTrue(REQUEST_ID.matcher(requestId).matches());
        assertTrue(TRACE_ID.matcher(traceId).matches());
        assertNotEquals(submissionId, requestId);
        assertNotEquals(submissionId, traceId);
        assertNotEquals(requestId, traceId);
        for (JsonNode event : events) {
            assertEquals(requestId, event.path("requestId").asText());
            assertEquals(traceId, event.path("traceId").asText());
            assertEquals(SUBJECT, event.path("actorId").asText());
            String dedupeKey = event.path("dedupeKey").asText();
            assertNotEquals(requestId, dedupeKey);
            assertNotEquals(traceId, dedupeKey);
            assertFalse(dedupeKey.contains(requestId));
            assertFalse(dedupeKey.contains(traceId));
            assertTrue(EVENT_UUID.matcher(event.path("eventId").asText()).matches());
        }
        assertTrue(events.get(0).path("dedupeKey").asText().startsWith("aatm_"));
        assertTrue(events.get(1).path("dedupeKey").asText().startsWith("rpt_"));
        assertTrue(events.get(2).path("dedupeKey").asText().startsWith("mistake-admitted:"));
        assertEquals("practice-complete:" + sessionId, events.get(3).path("dedupeKey").asText());
        assertEquals(SUBJECT, events.get(0).path("payload").path("principalId").asText());
    }

    private void assertSubmittedOutcome(String response, String scoreBucket, String outcome, int numerator,
            boolean objectiveCorrect, String reasonCode, boolean admitsMistake) throws Exception {
        Harness harness = new Harness();
        String sessionId = "asess_b105_" + outcome;
        Map<String, Object> body = harness.submitItems(sessionId, "sub_b105_" + outcome, "idem-b105-" + outcome,
                List.of(Map.of("itemId", 1001, "response", response)), CANONICAL_REQUEST, CANONICAL_TRACE);
        assertEquals(scoreBucket, data(body).get("scoreBucket"));
        assertEquals(1L, ((Number) data(body).get("itemCount")).longValue());
        List<JsonNode> events = harness.envelopes(0);
        List<JsonNode> assessedEvents = assessed(events);
        assertEquals(1, assessedEvents.size());
        String attemptId = String.valueOf(data(body).get("attemptId"));
        assertOwnerFact(assessedEvents.get(0), attemptId, sessionId);
        assertEquals("li_10010000", assessedEvents.get(0).path("payload").path("logicalItemId").asText());
        assertTuple(assessedEvents.get(0).path("payload"), outcome, numerator, objectiveCorrect, reasonCode);
        assertEquals(admitsMistake, events.stream().anyMatch(event ->
                "learning.mistake.admitted.v1".equals(event.path("eventName").asText())));
        assertEquals(1, harness.jdbc.attempts.size());
    }

    private static List<JsonNode> assessed(List<JsonNode> events) {
        return events.stream()
                .filter(event -> "assessment.item.assessed.v2".equals(event.path("eventName").asText()))
                .toList();
    }

    private static void assertOwnerFact(JsonNode event, String attemptId, String sessionId) {
        assertEquals("assessment.item.assessed.v2", event.path("eventName").asText());
        assertEquals("assessment.event.v2", event.path("schema").asText());
        assertEquals(2, event.path("version").asInt());
        assertEquals(SUBJECT, event.path("actorId").asText());
        assertEquals(CANONICAL_REQUEST, event.path("requestId").asText());
        assertEquals(CANONICAL_TRACE, event.path("traceId").asText());
        assertTrue(event.path("dedupeKey").asText().startsWith(attemptId + ":"));
        JsonNode payload = event.path("payload");
        assertEquals(SUBJECT, payload.path("principalId").asText());
        assertEquals(attemptId, payload.path("attemptId").asText());
        assertEquals(sessionId, payload.path("sessionId").asText());
        assertEquals(OWNER_PIN, payload.path("contentPin").path("snapshotId").asText());
    }

    private static void assertTuple(JsonNode payload, String outcome, int numerator, boolean objectiveCorrect,
            String reasonCode) {
        assertEquals(outcome, payload.path("objectiveOutcome").asText());
        assertEquals(numerator, payload.path("objectiveNumerator").asInt());
        assertEquals(1, payload.path("objectiveDenominator").asInt());
        assertEquals(objectiveCorrect, payload.path("objectiveCorrect").asBoolean());
        assertFalse(payload.path("guessSignal").asBoolean());
        assertEquals("UNCLASSIFIED", payload.path("semanticErrorCategory").asText());
        assertEquals(reasonCode, payload.path("reasonTrace").get(0).path("reasonCode").asText());
    }

    private static Harness partialHarness() {
        return new Harness(new FakeJdbc(
                List.of(answerRule("1001", "A"), answerRule("1002", "A"), answerRule("1003", "B")),
                sessionItems("1001", "1002", "1003"),
                "{\"1002\":\"A\"}"));
    }

    private static Map<String, Object> submitPartial(Harness harness, String key) {
        return harness.submitItems("asess_b105_partial", "sub_b105_partial", key,
                List.of(Map.of("itemId", 1001, "response", "B")),
                CANONICAL_REQUEST, CANONICAL_TRACE);
    }

    private static Map<String, Object> answerRule(String itemId, String answer) {
        return Map.of("item_id", itemId, "answer_rule_json", "{\"answer\":\"" + answer + "\"}");
    }

    private static Map<String, Object> placementRule(String itemId) {
        return Map.of("item_id", itemId, "answer_rule_json", "{\"grader\":\"PLACEMENT_SCORE\"}");
    }

    private static String sessionItems(String... itemCodes) {
        StringBuilder builder = new StringBuilder("[");
        for (int index = 0; index < itemCodes.length; index++) {
            if (index > 0) builder.append(',');
            String code = itemCodes[index];
            String itemId = code.chars().allMatch(Character::isDigit) ? code : "1";
            builder.append("{\"itemId\":").append(itemId)
                    .append(",\"itemCode\":\"").append(code)
                    .append("\",\"itemType\":\"VOCABULARY\"}");
        }
        return builder.append(']').toString();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> response) {
        return (Map<String, Object>) response.get("data");
    }

    private static final class Harness {
        private final ObjectMapper mapper;
        private final FakeJdbc jdbc;
        private final B10AssessmentJdbcController controller;

        private Harness() {
            this(new FakeJdbc());
        }

        private Harness(FakeJdbc jdbc) {
            this(jdbc, null);
        }

        private Harness(FakeJdbc jdbc, PlacementRuleScorePort scores) {
            this.mapper = new ObjectMapper();
            this.jdbc = jdbc;
            this.controller = new B10AssessmentJdbcController(jdbc, mapper, "http://127.0.0.1:9", scores);
        }

        private Map<String, Object> submit(String sessionId, String submissionId, String key, String requestId,
                String traceId) {
            return submitItems(sessionId, submissionId, key,
                    List.of(Map.of("itemId", 1001, "response", "B")), requestId, traceId);
        }

        private Map<String, Object> submitItems(String sessionId, String submissionId, String key,
                List<Map<String, Object>> items, String requestId, String traceId) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("submissionId", submissionId);
            body.put("items", items);
            return controller.submitAttempt(learner(), sessionId, body, key, requestId, traceId);
        }

        private List<JsonNode> envelopes(int from) throws Exception {
            List<JsonNode> events = new ArrayList<>();
            for (Captured captured : jdbc.events.subList(from, jdbc.events.size())) {
                JsonNode event = mapper.readTree(captured.payloadJson());
                assertEquals(captured.columnEventId(), event.path("eventId").asText());
                assertEquals(captured.columnRequestId(), event.path("requestId").asText());
                assertEquals(captured.columnTraceId(), event.path("traceId").asText());
                assertEquals(captured.dedupeKey(), event.path("dedupeKey").asText());
                events.add(event);
            }
            return events;
        }
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private record Captured(String columnEventId, String dedupeKey, String payloadJson, String columnRequestId,
            String columnTraceId) {
    }

    /** One sealed placement score. A second call for the same answer is illegal. */
    private static final class OnceScorer implements PlacementRuleScorePort {
        private int calls;

        @Override
        public RuleScore score(long itemId, String selectedOptionId) {
            if (calls > 0) throw new IllegalStateException("placement score is not repeatable");
            calls++;
            if (itemId != 1001L || !"A".equals(selectedOptionId)) {
                throw new IllegalStateException("unexpected placement score");
            }
            return new RuleScore("FULL", FULL_EXPLANATION);
        }
    }

    /** Scores local session rules and records the outbox envelopes from that write. */
    private static final class FakeJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> sessions = new LinkedHashMap<>();
        private final Map<String, Map<String, Object>> attempts = new LinkedHashMap<>();
        private final Map<String, Map<String, Object>> idempotency = new LinkedHashMap<>();
        private final List<Captured> events = new ArrayList<>();
        private final List<Map<String, Object>> rules;
        private final String itemsJson;
        private final String answersJson;

        private FakeJdbc() {
            this(List.of(answerRule("1001", "A")),
                    "[{\"itemId\":1001,\"itemCode\":\"1001\",\"itemType\":\"VOCABULARY\"}]",
                    "{}");
        }

        private FakeJdbc(List<Map<String, Object>> rules, String itemsJson, String answersJson) {
            this.rules = List.copyOf(rules);
            this.itemsJson = itemsJson;
            this.answersJson = answersJson;
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT IGNORE INTO assessment_idempotency")) {
                String key = args[2] + "|" + args[3];
                if (idempotency.containsKey(key)) return 0;
                idempotency.put(key, Map.of("request_digest", args[4], "response_json", args[5]));
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency")) {
                idempotency.put(args[4] + "|" + args[5], Map.of("request_digest", args[0], "response_json", args[1]));
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_attempt")) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("attempt_id", args[0]);
                row.put("session_id", args[1]);
                row.put("attempt_version", args[4]);
                row.put("status", "ASSESSED");
                row.put("item_count", args[6]);
                row.put("submission_digest", args[7]);
                row.put("score_bucket", args[8]);
                row.put("report_id", args[10]);
                attempts.put(String.valueOf(args[0]), row);
                return 1;
            }
            if (sql.contains("INSERT INTO assessment_outbox_event")) {
                events.add(new Captured(String.valueOf(args[0]), String.valueOf(args[4]), String.valueOf(args[5]),
                        String.valueOf(args[9]), String.valueOf(args[10])));
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_report")
                    || sql.contains("INSERT INTO assessment_mistake")
                    || sql.contains("UPDATE b10_assessment_session")) {
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b10_assessment_session")) {
                Map<String, Object> session = sessions.computeIfAbsent(String.valueOf(args[0]), this::session);
                if (sql.contains("principal_id") && !SUBJECT.equals(String.valueOf(args[1]))) return List.of();
                return List.of(session);
            }
            if (sql.contains("FROM b10_assessment_attempt")) {
                if (sql.contains("submission_id")) return List.of();
                Map<String, Object> attempt = attempts.get(String.valueOf(args[0]));
                return attempt == null ? List.of() : List.of(attempt);
            }
            if (sql.contains("FROM b25_assessment_item_rule")) return rules;
            if (sql.contains("MAX(attempt_version)")) return List.of(Map.of("attempt_version", 1));
            if (sql.contains("MAX(mistake_id)")) return List.of(Map.of("mistake_id", 1L));
            if (sql.contains("FROM assessment_mistake")) return List.of();
            if (sql.contains("FROM assessment_idempotency")) {
                Map<String, Object> stored = idempotency.get(args[2] + "|" + args[3]);
                return stored == null ? List.of() : List.of(stored);
            }
            throw new AssertionError("unexpected query: " + sql);
        }

        private Map<String, Object> session(String sessionId) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("session_id", sessionId);
            row.put("principal_id", SUBJECT);
            row.put("tenant_id", "platform");
            row.put("content_code", "course-b25-basics");
            row.put("content_version_id", 25001L);
            row.put("content_epoch", 1L);
            row.put("snapshot_id", 25001L);
            row.put("snapshot_hash", "ab".repeat(32));
            row.put("items_json", itemsJson);
            row.put("answers_json", answersJson);
            row.put("state_version", 1L);
            row.put("owner_snapshot_ref", OWNER_PIN);
            return row;
        }
    }
}
