package com.englishflow.assessment.web;

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

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Submit-attempt correlation is observability only. Canonical X-Request-Id and
 * X-Trace-Id propagate; absent or malformed values are replaced once per write.
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> response) {
        return (Map<String, Object>) response.get("data");
    }

    private static final class Harness {
        private final ObjectMapper mapper = new ObjectMapper();
        private final FakeJdbc jdbc = new FakeJdbc();
        private final B10AssessmentJdbcController controller =
                new B10AssessmentJdbcController(jdbc, mapper, "http://127.0.0.1:9");

        private Map<String, Object> submit(String sessionId, String submissionId, String key, String requestId,
                String traceId) {
            return controller.submitAttempt(learner(), sessionId, Map.of(
                    "submissionId", submissionId,
                    "items", List.of(Map.of("itemId", 1001, "response", "B"))),
                    key, requestId, traceId);
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

    /** Scores one wrong local item and records the outbox envelopes from that write. */
    private static final class FakeJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> sessions = new LinkedHashMap<>();
        private final Map<String, Map<String, Object>> attempts = new LinkedHashMap<>();
        private final Map<String, Map<String, Object>> idempotency = new LinkedHashMap<>();
        private final List<Captured> events = new ArrayList<>();
        private final Map<String, Object> rule = Map.of(
                "item_id", "1001",
                "answer_rule_json", "{\"answer\":\"A\"}");

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
            if (sql.contains("FROM b25_assessment_item_rule")) return List.of(rule);
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
            row.put("items_json", "[{\"itemId\":1001,\"itemCode\":\"1001\",\"itemType\":\"VOCABULARY\"}]");
            row.put("answers_json", "{}");
            row.put("state_version", 1L);
            row.put("owner_snapshot_ref", OWNER_PIN);
            return row;
        }
    }
}
