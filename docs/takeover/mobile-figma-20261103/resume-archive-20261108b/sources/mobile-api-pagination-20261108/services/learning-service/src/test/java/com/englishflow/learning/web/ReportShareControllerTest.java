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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReportShareControllerTest {

    private static final String SHARE_KEY = "report-share-key-01";
    private static final String REVOKE_KEY = "report-share-revoke1";

    @Test
    void issueStoresOnlyPublicFieldsAndTheRefIsUnguessable() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(contains("b3_learning_interaction"), any(Object[].class))).thenReturn(List.of());
        String[] insertedRef = { null };
        when(jdbc.update(contains("ON DUPLICATE KEY UPDATE"), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    insertedRef[0] = invocation.getArgument(1);
                    return 1;
                });
        when(jdbc.queryForList(contains("request_binding"), eq("platform"), eq("learner-share-test"), eq(SHARE_KEY)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (!sql.contains("FOR UPDATE")) return List.of();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("share_ref", insertedRef[0]);
                    row.put("request_binding", "DAILY|EXPLICIT|2026-10-11");
                    row.put("expires_at", java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00.123456Z")));
                    return List.of(row);
                });
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        Map<String, Object> issued = controller.issueReportShare(learner(), "DAILY", "2026-10-11", SHARE_KEY);

        String ref = String.valueOf(issued.get("ref"));
        assertTrue(ref.matches("[0-9a-f]{32}"));
        assertEquals(insertedRef[0], ref);
        assertEquals("/api/v1/public/learning/report-shares/" + ref, issued.get("publicPath"));
        assertFalse(issued.containsKey("token"));
        assertFalse(issued.containsKey("subject"));
        org.mockito.ArgumentCaptor<String> snapshot = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO b25_learning_report_share"),
                eq(ref), eq("platform"), eq("learner-share-test"), eq("DAILY"), snapshot.capture(), any(),
                eq(SHARE_KEY), eq("DAILY|EXPLICIT|2026-10-11"));
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
                () -> controller.revokeReportShare(learner(), ref, REVOKE_KEY));
        assertEquals(HttpStatus.NOT_FOUND, hidden.getStatusCode());
        assertEquals("share not found", hidden.getReason());
        verify(jdbc).queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test"));
        verify(jdbc, never()).queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("someone-else"));

        ResponseStatusException malformed = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), "missing", REVOKE_KEY));
        assertEquals(HttpStatus.NOT_FOUND, malformed.getStatusCode());
        String absent = "cd".repeat(16);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(absent), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of());
        ResponseStatusException unknown = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), absent, REVOKE_KEY));
        assertEquals(HttpStatus.NOT_FOUND, unknown.getStatusCode());
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void revokeKeepsTheFirstMicrosTimestampAndSkipsASecondWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);
        Map<String, Object> locked = new LinkedHashMap<>();
        locked.put("share_ref", ref);
        locked.put("revoked_at", null);
        locked.put("revoke_idempotency_key", null);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(locked));
        when(jdbc.update(contains("revoked_at IS NULL"), any(), eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"),
                eq("learner-share-test"))).thenReturn(1);

        Map<String, Object> first = controller.revokeReportShare(learner(), ref, REVOKE_KEY);
        org.mockito.ArgumentCaptor<java.sql.Timestamp> written =
                org.mockito.ArgumentCaptor.forClass(java.sql.Timestamp.class);
        verify(jdbc).update(contains("UPDATE b25_learning_report_share"),
                written.capture(), eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"), eq("learner-share-test"));
        Instant stored = written.getValue().toInstant();
        assertEquals(stored.truncatedTo(ChronoUnit.MICROS), stored);
        assertEquals(stored.toString(), first.get("revokedAt"));
        assertEquals("REVOKED", first.get("status"));
        assertEquals(ref, first.get("ref"));

        locked.put("revoked_at", written.getValue());
        locked.put("revoke_idempotency_key", REVOKE_KEY);
        Map<String, Object> keyed = new LinkedHashMap<>();
        keyed.put("share_ref", ref);
        keyed.put("revoked_at", written.getValue());
        when(jdbc.queryForList(contains("revoke_idempotency_key"), eq("platform"), eq("learner-share-test"),
                eq(REVOKE_KEY))).thenReturn(List.of(keyed));
        Map<String, Object> second = controller.revokeReportShare(learner(), ref, REVOKE_KEY);
        assertEquals(first.get("revokedAt"), second.get("revokedAt"));
        assertEquals(written.getValue().toInstant().toString(), second.get("revokedAt"));
        verify(jdbc, times(1)).update(contains("UPDATE b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
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
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void revokeUpdateThatAffectsNoRowIsNotFound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "de".repeat(16);
        Map<String, Object> open = new LinkedHashMap<>();
        open.put("share_ref", ref);
        open.put("revoked_at", null);
        open.put("revoke_idempotency_key", null);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(open));
        when(jdbc.update(contains("revoked_at IS NULL"), any(), eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"),
                eq("learner-share-test"))).thenReturn(0);

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref, REVOKE_KEY));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        assertEquals("share not found", missing.getReason());
        verify(jdbc, times(1)).queryForList(contains("b25_learning_report_share"),
                eq(ref), eq("platform"), eq("learner-share-test"));
        verify(jdbc, times(1)).update(contains("UPDATE b25_learning_report_share"),
                any(), eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"), eq("learner-share-test"));
    }

    @Test
    void issueMissingOrBlankKeyIsRejectedBeforeMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.issueReportShare(learner(), "DAILY", "2026-10-11", null));
        ResponseStatusException blank = assertThrows(ResponseStatusException.class,
                () -> controller.issueReportShare(learner(), "DAILY", "2026-10-11", "   "));

        assertEquals(HttpStatus.BAD_REQUEST, missing.getStatusCode());
        assertEquals("Idempotency-Key is required", missing.getReason());
        assertEquals(HttpStatus.BAD_REQUEST, blank.getStatusCode());
        assertEquals("Idempotency-Key is required", blank.getReason());
        verify(jdbc, never()).update(contains("b25_learning_report_share"), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).update(contains("b25_learning_report_share"),
                any(), any(), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).queryForList(contains("b25_learning_report_share"), any(), any(), any());
        verify(jdbc, never()).queryForList(contains("b3_learning_interaction"), any(Object[].class));
    }

    @Test
    void keyedIssueIgnoresAffectedRowOneAndReplaysTheLockedRow() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(contains("b3_learning_interaction"), any(Object[].class))).thenReturn(List.of());
        // Connector/J can report 1 for a fresh insert and for a no-op duplicate. The receipt is the locked row.
        when(jdbc.update(contains("ON DUPLICATE KEY UPDATE"), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        java.sql.Timestamp expires = java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00.123456Z"));
        String persisted = "11".repeat(16);
        int[] plainReads = {0};
        when(jdbc.queryForList(contains("request_binding"), eq("platform"), eq("learner-share-test"), eq(SHARE_KEY)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("share_ref", persisted);
                    row.put("request_binding", "DAILY|EXPLICIT|2026-10-11");
                    row.put("expires_at", expires);
                    if (sql.contains("FOR UPDATE")) return List.of(row);
                    return plainReads[0]++ == 0 ? List.of() : List.of(row);
                });
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        Map<String, Object> issued = controller.issueReportShare(learner(), "DAILY", "2026-10-11", SHARE_KEY);
        Map<String, Object> replay = controller.issueReportShare(learner(), "DAILY", "2026-10-11", SHARE_KEY);

        assertEquals(issued, replay);
        assertEquals(Set.of("ref", "expiresAt", "publicPath", "status"), issued.keySet());
        assertEquals(persisted, issued.get("ref"));
        assertEquals(expires.toInstant().toString(), issued.get("expiresAt"));
        assertEquals("/api/v1/public/learning/report-shares/" + persisted, issued.get("publicPath"));
        assertEquals("ACTIVE", issued.get("status"));
        org.mockito.ArgumentCaptor<String> statement = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.ArgumentCaptor<String> insertedRef = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(statement.capture(), insertedRef.capture(), eq("platform"), eq("learner-share-test"),
                eq("DAILY"), any(), any(), eq(SHARE_KEY), eq("DAILY|EXPLICIT|2026-10-11"));
        assertNotEquals(insertedRef.getValue(), issued.get("ref"));
        String assignment = statement.getValue().substring(statement.getValue().indexOf("ON DUPLICATE KEY UPDATE")).strip();
        assertEquals("ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key", assignment);
        org.mockito.InOrder order = inOrder(jdbc);
        order.verify(jdbc).queryForList(
                argThat((String sql) -> sql.contains("request_binding") && !sql.contains("FOR UPDATE")),
                eq("platform"), eq("learner-share-test"), eq(SHARE_KEY));
        order.verify(jdbc).update(contains("ON DUPLICATE KEY UPDATE"),
                any(), any(), any(), any(), any(), any(), any(), any());
        order.verify(jdbc).queryForList(contains("FOR UPDATE"),
                eq("platform"), eq("learner-share-test"), eq(SHARE_KEY));
        order.verify(jdbc).queryForList(
                argThat((String sql) -> sql.contains("request_binding") && !sql.contains("FOR UPDATE")),
                eq("platform"), eq("learner-share-test"), eq(SHARE_KEY));
        verify(jdbc, times(1)).queryForList(contains("FOR UPDATE"),
                eq("platform"), eq("learner-share-test"), eq(SHARE_KEY));
        verify(jdbc, times(1)).queryForList(contains("b3_learning_interaction"), any(Object[].class));
        verify(jdbc, times(1)).update(contains("ON DUPLICATE KEY UPDATE"),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sameKeyWithADifferentReportBindingConflicts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("share_ref", "11".repeat(16));
        row.put("request_binding", "DAILY|EXPLICIT|2026-10-11");
        row.put("expires_at", java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00Z")));
        when(jdbc.queryForList(contains("request_binding"), eq("platform"), eq("learner-share-test"), eq("daily-explicit-key1")))
                .thenReturn(List.of(row));
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        ResponseStatusException weekly = assertThrows(ResponseStatusException.class,
                () -> controller.issueReportShare(learner(), "WEEKLY", "2026-10-14", "daily-explicit-key1"));
        ResponseStatusException otherDay = assertThrows(ResponseStatusException.class,
                () -> controller.issueReportShare(learner(), "DAILY", "2026-10-12", "daily-explicit-key1"));

        assertEquals(HttpStatus.CONFLICT, weekly.getStatusCode());
        assertEquals("idempotency key was used for a different report share", weekly.getReason());
        assertEquals(HttpStatus.CONFLICT, otherDay.getStatusCode());
        assertEquals("idempotency key was used for a different report share", otherDay.getReason());
        verify(jdbc, never()).update(contains("b25_learning_report_share"), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).update(contains("b25_learning_report_share"),
                any(), any(), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).queryForList(contains("FOR UPDATE"), any(), any(), any());
        verify(jdbc, never()).queryForList(contains("b3_learning_interaction"), any(Object[].class));
    }

    @Test
    void sameKeyIsOwnerScopedAndDoesNotLeakAnotherOwner() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        Map<String, Object> ownerRow = new LinkedHashMap<>();
        ownerRow.put("share_ref", "11".repeat(16));
        ownerRow.put("request_binding", "DAILY|EXPLICIT|2026-10-11");
        ownerRow.put("expires_at", java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00Z")));
        when(jdbc.queryForList(contains("request_binding"), eq("platform"), eq("learner-share-test"), eq(SHARE_KEY)))
                .thenReturn(List.of(ownerRow));
        when(jdbc.queryForList(contains("b3_learning_interaction"), any(Object[].class))).thenReturn(List.of());
        String otherRef = "22".repeat(16);
        when(jdbc.queryForList(contains("request_binding"), eq("platform"), eq("other-share-owner"), eq(SHARE_KEY)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (!sql.contains("FOR UPDATE")) return List.of();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("share_ref", otherRef);
                    row.put("request_binding", "DAILY|EXPLICIT|2026-10-11");
                    row.put("expires_at", java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00Z")));
                    return List.of(row);
                });
        when(jdbc.update(contains("ON DUPLICATE KEY UPDATE"), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        Map<String, Object> owner = controller.issueReportShare(learner(), "DAILY", "2026-10-11", SHARE_KEY);
        Map<String, Object> other = controller.issueReportShare(learner("other-share-owner"), "DAILY", "2026-10-11",
                SHARE_KEY);

        assertEquals("11".repeat(16), owner.get("ref"));
        assertEquals(otherRef, other.get("ref"));
        assertNotEquals(owner.get("ref"), other.get("ref"));
        verify(jdbc, never()).queryForList(contains("request_binding"), eq("platform"), eq("learner-share-test"),
                eq("other-share-owner"));
    }

    @Test
    void unsafeIdempotencyKeyIsRejected() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        ResponseStatusException rejected = assertThrows(ResponseStatusException.class,
                () -> controller.issueReportShare(learner(), "DAILY", "2026-10-11", "too-short"));

        assertEquals(HttpStatus.BAD_REQUEST, rejected.getStatusCode());
        assertEquals("Idempotency-Key must contain 16-128 safe characters", rejected.getReason());
        verify(jdbc, never()).update(contains("b25_learning_report_share"), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).update(contains("b25_learning_report_share"),
                any(), any(), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).queryForList(contains("b25_learning_report_share"), any(Object[].class));
        verify(jdbc, never()).queryForList(contains("b3_learning_interaction"), any(Object[].class));
    }

    @Test
    void revokeMissingOrMalformedKeyIsRejectedBeforeMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref, null));
        ResponseStatusException blank = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref, "   "));
        ResponseStatusException malformed = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref, "too-short"));

        assertEquals(HttpStatus.BAD_REQUEST, missing.getStatusCode());
        assertEquals("Idempotency-Key is required", missing.getReason());
        assertEquals(HttpStatus.BAD_REQUEST, blank.getStatusCode());
        assertEquals("Idempotency-Key is required", blank.getReason());
        assertEquals(HttpStatus.BAD_REQUEST, malformed.getStatusCode());
        assertEquals("Idempotency-Key must contain 16-128 safe characters", malformed.getReason());
        verify(jdbc, never()).queryForList(contains("b25_learning_report_share"), any(), any(), any());
        verify(jdbc, never()).update(contains("b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void revokeSameKeyReplaysAndADifferentRefConflicts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);
        String other = "cd".repeat(16);
        java.sql.Timestamp revokedAt = java.sql.Timestamp.from(Instant.parse("2026-10-18T03:04:05.123456Z"));
        Map<String, Object> keyed = new LinkedHashMap<>();
        keyed.put("share_ref", ref);
        keyed.put("revoked_at", revokedAt);
        when(jdbc.queryForList(contains("revoke_idempotency_key"), eq("platform"), eq("learner-share-test"),
                eq(REVOKE_KEY))).thenReturn(List.of(keyed));

        Map<String, Object> replay = controller.revokeReportShare(learner(), ref, REVOKE_KEY);
        assertEquals(ref, replay.get("ref"));
        assertEquals("REVOKED", replay.get("status"));
        assertEquals(revokedAt.toInstant().toString(), replay.get("revokedAt"));

        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), other, REVOKE_KEY));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals("idempotency key was used for a different report share", conflict.getReason());
        verify(jdbc, never()).queryForList(contains("FOR UPDATE"), any(), any(), any());
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void alreadyRevokedDifferentKeyReplaysWithoutOverwritingTheStoredKey() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ef".repeat(16);
        java.sql.Timestamp revokedAt = java.sql.Timestamp.from(Instant.parse("2026-10-18T03:04:05.123456Z"));
        Map<String, Object> locked = new LinkedHashMap<>();
        locked.put("share_ref", ref);
        locked.put("revoked_at", revokedAt);
        locked.put("revoke_idempotency_key", REVOKE_KEY);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(locked));

        Map<String, Object> body = controller.revokeReportShare(learner(), ref, "report-share-other1");
        assertEquals(ref, body.get("ref"));
        assertEquals("REVOKED", body.get("status"));
        assertEquals(revokedAt.toInstant().toString(), body.get("revokedAt"));
        verify(jdbc, never()).update(contains("UPDATE b25_learning_report_share"),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void alreadyRevokedLegacyNullKeyBindsThisKeyWithoutRewritingRevokedAt() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "aa".repeat(16);
        java.sql.Timestamp revokedAt = java.sql.Timestamp.from(Instant.parse("2026-10-18T03:04:05.123456Z"));
        Map<String, Object> locked = new LinkedHashMap<>();
        locked.put("share_ref", ref);
        locked.put("revoked_at", revokedAt);
        locked.put("revoke_idempotency_key", null);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(locked));
        when(jdbc.update(contains("revoke_idempotency_key IS NULL"), eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"),
                eq("learner-share-test"))).thenReturn(1);

        Map<String, Object> body = controller.revokeReportShare(learner(), ref, REVOKE_KEY);
        assertEquals(revokedAt.toInstant().toString(), body.get("revokedAt"));
        verify(jdbc).update(contains("revoke_idempotency_key IS NULL"),
                eq(REVOKE_KEY), eq(ref), eq(ref), eq("platform"), eq("learner-share-test"));
        verify(jdbc, never()).update(contains("revoked_at IS NULL"), any(), any(), any(), any(), any(), any());
    }

    private static void assertStoredRevoke(JdbcTemplate jdbc, B25LearningJdbcController controller, String ref,
            Object revokedAt, String expected) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("share_ref", ref);
        row.put("revoked_at", revokedAt);
        row.put("revoke_idempotency_key", REVOKE_KEY);
        when(jdbc.queryForList(contains("FOR UPDATE"), eq(ref), eq("platform"), eq("learner-share-test")))
                .thenReturn(List.of(row));
        Map<String, Object> body = controller.revokeReportShare(learner(), ref, REVOKE_KEY);
        assertEquals(expected, body.get("revokedAt"));
        assertEquals("REVOKED", body.get("status"));
        assertEquals(ref, body.get("ref"));
    }

    private static JwtAuthenticationToken learner() {
        return learner("learner-share-test");
    }

    private static JwtAuthenticationToken learner(String subject) {
        Instant now = Instant.parse("2026-10-11T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject(subject)
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
