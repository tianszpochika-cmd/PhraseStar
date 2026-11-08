package com.englishflow.assessment.web;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class B10MistakeListPaginationTest {

    private static final String OWNER = "prn_learner0000000001";
    private static final String OTHER = "prn_learner0000000002";

    @Test
    void listHonorsCursorPageSizeEmptyBoundaryAndOwnerIsolation() {
        FakeJdbc jdbc = new FakeJdbc();
        jdbc.add(row(1, OWNER));
        jdbc.add(row(2, OWNER));
        jdbc.add(row(3, OWNER));
        jdbc.add(row(4, OTHER));
        jdbc.add(row(5, OWNER));
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");

        Map<String, Object> first = controller.listMistakes(learner(OWNER), null, 2, "req_mistake01",
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        List<Long> firstIds = ids(first);
        assertEquals(List.of(1L, 2L), firstIds);
        Map<?, ?> firstMeta = (Map<?, ?>) first.get("meta");
        assertEquals(Boolean.TRUE, firstMeta.get("hasMore"));
        assertEquals(2, firstMeta.get("pageSize"));
        assertEquals(2, ((Map<?, ?>) first.get("data")).get("count"));
        assertEquals("req_mistake01", firstMeta.get("requestId"));

        Map<String, Object> next = controller.listMistakes(learner(OWNER), (String) firstMeta.get("nextCursor"), 2,
                null, null);
        List<Long> nextIds = ids(next);
        assertEquals(List.of(3L, 5L), nextIds);
        assertTrue(java.util.Collections.disjoint(firstIds, nextIds));
        assertFalse((Boolean) ((Map<?, ?>) next.get("meta")).get("hasMore"));
        assertNull(((Map<?, ?>) next.get("meta")).get("nextCursor"));

        Map<String, Object> empty = controller.listMistakes(learner("prn_learner0000000003"), null, 20, null, null);
        assertEquals(List.of(), ids(empty));
        assertEquals(Boolean.FALSE, ((Map<?, ?>) empty.get("meta")).get("hasMore"));
        assertEquals(20, ((Map<?, ?>) empty.get("meta")).get("pageSize"));

        Map<String, Object> other = controller.listMistakes(learner(OTHER), null, 20, null, null);
        assertEquals(List.of(4L), ids(other));
    }

    @Test
    void listRejectsInvalidCursorAndPageSizeWithoutReadingOwnerRows() {
        FakeJdbc jdbc = new FakeJdbc();
        jdbc.add(row(1, OWNER));
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");
        ResponseStatusException cursor = assertThrows(ResponseStatusException.class,
                () -> controller.listMistakes(learner(OWNER), "!!!!!!!!", 2, null, null));
        assertEquals(HttpStatus.BAD_REQUEST, cursor.getStatusCode());
        assertEquals(0, jdbc.queries);
        ResponseStatusException size = assertThrows(ResponseStatusException.class,
                () -> controller.listMistakes(learner(OWNER), null, 0, null, null));
        assertEquals(HttpStatus.BAD_REQUEST, size.getStatusCode());
        assertEquals(0, jdbc.queries);
    }

    @SuppressWarnings("unchecked")
    private static List<Long> ids(Map<String, Object> body) {
        Map<String, Object> data = (Map<String, Object>) body.get("data");
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        return items.stream().map(item -> ((Number) item.get("mistakeId")).longValue()).toList();
    }

    private static JwtAuthenticationToken learner(String subject) {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), subject);
    }

    private static Map<String, Object> row(long mistakeId, String subject) {
        Timestamp time = Timestamp.from(Instant.parse("2026-09-22T00:00:00Z"));
        Map<String, Object> mistake = new HashMap<>();
        mistake.put("mistake_id", mistakeId);
        mistake.put("subject_id", subject);
        mistake.put("tenant_id", "platform");
        mistake.put("item_id", mistakeId * 10);
        mistake.put("question_id", mistakeId * 10);
        mistake.put("error_category", "UNCLASSIFIED");
        mistake.put("rule_version", "v1");
        mistake.put("answer_hash", "hash");
        mistake.put("wrong_count", 1);
        mistake.put("mistake_status", "PENDING_RETRY");
        mistake.put("mastery_status", "LEARNING");
        mistake.put("first_error_at", time);
        mistake.put("last_error_at", time);
        mistake.put("next_action_at", time);
        mistake.put("reason_trace_json", "[]");
        return mistake;
    }

    private static final class FakeJdbc extends JdbcTemplate {
        private final List<Map<String, Object>> rows = new ArrayList<>();
        private int queries;

        void add(Map<String, Object> row) {
            rows.add(row);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            queries++;
            String tenant = String.valueOf(args[0]);
            String subject = String.valueOf(args[1]);
            Long after = args.length == 4 ? ((Number) args[2]).longValue() : null;
            int limit = ((Number) args[args.length - 1]).intValue();
            return rows.stream()
                    .filter(row -> tenant.equals(row.get("tenant_id")) && subject.equals(row.get("subject_id")))
                    .filter(row -> after == null || ((Number) row.get("mistake_id")).longValue() > after)
                    .sorted(Comparator.comparingLong(row -> ((Number) row.get("mistake_id")).longValue()))
                    .limit(limit)
                    .toList();
        }
    }
}
