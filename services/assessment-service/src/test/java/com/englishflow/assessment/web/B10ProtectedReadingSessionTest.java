package com.englishflow.assessment.web;

import com.englishflow.assessment.adapter.content.BankPracticeRuleProvider;
import com.englishflow.assessment.adapter.content.HttpProtectedContentSnapshotTransport;
import com.englishflow.assessment.config.AssessmentPersistenceConfiguration;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Protected reading uses the package-private owner seam, the same shape as {@code bankRules}.
 * The fake JDBC commits on success and rolls a {@link ResponseStatusException} back, which is
 * the boundary {@code @Transactional} provides around create and submit.
 */
class B10ProtectedReadingSessionTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private static final long VERSION = 1001L;
    private static final String CODE = "reading.unit.one";
    private static final String SNAPSHOT = "snap_reading_1001";
    private static final String HASH = "ab".repeat(32);
    private static final String DIGEST_9 = "cd".repeat(32);
    private static final String DIGEST_2 = "ef".repeat(32);
    private static final String STARTED = "2026-11-06T03:00:00Z";
    private static final String PUBLISHED = "2026-04-01T08:00:00Z";

    @Test
    void serverMarkStripsDigestAndReplaysWithoutAnotherFetch() {
        assertEquals(SNAPSHOT, B10AssessmentJdbcController.protectedReadingRef(VERSION));
        assertNull(B10AssessmentJdbcController.protectedReadingRef(0));
        Map<String, Object> placement = new LinkedHashMap<>();
        placement.put("content_version_id", 266100L);
        placement.put("owner_snapshot_ref", "snap_p1.placement.v1-266100");
        assertFalse(B10AssessmentJdbcController.protectedReadingSession(placement));
        Map<String, Object> marked = new LinkedHashMap<>();
        marked.put("content_version_id", VERSION);
        marked.put("owner_snapshot_ref", SNAPSHOT);
        assertTrue(B10AssessmentJdbcController.protectedReadingSession(marked));
        marked.put("owner_snapshot_ref", " " + SNAPSHOT);
        assertFalse(B10AssessmentJdbcController.protectedReadingSession(marked));
        marked.put("owner_snapshot_ref", "snap_reading_1002");
        assertFalse(B10AssessmentJdbcController.protectedReadingSession(marked));
        marked.put("owner_snapshot_ref", null);
        assertFalse(B10AssessmentJdbcController.protectedReadingSession(marked));

        Harness harness = new Harness();
        Map<String, Object> body = createBody(CODE, VERSION, null, "snap_client_1001");
        Map<String, Object> created = harness.create("create-reading-1", body);
        Map<String, Object> row = harness.onlySession();
        Map<String, Object> pin = pinOf(created);
        assertEquals(CODE, pin.get("contentCode"));
        assertEquals(VERSION, longOf(pin.get("contentVersionId")));
        assertEquals(4L, longOf(pin.get("contentEpoch")));
        assertEquals(VERSION, longOf(pin.get("snapshotId")));
        assertEquals(HASH, pin.get("snapshotHash"));
        assertEquals(STARTED, pin.get("pinnedAt"));
        assertEquals("PINNED", pin.get("pinStatus"));
        assertEquals(SNAPSHOT, row.get("owner_snapshot_ref"));
        assertEquals(4L, longOf(row.get("content_epoch")));
        assertEquals(VERSION, longOf(row.get("snapshot_id")));
        assertEquals(HASH, row.get("snapshot_hash"));
        assertEquals("{}", row.get("answers_json"));
        assertEquals(1L, longOf(row.get("state_version")));
        assertTrue(B10AssessmentJdbcController.protectedReadingSession(row));
        assertFalse(String.valueOf(row).contains("snap_client_1001"));
        assertFalse(String.valueOf(row).contains(PUBLISHED));
        assertFalse(String.valueOf(created).contains("snap_reading_"));
        assertFalse(String.valueOf(created).contains(DIGEST_9));
        assertFalse(String.valueOf(created).contains(DIGEST_2));
        String storedItems = String.valueOf(row.get("items_json"));
        assertTrue(storedItems.contains(DIGEST_9));
        assertTrue(storedItems.contains(DIGEST_2));
        assertFalse(harness.claim("B10_SESSION_CREATE", "create-reading-1").contains(DIGEST_9));
        List<Map<String, Object>> visible = items(created);
        assertEquals(2, visible.size());
        assertEquals(9L, longOf(visible.get(0).get("itemId")));
        assertEquals(2L, longOf(visible.get(1).get("itemId")));
        assertFalse(visible.get(0).containsKey("ruleDigest"));
        assertFalse(visible.get(1).containsKey("ruleDigest"));
        assertEquals(1, intOf(visible.get(0).get("displayOrder")));
        assertEquals(2, intOf(visible.get(1).get("displayOrder")));
        assertOptionKeys(visible.get(0));
        assertEquals(0, harness.controller.bankCalls);
        assertEquals(List.of("fetch", "session-insert"), harness.trace);

        harness.owner.fetchKind = HttpProtectedContentSnapshotTransport.Kind.DENIED;
        Map<String, Object> read = harness.read(String.valueOf(created.get("sessionId")));
        assertEquals(created.get("sessionId"), read.get("sessionId"));
        assertFalse(items(read).get(0).containsKey("ruleDigest"));
        assertFalse(String.valueOf(read).contains(DIGEST_9));
        Map<String, Object> replay = harness.create("create-reading-1", body);
        assertEquals(created.get("sessionId"), replay.get("sessionId"));
        Map<String, Object> reused = harness.create("create-reading-2", body);
        assertEquals(created.get("sessionId"), reused.get("sessionId"));
        assertEquals(1, harness.jdbc.sessions.size());
        assertEquals(SNAPSHOT, harness.onlySession().get("owner_snapshot_ref"));
        assertEquals(HASH, harness.onlySession().get("snapshot_hash"));
        assertEquals(1, harness.owner.fetches);
        assertEquals(List.of("fetch", "session-insert"), harness.trace);
        assertTrue(harness.owner.scores.isEmpty());
    }

    @Test
    void namedItemOpensAOneItemReadingSession() {
        Harness harness = new Harness();
        Map<String, Object> created = harness.create("create-named-9",
                createBody(CODE, VERSION, List.of(9), null));
        assertEquals(1, items(created).size());
        assertEquals(9L, longOf(items(created).get(0).get("itemId")));
        assertFalse(items(created).get(0).containsKey("ruleDigest"));
        String stored = String.valueOf(harness.onlySession().get("items_json"));
        assertTrue(stored.contains(DIGEST_9));
        assertFalse(stored.contains(DIGEST_2));
        assertEquals(SNAPSHOT, harness.onlySession().get("owner_snapshot_ref"));
        assertEquals(1, harness.owner.fetches);
        assertEquals(List.of("fetch", "session-insert"), harness.trace);
    }

    @Test
    void attemptReplayAndDuplicateSubmissionReturnBeforeOwnerHttp() throws Exception {
        Harness harness = new Harness();
        Map<String, Object> created = harness.create("create-replay-submit",
                createBody(CODE, VERSION, null, null));
        String sessionId = String.valueOf(created.get("sessionId"));
        List<Map<String, Object>> submitted = List.of(submitted(9, "beta"));
        Map<String, Object> body = submitBody("sub-replay-1", 1L, submitted, "snap_evil");
        int before = harness.trace.size();
        Map<String, Object> first = harness.submit(sessionId, "attempt-replay-1", body);
        assertEquals(List.of("lock", "fetch", "score", "attempt", "conditional-update", "receipt"),
                harness.trace.subList(before, harness.trace.size()));
        assertEquals(List.of(9L), harness.owner.scores);
        assertEquals("FULL", first.get("scoreBucket"));
        assertMistakes(harness, "2");
        assertFalse(String.valueOf(harness.onlySession()).contains("snap_evil"));
        int fetches = harness.owner.fetches;
        int scores = harness.owner.scores.size();
        int attempts = harness.jdbc.attempts.size();
        harness.owner.fetchKind = HttpProtectedContentSnapshotTransport.Kind.DENIED;
        harness.owner.scoreKind = HttpProtectedContentSnapshotTransport.Kind.DENIED;
        int atReplay = harness.trace.size();
        Map<String, Object> replay = harness.submit(sessionId, "attempt-replay-1", body);
        assertEquals(first.get("attemptId"), replay.get("attemptId"));
        assertEquals(atReplay, harness.trace.size());
        Map<String, Object> duplicateBody = submitBody("sub-replay-1", 99L, submitted, "snap_evil");
        Map<String, Object> duplicate = harness.submit(sessionId, "attempt-replay-dup", duplicateBody);
        assertEquals(first.get("attemptId"), duplicate.get("attemptId"));
        assertEquals(List.of("receipt"), harness.trace.subList(atReplay, harness.trace.size()));
        assertEquals(fetches, harness.owner.fetches);
        assertEquals(scores, harness.owner.scores.size());
        assertEquals(attempts, harness.jdbc.attempts.size());
        assertEquals(2L, longOf(harness.onlySession().get("state_version")));
    }

    @Test
    void laterSubmissionGradesOnlyTheNewItem() throws Exception {
        Harness harness = new Harness();
        String sessionId = String.valueOf(harness.create("create-later",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        Map<String, Object> first = harness.submit(sessionId, "attempt-later-9",
                submitBody("sub-later-9", 1L, List.of(submitted(9, "beta")), null));
        assertEquals(List.of(9L), harness.owner.scores);
        assertMistakes(harness, "2");
        assertEquals("IN_PROGRESS", harness.onlySession().get("status"));
        assertEquals(STARTED, harness.mapper.readTree(harness.jdbc.reportPinJson).path("pinnedAt").asText());
        assertEquals(VERSION, harness.mapper.readTree(harness.jdbc.reportPinJson).path("snapshotId").asLong());
        assertFalse(harness.mapper.readTree(harness.jdbc.reportPinJson).path("snapshotId").isTextual());
        JsonNode firstReport = reportPayload(harness, 0);
        assertEquals("ZERO", firstReport.path("scoreBucket").asText());
        assertEquals(2, firstReport.path("totalItems").asInt());
        assertEquals(1, firstReport.path("totalCorrect").asInt());
        assertEquals(1, firstReport.path("totalMistakes").asInt());
        JsonNode firstItem = itemPayloads(harness).get(0);
        assertEquals(DIGEST_9, firstItem.path("rulePin").path("ruleDigest").asText());
        assertEquals(SNAPSHOT, firstItem.path("contentPin").path("snapshotId").asText());
        assertEquals(4, firstItem.path("contentPin").path("contentEpoch").asInt());
        assertEquals("li_90000000", firstItem.path("logicalItemId").asText());
        assertEquals("CORRECT_VERIFIED", firstItem.path("objectiveOutcome").asText());
        assertNoAnswerLeak(firstItem);
        assertEquals("FULL", first.get("scoreBucket"));

        Map<String, Object> second = harness.submit(sessionId, "attempt-later-2",
                submitBody("sub-later-2", 2L, List.of(submitted(2, "aye")), null));
        assertEquals(List.of(9L, 2L), harness.owner.scores);
        assertEquals("ZERO", second.get("scoreBucket"));
        assertEquals("ASSESSED", harness.onlySession().get("status"));
        assertEquals(3L, longOf(harness.onlySession().get("state_version")));
        assertMistakes(harness, "2");
        List<JsonNode> items = itemPayloads(harness);
        assertEquals(2, items.size());
        assertEquals(DIGEST_2, items.get(1).path("rulePin").path("ruleDigest").asText());
        assertEquals("li_20000000", items.get(1).path("logicalItemId").asText());
        assertEquals("INCORRECT", items.get(1).path("objectiveOutcome").asText());
        assertNoAnswerLeak(items.get(1));
        assertTrue(String.valueOf(harness.onlySession().get("answers_json")).contains("beta"));
        assertTrue(String.valueOf(harness.onlySession().get("answers_json")).contains("aye"));

        int fetches = harness.owner.fetches;
        int at = harness.trace.size();
        ResponseStatusException sealed = harness.failSubmit(sessionId, "attempt-later-sealed",
                submitBody("sub-later-sealed", 3L, List.of(submitted(9, "beta")), null));
        assertHttp(sealed, 409, "protected assessment answer is already sealed");
        assertEquals(List.of("lock", "fetch"), harness.trace.subList(at, harness.trace.size()));
        assertEquals(List.of(9L, 2L), harness.owner.scores);
        assertEquals(fetches + 1, harness.owner.fetches);
        assertEquals(2, harness.jdbc.attempts.size());
        assertEquals(3L, longOf(harness.onlySession().get("state_version")));
    }

    @Test
    void laterOwnerGoneDoesNotRescoreTheEarlierItem() {
        Harness harness = new Harness();
        String sessionId = String.valueOf(harness.create("create-later-gone",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        harness.submit(sessionId, "attempt-gone-9",
                submitBody("sub-gone-9", 1L, List.of(submitted(9, "beta")), null));
        assertEquals(List.of(9L), harness.owner.scores);
        String stamp = pinStamp(harness.onlySession());
        harness.owner.fetchKind = HttpProtectedContentSnapshotTransport.Kind.UNAVAILABLE;
        int at = harness.trace.size();
        ResponseStatusException gone = harness.failSubmit(sessionId, "attempt-gone-2",
                submitBody("sub-gone-2", 2L, List.of(submitted(2, "aye")), null));
        assertHttp(gone, 410, "protected content snapshot is unavailable");
        assertEquals(List.of("lock", "fetch"), harness.trace.subList(at, harness.trace.size()));
        assertEquals(List.of(9L), harness.owner.scores);
        assertEquals(1, harness.jdbc.attempts.size());
        assertEquals(stamp, pinStamp(harness.onlySession()));
        assertFalse(String.valueOf(harness.onlySession().get("answers_json")).contains("aye"));
        assertEquals(0, harness.controller.bankCalls);
    }

    @Test
    void changedPinOrStaleVersionWritesNothing() {
        Harness harness = new Harness();
        String sessionId = String.valueOf(harness.create("create-pin-guard",
                createBody(CODE, VERSION, null, "snap_client_1001")).get("sessionId"));
        String stamp = pinStamp(harness.onlySession());
        assertPinMismatch(harness, sessionId, () -> harness.owner.hash = "ff".repeat(32),
                () -> harness.owner.hash = HASH);
        assertPinMismatch(harness, sessionId, () -> harness.owner.snapshotId = "snap_reading_1002",
                () -> harness.owner.snapshotId = SNAPSHOT);
        assertPinMismatch(harness, sessionId,
                () -> harness.owner.snapshotId = "snap_p1.placement.v1-266100",
                () -> harness.owner.snapshotId = SNAPSHOT);
        assertPinMismatch(harness, sessionId, () -> harness.owner.digest9 = "12".repeat(32),
                () -> harness.owner.digest9 = DIGEST_9);
        assertEquals(stamp, pinStamp(harness.onlySession()));
        assertTrue(harness.owner.scores.isEmpty());
        assertTrue(harness.jdbc.attempts.isEmpty());
        assertTrue(harness.jdbc.events.isEmpty());
        assertEquals(5, harness.owner.fetches);
        assertFalse(String.valueOf(harness.onlySession()).contains("snap_client_1001"));
        assertFalse(String.valueOf(harness.onlySession()).contains("snap_evil"));

        int fetches = harness.owner.fetches;
        int at = harness.trace.size();
        ResponseStatusException stale = harness.failSubmit(sessionId, "attempt-stale",
                submitBody("sub-stale", 9L, List.of(submitted(9, "beta")), "snap_evil"));
        assertHttp(stale, 409, "assessment state version is stale");
        assertEquals(List.of(), harness.trace.subList(at, harness.trace.size()));
        assertEquals(fetches, harness.owner.fetches);
        assertEquals(stamp, pinStamp(harness.onlySession()));
        assertNull(harness.jdbc.claims.get("B10_ATTEMPT_SUBMIT|attempt-stale"));
        assertEquals(1, harness.jdbc.claims.size());
    }

    @Test
    void ownerRefusalDoesNotSubstituteOrOpenASession() {
        assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind.DENIED, 403,
                "protected content snapshot was denied");
        assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind.UNAVAILABLE, 410,
                "protected content snapshot is unavailable");
        assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, 503,
                "protected content snapshot transport failed");
        assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind.CONFLICT, 409,
                "protected content pin does not match");
        assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind.INVALID, 503,
                "protected content snapshot request is invalid");

        Harness missing = new Harness();
        missing.owner.fetchKind = HttpProtectedContentSnapshotTransport.Kind.NOT_FOUND;
        ResponseStatusException closed = missing.failCreate("create-not-found",
                createBody(CODE, VERSION, null, null));
        assertHttp(closed, 409, "CLOSED_MISSING");
        assertTrue(missing.jdbc.sessions.isEmpty());
        assertTrue(missing.jdbc.claims.isEmpty());
        assertEquals(List.of("fetch"), missing.trace);
        assertEquals(0, missing.controller.bankCalls);

        Harness unknown = new Harness();
        ResponseStatusException unavailable = unknown.failCreate("create-unknown-99",
                createBody(CODE, VERSION, List.of(99), null));
        assertHttp(unavailable, 410, "assessment content is unavailable");
        assertTrue(unknown.jdbc.sessions.isEmpty());
        assertTrue(unknown.jdbc.claims.isEmpty());
        assertEquals(List.of("fetch"), unknown.trace);

        Harness shaped = new Harness();
        shaped.owner.snapshotId = "snap_p1.placement.v1-266100";
        ResponseStatusException mismatched = shaped.failCreate("create-shaped",
                createBody(CODE, VERSION, null, null));
        assertHttp(mismatched, 409, "protected content pin does not match");
        assertTrue(shaped.jdbc.sessions.isEmpty());
        assertTrue(shaped.jdbc.claims.isEmpty());
        assertEquals(List.of("fetch"), shaped.trace);

        Harness submit = new Harness();
        String sessionId = String.valueOf(submit.create("create-refuse-submit",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        submit.jdbc.localRules.add(localRule(CODE, VERSION, "9", "READING", "beta"));
        submit.jdbc.ruleQueries.clear();
        assertSubmitRefusal(submit, sessionId, HttpProtectedContentSnapshotTransport.Kind.DENIED, 403,
                "protected content snapshot was denied");
        assertSubmitRefusal(submit, sessionId, HttpProtectedContentSnapshotTransport.Kind.NOT_FOUND, 410,
                "protected content snapshot was not found");
        assertSubmitRefusal(submit, sessionId, HttpProtectedContentSnapshotTransport.Kind.UNAVAILABLE, 410,
                "protected content snapshot is unavailable");
        assertSubmitRefusal(submit, sessionId, HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, 503,
                "protected content snapshot transport failed");
        assertTrue(submit.jdbc.attempts.isEmpty());
        assertTrue(submit.owner.scores.isEmpty());
        assertTrue(submit.jdbc.ruleQueries.isEmpty());
        assertEquals(0, submit.controller.bankCalls);
        assertEquals("{}", submit.onlySession().get("answers_json"));
        assertEquals(1L, longOf(submit.onlySession().get("state_version")));
    }

    @Test
    void inconsistentOutcomeDoesNotSynthesizeAScore() {
        Harness half = new Harness();
        String halfSession = String.valueOf(half.create("create-half",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        half.owner.forcedOutcome = "HALF";
        int at = half.trace.size();
        ResponseStatusException inconsistent = half.failSubmit(halfSession, "attempt-half",
                submitBody("sub-half", 1L, List.of(submitted(9, "beta")), null));
        assertHttp(inconsistent, 409, "protected content outcome is inconsistent");
        assertEquals(List.of("lock", "fetch", "score"), half.trace.subList(at, half.trace.size()));
        assertEquals(List.of(9L), half.owner.scores);
        assertTrue(half.jdbc.attempts.isEmpty());
        assertTrue(half.jdbc.events.isEmpty());
        assertEquals("{}", half.onlySession().get("answers_json"));
        assertEquals(1L, longOf(half.onlySession().get("state_version")));
        assertFalse(String.valueOf(half.jdbc.claims).contains("PROTECTED_CONTENT"));

        Harness harness = new Harness();
        String sessionId = String.valueOf(harness.create("create-corrupt",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        harness.submit(sessionId, "attempt-corrupt-9",
                submitBody("sub-corrupt-9", 1L, List.of(submitted(9, "beta")), null));
        assertEquals(List.of(9L), harness.owner.scores);
        harness.jdbc.attempts.values().iterator().next().put("mistake_codes_json", "[]");
        String stamp = pinStamp(harness.onlySession());
        int mark = harness.trace.size();
        ResponseStatusException corrupt = harness.failSubmit(sessionId, "attempt-corrupt-2",
                submitBody("sub-corrupt-2", 2L, List.of(submitted(2, "aye")), null));
        assertHttp(corrupt, 409, "protected content outcome is inconsistent");
        assertEquals(List.of("lock", "fetch"), harness.trace.subList(mark, harness.trace.size()));
        assertEquals(List.of(9L), harness.owner.scores);
        assertEquals(1, harness.jdbc.attempts.size());
        assertEquals(stamp, pinStamp(harness.onlySession()));
        assertEquals("[]", harness.jdbc.attempts.values().iterator().next().get("mistake_codes_json"));
    }

    @Test
    void localGrammarReadingPlacementAndLegacySessionsStayLocal() {
        Harness grammar = new Harness();
        grammar.jdbc.localRules.add(localRule("grammar.unit.one", 31L, "101", "GRAMMAR", "a"));
        grammar.jdbc.localRules.add(localRule("grammar.unit.one", 31L, "102", "GRAMMAR", "a"));
        grammar.jdbc.localRules.add(localRule("grammar.unit.one", 31L, "103", "GRAMMAR", "a"));
        Map<String, Object> grammarView = grammar.create("create-grammar",
                createBody("grammar.unit.one", 31L, null, null));
        assertEquals(3, items(grammarView).size());
        assertNull(grammar.onlySession().get("owner_snapshot_ref"));
        assertFalse(grammar.trace.contains("fetch"));
        assertEquals(0, grammar.owner.fetches);
        assertEquals(0, grammar.controller.bankCalls);
        grammar.submit(String.valueOf(grammarView.get("sessionId")), "attempt-grammar",
                submitBody("sub-grammar", 1L, List.of(submitted(101, "a")), null));
        assertFalse(grammar.trace.contains("fetch"));
        assertFalse(grammar.trace.contains("lock"));
        assertTrue(grammar.trace.contains("legacy-update"));
        assertFalse(grammar.trace.contains("conditional-update"));
        assertTrue(grammar.owner.scores.isEmpty());
        assertEquals(1, grammar.jdbc.attempts.size());

        Harness reading = new Harness();
        reading.jdbc.localRules.add(localRule("unit-rdg-01", 32L, "201", "READING", "a"));
        reading.jdbc.localRules.add(localRule("unit-rdg-01", 32L, "202", "READING", "a"));
        Map<String, Object> readingView = reading.create("create-rdg",
                createBody("unit-rdg-01", 32L, null, null));
        assertEquals(2, items(readingView).size());
        assertNull(reading.onlySession().get("owner_snapshot_ref"));
        assertEquals(0, reading.owner.fetches);
        assertEquals(0, reading.controller.bankCalls);
        reading.submit(String.valueOf(readingView.get("sessionId")), "attempt-rdg",
                submitBody("sub-rdg", 1L, List.of(submitted(201, "a")), null));
        assertEquals(0, reading.owner.fetches);
        assertTrue(reading.owner.scores.isEmpty());
        assertFalse(reading.trace.contains("lock"));
        assertTrue(reading.trace.contains("legacy-update"));

        Harness placement = new Harness();
        placement.controller.bankAvailable = true;
        Map<String, Object> placed = placement.create("create-placement",
                createBody("p1.placement.v1", 266100L, List.of(266004), null));
        assertEquals("snap_p1.placement.v1-266100", placement.onlySession().get("owner_snapshot_ref"));
        assertFalse(B10AssessmentJdbcController.protectedReadingSession(placement.onlySession()));
        assertEquals(266100L, longOf(pinOf(placed).get("snapshotId")));
        assertEquals(0, placement.owner.fetches);
        assertEquals(1, placement.controller.bankCalls);
        Map<String, Object> graded = placement.submit(String.valueOf(placed.get("sessionId")),
                "attempt-placement", submitBody("sub-placement", 1L, List.of(submitted(266004, "b")), null));
        assertEquals("FULL", graded.get("scoreBucket"));
        assertEquals(2, placement.controller.bankCalls);
        assertEquals(0, placement.owner.fetches);
        assertTrue(placement.owner.scores.isEmpty());
        assertTrue(placement.trace.contains("legacy-update"));
        assertFalse(placement.trace.contains("lock"));
        assertFalse(placement.trace.contains("conditional-update"));

        Harness outage = new Harness();
        ResponseStatusException offline = outage.failCreate("create-placement-outage",
                createBody("p1.placement.v1", 266100L, List.of(266004), null));
        assertHttp(offline, 410, "assessment content is unavailable");
        assertEquals(0, outage.owner.fetches);
        assertEquals(1, outage.controller.bankCalls);
        assertTrue(outage.jdbc.sessions.isEmpty());
        assertFalse(outage.trace.contains("fetch"));
        assertFalse(outage.trace.contains("session-insert"));

        Harness legacy = new Harness();
        legacy.jdbc.localRules.add(localRule("course-b25-basics", 25001L, "1001", "VOCABULARY", "b"));
        legacy.jdbc.sessions.put("asess_legacy_null_ref", legacySession());
        Map<String, Object> legacyGrade = legacy.submit("asess_legacy_null_ref", "attempt-legacy",
                submitBody("sub-legacy", 1L, List.of(submitted(1001, "b")), null));
        assertEquals("FULL", legacyGrade.get("scoreBucket"));
        assertEquals(1, legacy.jdbc.attempts.size());
        assertEquals(0, legacy.owner.fetches);
        assertEquals(0, legacy.controller.bankCalls);
        assertTrue(legacy.owner.scores.isEmpty());
        assertTrue(legacy.trace.contains("legacy-update"));
        assertFalse(legacy.trace.contains("lock"));
        assertFalse(legacy.trace.contains("fetch"));
        assertNull(legacy.jdbc.sessions.get("asess_legacy_null_ref").get("owner_snapshot_ref"));
    }

    @Test
    void failedScoreRollsBackSoTheSameKeyCanReplay() {
        Harness harness = new Harness();
        String sessionId = String.valueOf(harness.create("create-rollback",
                createBody(CODE, VERSION, null, null)).get("sessionId"));
        harness.owner.failSecondScore = true;
        Map<String, Object> both = submitBody("sub-both", 1L,
                List.of(submitted(9, "beta"), submitted(2, "aye")), null);
        int at = harness.trace.size();
        ResponseStatusException failed = harness.failSubmit(sessionId, "attempt-both", both);
        assertHttp(failed, 503, "protected content snapshot transport failed");
        assertEquals(List.of("lock", "fetch", "score", "score"), harness.trace.subList(at, harness.trace.size()));
        assertEquals(List.of(9L, 2L), harness.owner.scores);
        assertTrue(harness.jdbc.attempts.isEmpty());
        assertTrue(harness.jdbc.events.isEmpty());
        assertEquals("{}", harness.onlySession().get("answers_json"));
        assertEquals(1L, longOf(harness.onlySession().get("state_version")));
        assertEquals(0L, longOf(harness.onlySession().get("attempt_count")));
        assertEquals(1, harness.jdbc.claims.size());
        assertNotNull(harness.jdbc.claims.get("B10_SESSION_CREATE|create-rollback"));
        assertNull(harness.jdbc.claims.get("B10_ATTEMPT_SUBMIT|attempt-both"));

        harness.owner.failSecondScore = false;
        int retryAt = harness.trace.size();
        Map<String, Object> graded = harness.submit(sessionId, "attempt-both", both);
        assertEquals(List.of("lock", "fetch", "score", "score", "attempt", "conditional-update", "receipt"),
                harness.trace.subList(retryAt, harness.trace.size()));
        assertEquals(List.of(9L, 2L, 9L, 2L), harness.owner.scores);
        assertEquals(1, harness.jdbc.attempts.size());
        assertFalse(harness.trace.contains("legacy-update"));
        assertTrue(String.valueOf(harness.onlySession().get("answers_json")).contains("beta"));
        assertTrue(String.valueOf(harness.onlySession().get("answers_json")).contains("aye"));
        int fetches = harness.owner.fetches;
        int replayAt = harness.trace.size();
        Map<String, Object> replay = harness.submit(sessionId, "attempt-both", both);
        assertEquals(graded.get("attemptId"), replay.get("attemptId"));
        assertEquals(replayAt, harness.trace.size());
        assertEquals(fetches, harness.owner.fetches);
        assertEquals(4, harness.owner.scores.size());
        assertEquals(1, harness.jdbc.attempts.size());
    }

    @Test
    void ownerTransportStaysInactiveWithoutTheFlag() throws Exception {
        Method transport = null;
        Method token = null;
        Method placement = null;
        for (Method method : AssessmentPersistenceConfiguration.class.getDeclaredMethods()) {
            if (method.getReturnType() == HttpProtectedContentSnapshotTransport.class) transport = method;
            if ("assessmentOwnerWorkloadToken".equals(method.getName())) token = method;
            if ("placementRuleScorePort".equals(method.getName())) placement = method;
        }
        assertNotNull(transport);
        assertNotNull(token);
        assertNotNull(placement);
        assertDisabledUnlessEnabled(transport);
        assertDisabledUnlessEnabled(token);
        Qualifier tokenQualifier = token.getAnnotation(Qualifier.class);
        assertNotNull(tokenQualifier);
        assertEquals("assessmentOwnerWorkloadToken", tokenQualifier.value());
        boolean transportQualifier = false;
        for (Class<?> type : transport.getParameterTypes()) {
            assertFalse(Authentication.class.isAssignableFrom(type));
        }
        for (java.lang.annotation.Annotation[] group : transport.getParameterAnnotations()) {
            for (java.lang.annotation.Annotation annotation : group) {
                if (annotation instanceof Qualifier qualifier
                        && "assessmentOwnerWorkloadToken".equals(qualifier.value())) {
                    transportQualifier = true;
                }
            }
        }
        assertTrue(transportQualifier);
        boolean placementProvider = false;
        for (Class<?> type : placement.getParameterTypes()) {
            if (ObjectProvider.class.isAssignableFrom(type)) placementProvider = true;
        }
        assertTrue(placementProvider);
        Method read = B10AssessmentJdbcController.class.getDeclaredMethod(
                "protectedReading", long.class, String.class);
        assertEquals(2, read.getParameterCount());
        Method score = B10AssessmentJdbcController.class.getDeclaredMethod(
                "scoreProtected", B10AssessmentJdbcController.OwnerReading.class, long.class, String.class);
        assertEquals(3, score.getParameterCount());
        for (Class<?> type : score.getParameterTypes()) {
            assertFalse(Authentication.class.isAssignableFrom(type));
        }
        boolean fourArg = false;
        boolean autowired = false;
        for (Constructor<?> constructor : B10AssessmentJdbcController.class.getDeclaredConstructors()) {
            Class<?>[] types = constructor.getParameterTypes();
            if (types.length == 4 && types[3] == PlacementRuleScorePort.class) fourArg = true;
            if (constructor.getAnnotation(Autowired.class) != null) {
                autowired = true;
                assertEquals(5, types.length);
                assertTrue(ObjectProvider.class.isAssignableFrom(types[4]));
            }
        }
        assertTrue(fourArg);
        assertTrue(autowired);
        try (InputStream in = AssessmentPersistenceConfiguration.class.getClassLoader()
                .getResourceAsStream("application.yml")) {
            assertNotNull(in);
            String yml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            assertFalse(yml.contains("protected-reading"));
        }

        List<String> trace = new ArrayList<>();
        ReadingJdbc jdbc = new ReadingJdbc(trace);
        ObjectMapper mapper = new ObjectMapper();
        B10AssessmentJdbcController plain = new B10AssessmentJdbcController(jdbc, mapper, "http://127.0.0.1:9");
        ResponseStatusException closed = assertThrows(ResponseStatusException.class, () -> call(jdbc,
                () -> plain.createSession(learner(), createBody(CODE, VERSION, null, null), "plain-closed", null)));
        assertHttp(closed, 409, "CLOSED_MISSING");
        assertTrue(jdbc.sessions.isEmpty());
        assertFalse(trace.contains("fetch"));
        assertFalse(trace.contains("session-insert"));
        ResponseStatusException named = assertThrows(ResponseStatusException.class, () -> call(jdbc,
                () -> plain.createSession(learner(), createBody(CODE, VERSION, List.of(9), null),
                        "plain-named", null)));
        assertHttp(named, 410, "assessment content is unavailable");
        assertTrue(jdbc.sessions.isEmpty());
        assertTrue(jdbc.claims.isEmpty());

        jdbc.localRules.add(localRule(CODE, VERSION, "9", "READING", "beta"));
        jdbc.sessions.put("asess_protected_off", protectedSeed(mapper));
        jdbc.ruleQueries.clear();
        int at = trace.size();
        ResponseStatusException offline = assertThrows(ResponseStatusException.class, () -> call(jdbc,
                () -> plain.submitAttempt(learner(), "asess_protected_off",
                        submitBody("sub-off", 1L, List.of(submitted(9, "beta")), null),
                        "attempt-off", "req-protected-01", "0123456789abcdef0123456789abcdef")));
        assertHttp(offline, 503, "protected content snapshot transport is unavailable");
        assertEquals(List.of("lock"), trace.subList(at, trace.size()));
        assertTrue(jdbc.attempts.isEmpty());
        assertTrue(jdbc.ruleQueries.isEmpty());
        assertTrue(jdbc.events.isEmpty());
        assertEquals("{}", jdbc.sessions.get("asess_protected_off").get("answers_json"));
        assertEquals(1L, longOf(jdbc.sessions.get("asess_protected_off").get("state_version")));
        assertNull(jdbc.claims.get("B10_ATTEMPT_SUBMIT|attempt-off"));
    }

    private static void assertCreateRefusal(HttpProtectedContentSnapshotTransport.Kind kind, int status, String reason) {
        Harness harness = new Harness();
        harness.owner.fetchKind = kind;
        ResponseStatusException ex = harness.failCreate("create-" + kind.name(),
                createBody(CODE, VERSION, null, null));
        assertHttp(ex, status, reason);
        assertTrue(harness.jdbc.sessions.isEmpty());
        assertTrue(harness.jdbc.claims.isEmpty());
        assertEquals(List.of("fetch"), harness.trace);
        assertFalse(harness.trace.contains("session-insert"));
        assertEquals(0, harness.controller.bankCalls);
        assertTrue(harness.owner.scores.isEmpty());
    }

    private static void assertSubmitRefusal(Harness harness, String sessionId,
            HttpProtectedContentSnapshotTransport.Kind kind, int status, String reason) {
        harness.owner.fetchKind = kind;
        int at = harness.trace.size();
        int fetches = harness.owner.fetches;
        ResponseStatusException ex = harness.failSubmit(sessionId, "attempt-" + kind.name(),
                submitBody("sub-" + kind.name(), 1L, List.of(submitted(9, "beta")), null));
        assertHttp(ex, status, reason);
        assertEquals(List.of("lock", "fetch"), harness.trace.subList(at, harness.trace.size()));
        assertEquals(fetches + 1, harness.owner.fetches);
        harness.owner.fetchKind = null;
    }

    private static void assertPinMismatch(Harness harness, String sessionId, Runnable change, Runnable restore) {
        change.run();
        int at = harness.trace.size();
        ResponseStatusException ex = harness.failSubmit(sessionId, "attempt-pin-" + at,
                submitBody("sub-pin-" + at, 1L, List.of(submitted(9, "beta")), "snap_evil"));
        assertHttp(ex, 409, "protected content pin does not match");
        assertEquals(List.of("lock", "fetch"), harness.trace.subList(at, harness.trace.size()));
        assertTrue(harness.owner.scores.isEmpty());
        assertTrue(harness.jdbc.attempts.isEmpty());
        restore.run();
    }

    private static void assertDisabledUnlessEnabled(Method method) {
        ConditionalOnProperty property = method.getAnnotation(ConditionalOnProperty.class);
        assertNotNull(property);
        assertEquals("assessment.protected-reading", property.prefix());
        assertArrayEquals(new String[] {"enabled"}, property.name());
        assertEquals("true", property.havingValue());
        assertFalse(property.matchIfMissing());
    }

    private static void assertHttp(ResponseStatusException ex, int status, String reason) {
        assertEquals(status, ex.getStatusCode().value());
        assertEquals(reason, ex.getReason());
    }

    private static void assertMistakes(Harness harness, String itemId) throws Exception {
        assertFalse(harness.jdbc.attempts.isEmpty());
        for (Map<String, Object> attempt : harness.jdbc.attempts.values()) {
            JsonNode mistakes = harness.mapper.readTree(String.valueOf(attempt.get("mistake_codes_json")));
            assertEquals(1, mistakes.size());
            assertEquals(itemId, mistakes.get(0).asText());
            assertFalse(String.valueOf(attempt.get("mistake_codes_json")).contains("item."));
            assertFalse(String.valueOf(attempt.get("mistake_codes_json")).contains("\"9\""));
        }
    }

    private static void assertNoAnswerLeak(JsonNode payload) {
        String raw = payload.toString();
        assertFalse(raw.contains("\"beta\""));
        assertFalse(raw.contains("\"aye\""));
        assertFalse(raw.contains("PROTECTED_CONTENT"));
        assertFalse(raw.contains("answer_rule"));
        assertFalse(raw.contains("correctKey"));
    }

    private static void assertOptionKeys(Map<String, Object> item) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> options = (List<Map<String, Object>>) item.get("options");
        assertFalse(options.isEmpty());
        for (Map<String, Object> option : options) {
            assertEquals(2, option.size());
            assertTrue(option.containsKey("optionId"));
            assertTrue(option.containsKey("label"));
        }
    }

    private static List<JsonNode> itemPayloads(Harness harness) throws Exception {
        List<JsonNode> payloads = new ArrayList<>();
        for (Map<String, Object> event : harness.jdbc.events) {
            if (!"assessment.item.assessed.v2".equals(event.get("event_name"))) continue;
            payloads.add(harness.mapper.readTree(String.valueOf(event.get("payload_json"))).path("payload"));
        }
        return payloads;
    }

    private static JsonNode reportPayload(Harness harness, int index) throws Exception {
        int seen = 0;
        for (Map<String, Object> event : harness.jdbc.events) {
            if (!"learning.report.ready.v1".equals(event.get("event_name"))) continue;
            if (seen++ == index) {
                return harness.mapper.readTree(String.valueOf(event.get("payload_json"))).path("payload");
            }
        }
        throw new AssertionError("missing report event");
    }

    private static String pinStamp(Map<String, Object> row) {
        return row.get("owner_snapshot_ref")
                + "|" + longOf(row.get("content_epoch"))
                + "|" + row.get("snapshot_hash")
                + "|" + longOf(row.get("snapshot_id"))
                + "|" + row.get("items_json")
                + "|" + row.get("answers_json")
                + "|" + longOf(row.get("state_version"))
                + "|" + longOf(row.get("attempt_count"));
    }

    private static Map<String, Object> legacySession() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("session_id", "asess_legacy_null_ref");
        row.put("principal_id", SUBJECT);
        row.put("tenant_id", "platform");
        row.put("mode", "PRACTICE");
        row.put("status", "IN_PROGRESS");
        row.put("content_code", "course-b25-basics");
        row.put("content_version_id", 25001L);
        row.put("content_epoch", 1L);
        row.put("snapshot_id", 25001L);
        row.put("snapshot_hash", HASH);
        row.put("owner_snapshot_ref", null);
        row.put("items_json", "[{\"itemId\":1001,\"itemCode\":\"1001\",\"itemType\":\"VOCABULARY\","
                + "\"stem\":\"Local\",\"options\":[],\"displayOrder\":0}]");
        row.put("answers_json", "{}");
        row.put("state_version", 1L);
        row.put("attempt_count", 0L);
        row.put("started_at", Timestamp.from(Instant.parse(STARTED)));
        return row;
    }

    private static Map<String, Object> protectedSeed(ObjectMapper mapper) throws Exception {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemId", 9);
        item.put("itemCode", "9");
        item.put("itemType", "READING");
        item.put("stem", "Stem nine");
        item.put("options", List.of(Map.of("optionId", "beta", "label", "Beta")));
        item.put("displayOrder", 1);
        item.put("ruleDigest", DIGEST_9);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("session_id", "asess_protected_off");
        row.put("principal_id", SUBJECT);
        row.put("tenant_id", "platform");
        row.put("mode", "PRACTICE");
        row.put("status", "IN_PROGRESS");
        row.put("content_code", CODE);
        row.put("content_version_id", VERSION);
        row.put("content_epoch", 4L);
        row.put("snapshot_id", VERSION);
        row.put("snapshot_hash", HASH);
        row.put("owner_snapshot_ref", SNAPSHOT);
        row.put("items_json", mapper.writeValueAsString(List.of(item)));
        row.put("answers_json", "{}");
        row.put("state_version", 1L);
        row.put("attempt_count", 0L);
        row.put("started_at", Timestamp.from(Instant.parse(STARTED)));
        return row;
    }

    private static Map<String, Object> localRule(String code, long version, String itemId,
            String dimension, String answer) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("content_code", code);
        row.put("content_version_id", version);
        row.put("item_id", itemId);
        row.put("prompt", "Prompt " + itemId);
        row.put("options_json", "[{\"optionId\":\"" + answer + "\",\"label\":\"Label\"}]");
        row.put("dimension", dimension);
        row.put("answer_rule_json", "{\"answer\":\"" + answer + "\"}");
        return row;
    }

    private static Map<String, Object> createBody(String code, long version, List<?> itemIds, String clientSnapshot) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contentCode", code);
        body.put("contentVersionId", version);
        body.put("mode", "PRACTICE");
        if (itemIds != null) body.put("itemIds", itemIds);
        if (clientSnapshot != null) body.put("snapshotId", clientSnapshot);
        return body;
    }

    private static Map<String, Object> submitBody(String submissionId, long version,
            List<Map<String, Object>> items, String clientSnapshot) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("submissionId", submissionId);
        body.put("expectedStateVersion", version);
        body.put("items", items);
        if (clientSnapshot != null) body.put("snapshotId", clientSnapshot);
        return body;
    }

    private static Map<String, Object> submitted(long itemId, String option) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("itemId", itemId);
        row.put("response", option);
        return row;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> pinOf(Map<String, Object> view) {
        return (Map<String, Object>) view.get("pin");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> view) {
        return (List<Map<String, Object>>) view.get("items");
    }

    private static long longOf(Object value) {
        return ((Number) value).longValue();
    }

    private static int intOf(Object value) {
        return ((Number) value).intValue();
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-11-06T00:00:00Z"))
                .expiresAt(Instant.parse("2026-11-06T01:00:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write", "assessment.session.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private static <T> T call(ReadingJdbc jdbc, Work<T> work) {
        jdbc.begin();
        try {
            T value = work.run();
            jdbc.commit();
            return value;
        } catch (ResponseStatusException ex) {
            jdbc.rollback();
            throw ex;
        } catch (Exception ex) {
            jdbc.rollback();
            if (ex instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException(ex);
        }
    }

    @FunctionalInterface
    private interface Work<T> {
        T run() throws Exception;
    }

    private static final class Harness {
        final List<String> trace = new ArrayList<>();
        final OwnerDouble owner = new OwnerDouble();
        final ReadingJdbc jdbc = new ReadingJdbc(trace);
        final ObjectMapper mapper = new ObjectMapper();
        final ReadingController controller = new ReadingController(jdbc, mapper, owner, trace);

        Map<String, Object> create(String key, Map<String, Object> body) {
            return data(call(jdbc, () -> controller.createSession(learner(), body, key, null)));
        }

        Map<String, Object> read(String sessionId) {
            return data(controller.readSession(learner(), sessionId));
        }

        Map<String, Object> submit(String sessionId, String key, Map<String, Object> body) {
            return data(call(jdbc, () -> controller.submitAttempt(learner(), sessionId, body, key,
                    "req-protected-01", "0123456789abcdef0123456789abcdef")));
        }

        ResponseStatusException failCreate(String key, Map<String, Object> body) {
            return assertThrows(ResponseStatusException.class, () -> create(key, body));
        }

        ResponseStatusException failSubmit(String sessionId, String key, Map<String, Object> body) {
            return assertThrows(ResponseStatusException.class, () -> submit(sessionId, key, body));
        }

        Map<String, Object> onlySession() {
            assertEquals(1, jdbc.sessions.size());
            return jdbc.sessions.values().iterator().next();
        }

        String claim(String operation, String key) {
            Map<String, Object> row = jdbc.claims.get(operation + "|" + key);
            assertNotNull(row);
            return String.valueOf(row.get("response_json"));
        }
    }

    private static final class ReadingController extends B10AssessmentJdbcController {
        final OwnerDouble owner;
        final List<String> trace;
        int bankCalls;
        boolean bankAvailable;

        ReadingController(ReadingJdbc jdbc, ObjectMapper mapper, OwnerDouble owner, List<String> trace) {
            super(jdbc, mapper, "http://127.0.0.1:9");
            this.owner = owner;
            this.trace = trace;
        }

        @Override
        B10AssessmentJdbcController.OwnerReading protectedReading(long contentVersionId, String contentCode) {
            trace.add("fetch");
            owner.fetches++;
            return owner.load(contentVersionId, contentCode);
        }

        @Override
        B10AssessmentJdbcController.OwnerDecision scoreProtected(
                B10AssessmentJdbcController.OwnerReading reading, long itemId, String selected) {
            trace.add("score");
            return owner.decide(itemId, selected);
        }

        @Override
        BankPracticeRuleProvider.BankRules bankRules(String contentCode, long contentVersionId, String authorization) {
            bankCalls++;
            if (!bankAvailable || !"p1.placement.v1".equals(contentCode) || contentVersionId != 266100L) return null;
            List<Map<String, Object>> rows = List.of(Map.of(
                    "item_id", "266004", "content_version_id", 266100L,
                    "prompt", "She ___ to school every day.",
                    "options_json", "[{\"optionId\":\"b\",\"label\":\"goes\"}]",
                    "dimension", "GRAMMAR", "answer_rule_json", "{\"answer\":\"b\"}"));
            return new BankPracticeRuleProvider.BankRules(266100L, 1L, "a".repeat(64), rows,
                    "snap_p1.placement.v1-266100");
        }
    }

    private static final class OwnerDouble {
        long version = VERSION;
        String code = CODE;
        long epoch = 4L;
        String snapshotId = SNAPSHOT;
        String hash = HASH;
        String digest9 = DIGEST_9;
        String digest2 = DIGEST_2;
        HttpProtectedContentSnapshotTransport.Kind fetchKind;
        HttpProtectedContentSnapshotTransport.Kind scoreKind;
        String forcedOutcome;
        boolean failSecondScore;
        int fetches;
        final List<Long> scores = new ArrayList<>();

        B10AssessmentJdbcController.OwnerReading load(long requestedVersion, String requestedCode) {
            if (requestedVersion < 1 || requestedCode == null || requestedCode.isBlank()) {
                throw new HttpProtectedContentSnapshotTransport.Refusal(
                        HttpProtectedContentSnapshotTransport.Kind.INVALID,
                        message(HttpProtectedContentSnapshotTransport.Kind.INVALID));
            }
            if (fetchKind != null) {
                throw new HttpProtectedContentSnapshotTransport.Refusal(fetchKind, message(fetchKind));
            }
            return new B10AssessmentJdbcController.OwnerReading(version, code, epoch, snapshotId, hash, items());
        }

        B10AssessmentJdbcController.OwnerDecision decide(long itemId, String selected) {
            scores.add(itemId);
            if (failSecondScore && scores.size() == 2) {
                throw new HttpProtectedContentSnapshotTransport.Refusal(
                        HttpProtectedContentSnapshotTransport.Kind.TRANSIENT,
                        message(HttpProtectedContentSnapshotTransport.Kind.TRANSIENT));
            }
            if (scoreKind != null) {
                throw new HttpProtectedContentSnapshotTransport.Refusal(scoreKind, message(scoreKind));
            }
            String outcome = forcedOutcome;
            if (outcome == null) {
                if (itemId == 9L) outcome = "beta".equals(selected) ? "FULL" : "ZERO";
                else outcome = "ZERO";
            }
            String digest = itemId == 9L ? digest9 : itemId == 2L ? digest2 : "";
            return new B10AssessmentJdbcController.OwnerDecision(itemId, snapshotId, digest, outcome);
        }

        private List<B10AssessmentJdbcController.OwnerItem> items() {
            return List.of(item(9L, 1, "Stem nine", digest9, "alpha", "Alpha", "beta", "Beta"),
                    item(2L, 2, "Stem two", digest2, "aye", "Aye", "bee", "Bee"));
        }

        private static B10AssessmentJdbcController.OwnerItem item(long id, int order, String stem, String digest,
                String... pairs) {
            List<B10AssessmentJdbcController.OwnerOption> options = new ArrayList<>();
            for (int i = 0; i < pairs.length; i += 2) {
                options.add(new B10AssessmentJdbcController.OwnerOption(pairs[i], pairs[i + 1]));
            }
            return new B10AssessmentJdbcController.OwnerItem(id, order, stem, options, digest);
        }

        private static String message(HttpProtectedContentSnapshotTransport.Kind kind) {
            return switch (kind) {
                case DENIED -> "protected content snapshot was denied";
                case UNAVAILABLE -> "protected content snapshot is unavailable";
                case NOT_FOUND -> "protected content snapshot was not found";
                case CONFLICT -> "protected content pin does not match";
                case TRANSIENT -> "protected content snapshot transport failed";
                case INVALID -> "protected content snapshot request is invalid";
            };
        }
    }

    private static final class ReadingJdbc extends JdbcTemplate {
        final Map<String, Map<String, Object>> sessions = new LinkedHashMap<>();
        final Map<String, Map<String, Object>> attempts = new LinkedHashMap<>();
        final Map<String, Map<String, Object>> claims = new LinkedHashMap<>();
        final List<Map<String, Object>> events = new ArrayList<>();
        final List<Map<String, Object>> localRules = new ArrayList<>();
        final List<String> ruleQueries = new ArrayList<>();
        final List<String> trace;
        String reportPinJson;
        private State snap;

        ReadingJdbc(List<String> trace) {
            this.trace = trace;
        }

        void begin() {
            snap = capture();
        }

        void commit() {
            snap = null;
        }

        void rollback() {
            if (snap == null) return;
            restore(snap);
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT IGNORE INTO assessment_idempotency")) {
                String key = args[2] + "|" + args[3];
                if (claims.containsKey(key)) return 0;
                Map<String, Object> claim = new LinkedHashMap<>();
                claim.put("request_digest", args[4]);
                claim.put("response_json", args[5]);
                claims.put(key, claim);
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency") && sql.contains("request_digest")) {
                Map<String, Object> claim = claims.get(args[4] + "|" + args[5]);
                if (claim == null) return 0;
                claim.put("request_digest", args[0]);
                claim.put("response_json", args[1]);
                trace.add("receipt");
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency")) {
                Map<String, Object> claim = claims.get(args[3] + "|" + args[4]);
                if (claim == null) return 0;
                claim.put("response_json", args[0]);
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_attempt")) {
                trace.add("attempt");
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("attempt_id", args[0]);
                row.put("session_id", args[1]);
                row.put("principal_id", args[2]);
                row.put("tenant_id", args[3]);
                row.put("attempt_version", args[4]);
                row.put("submission_id", args[5]);
                row.put("status", "ASSESSED");
                row.put("item_count", args[6]);
                row.put("submission_digest", args[7]);
                row.put("score_bucket", args[8]);
                row.put("mistake_codes_json", args[9]);
                row.put("report_id", args[10]);
                row.put("created_at", Timestamp.from(Instant.parse(STARTED)));
                attempts.put(String.valueOf(args[0]), row);
                return 1;
            }
            if (sql.contains("INSERT INTO assessment_outbox_event")) {
                Map<String, Object> event = new LinkedHashMap<>();
                event.put("event_name", args[2]);
                event.put("payload_json", args[5]);
                events.add(event);
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_report")) {
                reportPinJson = String.valueOf(args[8]);
                return 1;
            }
            if (sql.contains("INSERT INTO assessment_mistake")) return 1;
            if (sql.contains("UPDATE b10_assessment_session")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[4]));
                if (row == null) return 0;
                if (sql.contains("state_version = ?") || sql.contains("AND state_version")) {
                    trace.add("conditional-update");
                    long expected = longOf(args[7]);
                    long current = longOf(row.get("state_version"));
                    if (expected != current) return 0;
                    applySession(row, args);
                    return 1;
                }
                trace.add("legacy-update");
                applySession(row, args);
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_session")) {
                trace.add("session-insert");
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("session_id", args[0]);
                row.put("principal_id", args[1]);
                row.put("tenant_id", args[2]);
                row.put("mode", args[3]);
                row.put("status", "IN_PROGRESS");
                row.put("content_code", args[4]);
                row.put("content_version_id", args[5]);
                row.put("alternative_content_version_id", args[6]);
                row.put("alternative_content_code", args[7]);
                row.put("alternative_reason_code", args[8]);
                row.put("content_epoch", args[9]);
                row.put("snapshot_id", args[10]);
                row.put("snapshot_hash", args[11]);
                row.put("items_json", args[12]);
                row.put("answers_json", "{}");
                row.put("state_version", 1L);
                row.put("attempt_count", 0L);
                row.put("idempotency_key", args[13]);
                row.put("owner_snapshot_ref", args[14]);
                row.put("started_at", Timestamp.from(Instant.parse(STARTED)));
                sessions.put(String.valueOf(args[0]), row);
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b25_assessment_item_rule")) {
                ruleQueries.add(String.valueOf(args[0]) + ":" + args[1]);
                List<Map<String, Object>> matched = new ArrayList<>();
                for (Map<String, Object> rule : localRules) {
                    boolean code = String.valueOf(args[0]).equals(String.valueOf(rule.get("content_code")));
                    boolean version = longOf(args[1]) == longOf(rule.get("content_version_id"));
                    if (code && version) matched.add(new LinkedHashMap<>(rule));
                }
                return matched;
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("status = 'IN_PROGRESS'")) {
                List<Map<String, Object>> open = new ArrayList<>();
                for (Map<String, Object> row : sessions.values()) {
                    if ("IN_PROGRESS".equals(row.get("status"))
                            && String.valueOf(args[2]).equals(String.valueOf(row.get("content_code")))
                            && longOf(args[3]) == longOf(row.get("content_version_id"))
                            && String.valueOf(args[4]).equals(String.valueOf(row.get("mode")))
                            && SUBJECT.equals(String.valueOf(row.get("principal_id")))) {
                        open.add(new LinkedHashMap<>(row));
                    }
                }
                return open;
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("idempotency_key")) {
                String key = String.valueOf(args[2]);
                for (Map<String, Object> row : sessions.values()) {
                    if (key.equals(String.valueOf(row.get("idempotency_key")))
                            && SUBJECT.equals(String.valueOf(row.get("principal_id")))) {
                        return List.of(new LinkedHashMap<>(row));
                    }
                }
                return List.of();
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("FOR UPDATE")) {
                trace.add("lock");
                Map<String, Object> row = sessions.get(String.valueOf(args[0]));
                if (row == null || args.length > 1 && !String.valueOf(args[1]).equals(String.valueOf(row.get("principal_id")))) {
                    return List.of();
                }
                return List.of(new LinkedHashMap<>(row));
            }
            if (sql.contains("FROM b10_assessment_session")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[0]));
                if (row == null || args.length > 1 && !String.valueOf(args[1]).equals(String.valueOf(row.get("principal_id")))) {
                    return List.of();
                }
                return List.of(new LinkedHashMap<>(row));
            }
            if (sql.contains("FROM b10_assessment_attempt") && sql.contains("submission_id")) {
                for (Map<String, Object> row : attempts.values()) {
                    if (String.valueOf(args[0]).equals(String.valueOf(row.get("session_id")))
                            && String.valueOf(args[1]).equals(String.valueOf(row.get("submission_id")))
                            && String.valueOf(args[2]).equals(String.valueOf(row.get("principal_id")))) {
                        return List.of(new LinkedHashMap<>(row));
                    }
                }
                return List.of();
            }
            if (sql.contains("FROM b10_assessment_attempt") && sql.contains("ORDER BY attempt_version")) {
                Map<String, Object> latest = null;
                for (Map<String, Object> row : attempts.values()) {
                    if (!String.valueOf(args[0]).equals(String.valueOf(row.get("session_id")))) continue;
                    if (latest == null || intOf(row.get("attempt_version")) > intOf(latest.get("attempt_version"))) {
                        latest = row;
                    }
                }
                if (latest == null) return List.of();
                Map<String, Object> view = new LinkedHashMap<>();
                view.put("mistake_codes_json", latest.get("mistake_codes_json"));
                return List.of(view);
            }
            if (sql.contains("MAX(attempt_version)")) {
                int max = 0;
                for (Map<String, Object> row : attempts.values()) {
                    if (String.valueOf(args[0]).equals(String.valueOf(row.get("session_id")))) {
                        max = Math.max(max, intOf(row.get("attempt_version")));
                    }
                }
                return List.of(Map.of("attempt_version", max + 1));
            }
            if (sql.contains("FROM b10_assessment_attempt")) {
                Map<String, Object> row = attempts.get(String.valueOf(args[0]));
                if (row == null || args.length > 1 && !String.valueOf(args[1]).equals(String.valueOf(row.get("principal_id")))) {
                    return List.of();
                }
                return List.of(new LinkedHashMap<>(row));
            }
            if (sql.contains("FROM assessment_idempotency")) {
                Map<String, Object> claim = claims.get(args[2] + "|" + args[3]);
                return claim == null ? List.of() : List.of(new LinkedHashMap<>(claim));
            }
            if (sql.contains("MAX(mistake_id)")) return List.of(Map.of("mistake_id", 1L));
            if (sql.contains("FROM assessment_mistake")) return List.of();
            throw new AssertionError("unexpected query: " + sql);
        }

        private static void applySession(Map<String, Object> row, Object[] args) {
            row.put("answers_json", args[0]);
            row.put("state_version", longOf(row.get("state_version")) + 1);
            row.put("attempt_count", longOf(row.get("attempt_count")) + 1);
            row.put("last_attempt_id", args[1]);
            row.put("last_report_id", args[2]);
            row.put("status", args[3]);
        }

        private State capture() {
            return new State(copyRows(sessions), copyRows(attempts), copyRows(claims), copyEvents(), reportPinJson);
        }

        private void restore(State state) {
            sessions.clear();
            sessions.putAll(copyRows(state.sessions));
            attempts.clear();
            attempts.putAll(copyRows(state.attempts));
            claims.clear();
            claims.putAll(copyRows(state.claims));
            events.clear();
            events.addAll(copyEvents(state.events));
            reportPinJson = state.reportPinJson;
        }

        private static Map<String, Map<String, Object>> copyRows(Map<String, Map<String, Object>> source) {
            Map<String, Map<String, Object>> copy = new LinkedHashMap<>();
            source.forEach((id, row) -> copy.put(id, new LinkedHashMap<>(row)));
            return copy;
        }

        private List<Map<String, Object>> copyEvents() {
            return copyEvents(events);
        }

        private static List<Map<String, Object>> copyEvents(List<Map<String, Object>> source) {
            List<Map<String, Object>> copy = new ArrayList<>();
            for (Map<String, Object> event : source) copy.add(new LinkedHashMap<>(event));
            return copy;
        }
    }

    private record State(Map<String, Map<String, Object>> sessions, Map<String, Map<String, Object>> attempts,
            Map<String, Map<String, Object>> claims, List<Map<String, Object>> events, String reportPinJson) {
    }
}
