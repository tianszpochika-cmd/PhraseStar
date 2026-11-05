package com.englishflow.learning.web;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import com.englishflow.learning.domain.LearningPeriodReport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReportShareControllerTest {

    @Test
    void issueStoresOnlyPublicFieldsAndTheRefIsUnguessable() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(contains("b3_learning_interaction"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("b25_learning_report_share"), any(), any(), any(), any(), any(), any())).thenReturn(1);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        Map<String, Object> issued = controller.issueReportShare(learner(), "DAILY", "2026-10-11");

        String ref = String.valueOf(issued.get("ref"));
        assertTrue(ref.matches("[0-9a-f]{32}"));
        assertEquals("/api/v1/public/learning/report-shares/" + ref, issued.get("publicPath"));
        assertFalse(issued.containsKey("token"));
        assertFalse(issued.containsKey("subject"));
        org.mockito.ArgumentCaptor<String> snapshot = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO b25_learning_report_share"),
                eq(ref), eq("platform"), eq("learner-share-test"), eq("DAILY"), snapshot.capture(), any());
        assertTrue(snapshot.getValue().contains("NEVER_STUDIED"));
        assertFalse(snapshot.getValue().contains("token"));
        assertFalse(snapshot.getValue().contains("\"subject\""));
    }

    @Test
    void publicReadHidesTheOwnerAndRevokeIsOwnerOnly() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("share_ref", ref);
        row.put("principal_id", "learner-share-test");
        row.put("snapshot_json", "{\"availability\":\"EMPTY\",\"copy\":\"这段时间还没有学习记录。\",\"subject\":\"learner-share-test\",\"token\":\"secret\"}");
        row.put("expires_at", java.sql.Timestamp.from(Instant.now().plus(java.time.Duration.ofDays(7))));
        row.put("revoked_at", null);
        when(jdbc.queryForList(contains("b25_learning_report_share"), eq(ref), eq("platform"))).thenReturn(List.of(row));

        Map<String, Object> view = controller.readReportShare(ref);
        assertEquals("ACTIVE", view.get("status"));
        assertEquals("EMPTY", view.get("availability"));
        assertFalse(view.containsKey("subject"));
        assertFalse(view.containsKey("token"));
        assertFalse(String.valueOf(view).contains("secret"));

        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of());
        row.put("principal_id", "someone-else");
        ResponseStatusException hidden = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref));
        assertEquals(HttpStatus.NOT_FOUND, hidden.getStatusCode());
        verify(jdbc).queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test"));

        ResponseStatusException malformed = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), "missing"));
        assertEquals(HttpStatus.NOT_FOUND, malformed.getStatusCode());
        String absent = "cd".repeat(16);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(absent), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of());
        ResponseStatusException unknown = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), absent));
        assertEquals(HttpStatus.NOT_FOUND, unknown.getStatusCode());
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"), any(), any(), any(), any());
    }

    @Test
    void revokeKeepsTheFirstMicrosTimestampAndSkipsASecondWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);
        Map<String, Object> locked = new LinkedHashMap<>();
        locked.put("revoked_at", null);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(locked));
        when(jdbc.update(contains("revoked_at IS NULL"), any(), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(1);

        Map<String, Object> first = controller.revokeReportShare(learner(), ref);
        org.mockito.ArgumentCaptor<java.sql.Timestamp> written =
                org.mockito.ArgumentCaptor.forClass(java.sql.Timestamp.class);
        verify(jdbc).update(contains("UPDATE b25_learning_report_share"),
                written.capture(), eq(ref), eq("platform"), eq("learner-share-test"));
        Instant stored = written.getValue().toInstant();
        assertEquals(stored.truncatedTo(ChronoUnit.MICROS), stored);
        assertEquals(stored.toString(), first.get("revokedAt"));
        assertEquals("REVOKED", first.get("status"));
        assertEquals(ref, first.get("ref"));

        locked.put("revoked_at", written.getValue());
        Map<String, Object> second = controller.revokeReportShare(learner(), ref);
        assertEquals(first.get("revokedAt"), second.get("revokedAt"));
        assertEquals(written.getValue().toInstant().toString(), second.get("revokedAt"));
        verify(jdbc, times(1)).update(contains("UPDATE b25_learning_report_share"),
                any(), eq(ref), eq("platform"), eq("learner-share-test"));
    }

    @Test
    void revokeReplayUsesTheStoredTimestampWithoutRewritingIt() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        java.sql.Timestamp timestamp = java.sql.Timestamp.from(Instant.parse("2026-10-18T03:04:05.123456Z"));
        OffsetDateTime offset = OffsetDateTime.parse("2026-10-18T11:04:05.123456+08:00");
        LocalDateTime local = LocalDateTime.parse("2026-10-18T03:04:05.123456");
        assertStoredRevoke(jdbc, controller, "aa".repeat(16), timestamp, timestamp.toInstant().toString());
        assertStoredRevoke(jdbc, controller, "bb".repeat(16), offset,
                LearningPeriodReport.parseInstant(offset).toString());
        assertStoredRevoke(jdbc, controller, "cc".repeat(16), local,
                LearningPeriodReport.parseInstant(local).toString());
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"), any(), any(), any(), any());
    }

    @Test
    void revokeUpdateThatAffectsNoRowIsNotFound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "de".repeat(16);
        Map<String, Object> open = new LinkedHashMap<>();
        open.put("revoked_at", null);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(open));
        when(jdbc.update(contains("revoked_at IS NULL"), any(), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(0);

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        assertEquals("share not found", missing.getReason());
        verify(jdbc, times(1)).queryForList(contains("b25_learning_report_share"),
                eq(ref), eq("platform"), eq("learner-share-test"));
        verify(jdbc, times(1)).update(contains("UPDATE b25_learning_report_share"),
                any(), eq(ref), eq("platform"), eq("learner-share-test"));
    }

    private static void assertStoredRevoke(JdbcTemplate jdbc, B25LearningJdbcController controller, String ref,
            Object revokedAt, String expected) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("revoked_at", revokedAt);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(row));
        Map<String, Object> body = controller.revokeReportShare(learner(), ref);
        assertEquals(expected, body.get("revokedAt"));
        assertEquals("REVOKED", body.get("status"));
        assertEquals(ref, body.get("ref"));
    }

    private static JwtAuthenticationToken learner() {
        Instant now = Instant.parse("2026-10-11T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("learner-share-test")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("learning.progress.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .claim("phase", "phase-1")
                .claim("account_status", "ACTIVE")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
