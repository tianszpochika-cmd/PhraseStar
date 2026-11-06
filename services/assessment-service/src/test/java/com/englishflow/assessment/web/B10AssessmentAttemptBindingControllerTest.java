package com.englishflow.assessment.web;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.AbstractHttpMessageConverter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Owner match is a read of assessment rows only. These tests stub JDBC and do not open a database.
 */
class B10AssessmentAttemptBindingControllerTest {

    private static final String LEARNER = "prn_learner0000000001";
    private static final String OTHER = "prn_otherlearner00001";
    private static final String ATTEMPT = "aatm_owner_attempt_01";
    private static final String MISSING_ATTEMPT = "aatm_missing_attempt_1";
    private static final String SESSION = "asess_owner_session_1";
    private static final String ITEM = "aitm_item_assess_01";
    private static final String LOGICAL = "li_logical_item_01";
    private static final String EVENT = "11111111-1111-4111-8111-111111111111";
    private static final String SNAPSHOT = "snap_owner.ref-0001";
    private static final String HASH = "ab".repeat(32);
    private static final long VERSION = 25001L;
    private static final long EPOCH = 1L;
    private static final String PINNED_AT = "2026-09-23T00:00:00Z";
    private static final String REQUEST_ID = "req-binding-0001";
    private static final String TRACE_ID = "0123456789abcdef0123456789abcdef";
    private static final String SECRET_OUTCOME = "FULL_SECRET_OUTCOME";
    private static final String SECRET_QUALITY = "raw-quality-secret";
    private static final String SECRET_RESPONSE = "selected-option-secret";
    private static final String SECRET_CODE = "course-secret-code";
    private static final String RECEIPT_SNAPSHOT = "424242";
    private static final List<String> DATA_FIELDS = List.of(
            "attemptId", "itemAssessmentId", "logicalItemId", "learnerPrincipalId", "tenantId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash", "pinnedAt",
            "pinSource", "reporting", "owner");

    @Test
    void canonicalMatchUsesPersistedPinWithoutPublishedStatus() throws Exception {
        Harness harness = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        int connections = harness.connections.get();
        Map<String, Object> response = harness.controller.matchB10AssessmentAttemptBinding(
                workload(), ATTEMPT, body(harness.mapper, Map.of()));

        assertEquals(List.of("data"), List.copyOf(response.keySet()));
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        assertEquals(DATA_FIELDS, List.copyOf(data.keySet()));
        assertEquals(ATTEMPT, data.get("attemptId"));
        assertEquals(ITEM, data.get("itemAssessmentId"));
        assertEquals(LOGICAL, data.get("logicalItemId"));
        assertEquals(LEARNER, data.get("learnerPrincipalId"));
        assertEquals("platform", data.get("tenantId"));
        assertEquals(VERSION, ((Number) data.get("contentVersionId")).longValue());
        assertEquals(EPOCH, ((Number) data.get("contentEpoch")).longValue());
        assertEquals(SNAPSHOT, data.get("snapshotId"));
        assertEquals(HASH, data.get("snapshotHash"));
        assertEquals(PINNED_AT, data.get("pinnedAt"));
        assertEquals("b10_assessment_session.started_at", data.get("pinSource"));
        assertEquals("CURRENT", data.get("reporting"));
        assertEquals("assessment-service", data.get("owner"));
        assertNoStoredSecrets(harness.mapper.writeValueAsString(response));
        assertFalse(harness.mapper.writeValueAsString(response).contains(RECEIPT_SNAPSHOT));
        assertEquals(connections + 1, harness.connections.get());
        assertEquals(1, harness.commits.get());
        assertEquals(0, harness.rollbacks.get());
        assertTrue(harness.readOnly.contains(Boolean.TRUE));
        assertEquals(3, harness.jdbc.sql.size());
        assertTrue(harness.jdbc.sql.get(0).contains("b10_assessment_attempt"));
        assertTrue(harness.jdbc.sql.get(0).contains("b10_assessment_session"));
        assertTrue(harness.jdbc.sql.get(1).contains("assessment_outbox_event"));
        assertTrue(harness.jdbc.sql.get(2).contains("b10_assessment_report"));
        assertFalse(String.join("\n", harness.jdbc.sql).contains("status"));
        assertFalse(String.join("\n", harness.jdbc.sql).contains("PUBLISHED"));
        assertOwnerRead(harness.jdbc.sql.get(0));

        ConditionalOnProperty persistence = B10AssessmentAttemptBindingController.class
                .getAnnotation(ConditionalOnProperty.class);
        assertEquals("assessment.persistence", persistence.prefix());
        assertEquals("enabled", persistence.name()[0]);
        assertEquals("true", persistence.havingValue());
        PostMapping mapping = B10AssessmentAttemptBindingController.class
                .getMethod("matchB10AssessmentAttemptBinding", Authentication.class, String.class, JsonNode.class)
                .getAnnotation(PostMapping.class);
        assertEquals("/internal/v1/assessment/attempts/{attemptId}/binding", mapping.value()[0]);
    }

    @Test
    void historicalReceiptIsClassifiedWithoutRewrite() throws Exception {
        Harness harness = canonicalHarness(LocalDateTime.of(2026, 9, 23, 0, 0));
        String receipt = """
                {"contentVersionId":25001,"contentEpoch":1,"snapshotHash":"%s","pinnedAt":"2020-01-01T00:00:00Z","snapshotId":%s,"contentCode":"%s","scoreBucket":"FULL"}
                """.formatted(HASH, RECEIPT_SNAPSHOT, SECRET_CODE).trim();
        harness.jdbc.reports.getFirst().put("pin_json", receipt);

        Map<String, Object> response = harness.controller.matchB10AssessmentAttemptBinding(
                workload(), ATTEMPT, body(harness.mapper, Map.of()));
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");

        assertEquals("HISTORICAL", data.get("reporting"));
        assertEquals(PINNED_AT, data.get("pinnedAt"));
        assertEquals(SNAPSHOT, data.get("snapshotId"));
        assertEquals(receipt, harness.jdbc.reports.getFirst().get("pin_json"));
        assertEquals(0, harness.jdbc.writes);
        assertNoStoredSecrets(harness.mapper.writeValueAsString(response));
        assertFalse(harness.mapper.writeValueAsString(response).contains("2020-01-01"));
    }

    @Test
    void unknownAttemptAndWrongSubjectShareTheSame404() {
        Harness missing = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        ResponseStatusException unknown = assertThrows(ResponseStatusException.class,
                () -> missing.controller.matchB10AssessmentAttemptBinding(
                        workload(), MISSING_ATTEMPT, body(missing.mapper, Map.of())));
        Harness other = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        ResponseStatusException wrongSubject = assertThrows(ResponseStatusException.class,
                () -> other.controller.matchB10AssessmentAttemptBinding(
                        workload(), ATTEMPT, body(other.mapper, Map.of("learnerPrincipalId", OTHER))));

        assertEquals(HttpStatus.NOT_FOUND, unknown.getStatusCode());
        assertEquals(unknown.getStatusCode(), wrongSubject.getStatusCode());
        assertEquals("ATTEMPT_NOT_OWNED", unknown.getReason());
        assertEquals(unknown.getReason(), wrongSubject.getReason());
        assertEquals(unknown.getMessage(), wrongSubject.getMessage());
        assertEquals(1, missing.jdbc.sql.size());
        assertEquals(1, other.jdbc.sql.size());
        assertOwnerRead(missing.jdbc.sql.getFirst());
        assertOwnerRead(other.jdbc.sql.getFirst());
        assertEquals(OTHER, other.jdbc.args.getFirst()[1]);
        assertNoStoredSecrets(unknown.getReason());
        assertNoStoredSecrets(wrongSubject.getReason());
        assertFalse(wrongSubject.getReason().contains(LEARNER));
        assertFalse(unknown.getReason().contains(SNAPSHOT));
    }

    @Test
    void malformedMissingAndReusedEventsFailClosed() throws Exception {
        Harness closed = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        JsonNode extra = closed.mapper.readTree("""
                {"eventId":"%s","learnerPrincipalId":"%s","itemAssessmentId":"%s","logicalItemId":"%s","contentVersionId":25001,"contentEpoch":1,"snapshotId":"%s","snapshotHash":"%s","outcome":"%s","contentCode":"%s","tenantId":"caller-tenant"}
                """.formatted(EVENT, LEARNER, ITEM, LOGICAL, SNAPSHOT, HASH, SECRET_OUTCOME, SECRET_CODE));
        ResponseStatusException badBody = assertThrows(ResponseStatusException.class,
                () -> closed.controller.matchB10AssessmentAttemptBinding(null, ATTEMPT, extra));
        assertEquals(HttpStatus.BAD_REQUEST, badBody.getStatusCode());
        assertEquals("closed request is invalid", badBody.getReason());
        assertNoStoredSecrets(badBody.getReason());
        assertEquals(0, closed.jdbc.sql.size());
        assertEquals(0, closed.connections.get());

        Harness missing = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        missing.jdbc.events.clear();
        assertConflict(missing, "ITEM_IDENTITY_ABSENT", body(missing.mapper, Map.of()));

        Harness legacy = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        legacy.jdbc.events.getFirst().put("payload_json", envelope(legacy.mapper, true, false));
        assertConflict(legacy, "ITEM_IDENTITY_ABSENT", body(legacy.mapper, Map.of()));

        Harness incomplete = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        incomplete.jdbc.events.getFirst().put("payload_json", envelope(incomplete.mapper, false, true));
        assertConflict(incomplete, "ITEM_IDENTITY_ABSENT", body(incomplete.mapper, Map.of()));

        Harness reused = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        reused.jdbc.events.getFirst().put("dedupe_key", "aatm_reused_attempt_9:aitm_reused_item_01");
        reused.jdbc.events.getFirst().put("aggregate_id", "aitm_reused_item_01");
        ResponseStatusException reusedFailure = assertConflict(
                reused, "EVIDENCE_REUSED", body(reused.mapper, Map.of()));
        assertFalse(reusedFailure.getReason().contains("aatm_reused_attempt_9"));
        assertFalse(reusedFailure.getReason().contains("aitm_reused_item_01"));
        assertEquals(0, reused.jdbc.writes);
    }

    @Test
    void conflictsAndUnreadableOwnerExposeNoStoredFacts() throws Exception {
        Harness mismatch = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        ResponseStatusException mismatched = assertConflict(mismatch, "PIN_MISMATCH",
                body(mismatch.mapper, Map.of("snapshotHash", HASH.toUpperCase(Locale.ROOT))));
        assertFalse(mismatched.getReason().contains(HASH));
        assertFalse(mismatched.getReason().toLowerCase(Locale.ROOT).contains(HASH));

        Harness blank = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        blank.jdbc.ownerRef = "  ";
        assertConflict(blank, "FALLBACK_PIN", body(blank.mapper, Map.of()));

        Harness synthesized = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        synthesized.jdbc.ownerRef = "snap_assessment_25001";
        ResponseStatusException fallback = assertConflict(
                synthesized, "FALLBACK_PIN", body(synthesized.mapper, Map.of()));
        assertFalse(fallback.getReason().contains("snap_assessment_25001"));

        Harness substituted = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        substituted.jdbc.alternative = 26001L;
        ResponseStatusException substitute = assertConflict(
                substituted, "PIN_SUBSTITUTED", body(substituted.mapper, Map.of()));
        assertFalse(substitute.getReason().contains("26001"));

        Harness noReport = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        noReport.jdbc.reports.clear();
        assertConflict(noReport, "REPORT_PIN_ABSENT", body(noReport.mapper, Map.of()));

        Harness badReceipt = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        badReceipt.jdbc.reports.getFirst().put("pin_json", "{\"contentVersionId\":\"25001\"}");
        assertConflict(badReceipt, "REPORT_PIN_ABSENT", body(badReceipt.mapper, Map.of()));

        Harness badTime = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        badTime.jdbc.startedAt = "not-a-time";
        ResponseStatusException unreadableTime = assertThrows(ResponseStatusException.class,
                () -> badTime.controller.matchB10AssessmentAttemptBinding(
                        workload(), ATTEMPT, body(badTime.mapper, Map.of())));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, unreadableTime.getStatusCode());
        assertEquals("assessment owner binding is unavailable", unreadableTime.getReason());
        assertFalse(unreadableTime.getReason().contains("not-a-time"));
        assertNoStoredSecrets(unreadableTime.getReason());
        assertEquals(null, unreadableTime.getCause());

        Harness down = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        down.jdbc.failure = new DataRetrievalFailureException(
                "SELECT secret_score_bucket, " + SECRET_QUALITY + " FROM b25_assessment_item_rule");
        int rollbacks = down.rollbacks.get();
        ResponseStatusException unavailable = assertThrows(ResponseStatusException.class,
                () -> down.controller.matchB10AssessmentAttemptBinding(
                        workload(), ATTEMPT, body(down.mapper, Map.of())));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, unavailable.getStatusCode());
        assertEquals("assessment owner binding is unavailable", unavailable.getReason());
        assertFalse(unavailable.getReason().contains("secret_score_bucket"));
        assertFalse(unavailable.getReason().contains(SECRET_QUALITY));
        assertFalse(unavailable.getReason().contains("b25_"));
        assertEquals(null, unavailable.getCause());
        assertEquals(rollbacks + 1, down.rollbacks.get());

        Harness unauthenticated = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        ResponseStatusException missingToken = assertThrows(ResponseStatusException.class,
                () -> unauthenticated.controller.matchB10AssessmentAttemptBinding(
                        null, ATTEMPT, body(unauthenticated.mapper, Map.of())));
        assertEquals(HttpStatus.UNAUTHORIZED, missingToken.getStatusCode());
        assertEquals("authentication required", missingToken.getReason());
        assertEquals(0, unauthenticated.jdbc.sql.size());

        ResponseStatusException accessToken = assertThrows(ResponseStatusException.class,
                () -> unauthenticated.controller.matchB10AssessmentAttemptBinding(
                        accessToken(), ATTEMPT, body(unauthenticated.mapper, Map.of())));
        assertEquals(HttpStatus.FORBIDDEN, accessToken.getStatusCode());
        assertEquals("access denied", accessToken.getReason());
        assertFalse(accessToken.getReason().contains(LEARNER));
        assertEquals(0, unauthenticated.jdbc.sql.size());
    }

    @Test
    void httpSerializationWritesClosed404AndOne409() throws Exception {
        Harness unknown = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        MvcResult missing = postBinding(unknown, MISSING_ATTEMPT, requestJson(unknown, Map.of()), workload());
        assertClosedWire(missing, 404, "ATTEMPT_NOT_OWNED", "attempt is not available");
        assertEquals(1, unknown.jdbc.sql.size());
        assertOwnerRead(unknown.jdbc.sql.getFirst());
        assertEquals(MISSING_ATTEMPT, unknown.jdbc.args.getFirst()[0]);
        assertEquals(LEARNER, unknown.jdbc.args.getFirst()[1]);
        assertTrue(unknown.readOnly.contains(Boolean.TRUE));
        assertEquals(1, unknown.commits.get());
        assertEquals(0, unknown.rollbacks.get());
        assertEquals(0, unknown.jdbc.writes);
        assertFalse(missing.getResponse().getContentAsString().contains(MISSING_ATTEMPT));
        assertFalse(missing.getResponse().getContentAsString().contains(LEARNER));

        Harness other = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        MvcResult wrongSubject = postBinding(other, ATTEMPT, requestJson(other, Map.of("learnerPrincipalId", OTHER)), workload());
        assertClosedWire(wrongSubject, 404, "ATTEMPT_NOT_OWNED", "attempt is not available");
        assertEquals(missing.getResponse().getContentAsString(), wrongSubject.getResponse().getContentAsString());
        assertEquals(1, other.jdbc.sql.size());
        assertOwnerRead(other.jdbc.sql.getFirst());
        assertEquals(OTHER, other.jdbc.args.getFirst()[1]);
        assertFalse(wrongSubject.getResponse().getContentAsString().contains(OTHER));
        assertFalse(wrongSubject.getResponse().getContentAsString().contains(LEARNER));
        assertEquals(0, other.jdbc.writes);

        Harness substituted = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        substituted.jdbc.alternative = 26001L;
        MvcResult conflict = postBinding(substituted, ATTEMPT, requestJson(substituted, Map.of()), workload());
        assertClosedWire(conflict, 409, "PIN_SUBSTITUTED", "owner match was rejected");
        assertFalse(conflict.getResponse().getContentAsString().equals(missing.getResponse().getContentAsString()));
        assertFalse(conflict.getResponse().getContentAsString().contains("26001"));
        assertFalse(conflict.getResponse().getContentAsString().contains(ATTEMPT));
        assertEquals(1, substituted.jdbc.sql.size());
        assertOwnerRead(substituted.jdbc.sql.getFirst());
        assertTrue(substituted.readOnly.contains(Boolean.TRUE));
        assertEquals(1, substituted.commits.get());
        assertEquals(0, substituted.rollbacks.get());
        assertEquals(0, substituted.jdbc.writes);

        Harness closed = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        String extra = """
                {"eventId":"%s","learnerPrincipalId":"%s","itemAssessmentId":"%s","logicalItemId":"%s","contentVersionId":25001,"contentEpoch":1,"snapshotId":"%s","snapshotHash":"%s","outcome":"%s"}
                """.formatted(EVENT, LEARNER, ITEM, LOGICAL, SNAPSHOT, HASH, SECRET_OUTCOME).trim();
        MvcResult badBody = postBinding(closed, ATTEMPT, extra, null);
        assertEquals(400, badBody.getResponse().getStatus());
        assertEquals("closed request is invalid", badBody.getResponse().getErrorMessage());
        assertEquals("", badBody.getResponse().getContentAsString());
        assertEquals(0, closed.jdbc.sql.size());
        assertEquals(0, closed.connections.get());

        Harness unauthenticated = canonicalHarness(Timestamp.from(Instant.parse(PINNED_AT)));
        MvcResult missingToken = postBinding(unauthenticated, ATTEMPT, requestJson(unauthenticated, Map.of()), null);
        assertEquals(401, missingToken.getResponse().getStatus());
        assertEquals("authentication required", missingToken.getResponse().getErrorMessage());
        assertEquals("", missingToken.getResponse().getContentAsString());
        assertEquals(0, unauthenticated.jdbc.sql.size());
        assertEquals(0, unauthenticated.connections.get());

        MvcResult access = postBinding(unauthenticated, ATTEMPT, requestJson(unauthenticated, Map.of()), accessToken());
        assertEquals(403, access.getResponse().getStatus());
        assertEquals("access denied", access.getResponse().getErrorMessage());
        assertEquals("", access.getResponse().getContentAsString());
        assertFalse(access.getResponse().getErrorMessage().contains(LEARNER));
        assertEquals(0, unauthenticated.jdbc.sql.size());
    }

    private static String requestJson(Harness harness, Map<String, Object> overrides) throws Exception {
        return harness.mapper.writeValueAsString(body(harness.mapper, overrides));
    }

    private static MvcResult postBinding(Harness harness, String attemptId, String json, Authentication authentication)
            throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(harness.controller)
                .setMessageConverters(new JsonNodeBodyConverter(harness.mapper))
                .build();
        MockHttpServletRequestBuilder request = post("/internal/v1/assessment/attempts/" + attemptId + "/binding")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content(json);
        if (authentication != null) {
            request.principal(authentication);
        }
        return mvc.perform(request).andReturn();
    }

    private static void assertClosedWire(MvcResult result, int status, String code, String message) throws Exception {
        assertEquals(status, result.getResponse().getStatus());
        assertEquals(null, result.getResponse().getErrorMessage());
        String contentType = result.getResponse().getContentType();
        assertTrue(contentType != null && contentType.startsWith(MediaType.APPLICATION_JSON_VALUE));
        String raw = result.getResponse().getContentAsString();
        assertEquals("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}", raw);
        JsonNode parsed = new ObjectMapper().readTree(raw);
        assertEquals(List.of("code", "message"), List.copyOf(fieldNames(parsed)));
        assertEquals(code, parsed.get("code").asText());
        assertEquals(message, parsed.get("message").asText());
        assertNoStoredSecrets(raw);
        for (String leaked : List.of("SELECT", "INSERT", "b10_", "principal", "credential", "password",
                "cause", "detail", "path", "exception", "stack", LEARNER, OTHER, SNAPSHOT, HASH)) {
            assertFalse(raw.contains(leaked), leaked);
        }
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            names.add(entry.getKey());
        }
        return names;
    }

    private static ResponseStatusException assertConflict(Harness harness, String code, JsonNode body) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> harness.controller.matchB10AssessmentAttemptBinding(workload(), ATTEMPT, body));
        assertEquals(HttpStatus.CONFLICT, failure.getStatusCode());
        assertEquals(code, failure.getReason());
        assertNoStoredSecrets(failure.getReason());
        assertEquals(0, harness.jdbc.writes);
        return failure;
    }

    private static void assertOwnerRead(String sql) {
        assertTrue(sql.contains("attempt_id = BINARY"));
        assertTrue(sql.contains("tenant_id = BINARY 'platform'"));
        assertTrue(sql.contains("principal_id = BINARY"));
        assertTrue(sql.contains("b10_assessment_session"));
        assertFalse(sql.contains("content_code"));
        assertFalse(sql.contains("answers_json"));
        assertFalse(sql.contains("score_bucket"));
    }

    private static void assertNoStoredSecrets(String raw) {
        for (String secret : List.of(SECRET_OUTCOME, SECRET_QUALITY, SECRET_RESPONSE, SECRET_CODE,
                "scoreBucket", "objectiveOutcome", "contentCode", "rawResponse", "mastery", "mistake", "answer")) {
            assertFalse(raw.contains(secret), secret);
        }
    }

    private static Harness canonicalHarness(Object startedAt) {
        Harness harness = new Harness();
        harness.jdbc.startedAt = startedAt;
        harness.jdbc.events.add(eventRow(harness.mapper));
        harness.jdbc.reports.add(new LinkedHashMap<>(Map.of("pin_json", currentReceipt())));
        return harness;
    }

    private static Map<String, Object> eventRow(ObjectMapper mapper) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("event_id", EVENT);
        row.put("aggregate_id", ITEM);
        row.put("event_name", "assessment.item.assessed.v2");
        row.put("schema_version", "assessment.event.v2");
        row.put("dedupe_key", ATTEMPT + ":" + ITEM);
        row.put("payload_json", envelope(mapper, false, false));
        row.put("request_id", REQUEST_ID);
        row.put("trace_id", TRACE_ID);
        row.put("status", "PENDING");
        return row;
    }

    private static String currentReceipt() {
        return """
                {"contentCode":"%s","contentVersionId":25001,"contentEpoch":1,"snapshotId":%s,"snapshotHash":"%s","pinnedAt":"2026-09-23T00:00:00.000Z","scoreBucket":"FULL","pinStatus":"PINNED"}
                """.formatted(SECRET_CODE, RECEIPT_SNAPSHOT, HASH).trim();
    }

    private static String envelope(ObjectMapper mapper, boolean legacyVersion, boolean dropContentPin) {
        Map<String, Object> contentPin = new LinkedHashMap<>();
        contentPin.put("contentVersionId", VERSION);
        contentPin.put("contentEpoch", EPOCH);
        contentPin.put("snapshotId", SNAPSHOT);
        contentPin.put("snapshotHash", HASH);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", "platform");
        payload.put("principalId", LEARNER);
        payload.put("itemAssessmentId", ITEM);
        payload.put("attemptId", ATTEMPT);
        payload.put("sessionId", SESSION);
        payload.put("logicalItemId", LOGICAL);
        if (!dropContentPin) {
            payload.put("contentPin", contentPin);
        }
        payload.put("objectiveOutcome", SECRET_OUTCOME);
        payload.put("quality", SECRET_QUALITY);
        payload.put("scoreBucket", "FULL");
        payload.put("rawResponse", SECRET_RESPONSE);
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", EVENT);
        envelope.put("eventName", "assessment.item.assessed.v2");
        envelope.put("schema", "assessment.event.v2");
        envelope.put("version", legacyVersion ? 1 : 2);
        envelope.put("occurredAt", "2026-09-23T00:00:01Z");
        envelope.put("aggregateType", "assessment_item");
        envelope.put("aggregateId", ITEM);
        envelope.put("actorId", LEARNER);
        envelope.put("tenantId", "platform");
        envelope.put("traceId", TRACE_ID);
        envelope.put("requestId", REQUEST_ID);
        envelope.put("schemaVersion", "assessment.event.v2");
        envelope.put("dedupeKey", ATTEMPT + ":" + ITEM);
        envelope.put("payload", payload);
        try {
            return mapper.writeValueAsString(envelope);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static JsonNode body(ObjectMapper mapper, Map<String, Object> overrides) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", EVENT);
        body.put("learnerPrincipalId", LEARNER);
        body.put("itemAssessmentId", ITEM);
        body.put("logicalItemId", LOGICAL);
        body.put("contentVersionId", VERSION);
        body.put("contentEpoch", EPOCH);
        body.put("snapshotId", SNAPSHOT);
        body.put("snapshotHash", HASH);
        body.putAll(overrides);
        return mapper.valueToTree(body);
    }

    private static Authentication workload() {
        return token("learning-service", "service", "platform", List.of(),
                List.of(B10AssessmentAttemptBindingController.PERMISSION),
                B10AssessmentAttemptBindingController.PERMISSION);
    }

    private static Authentication accessToken() {
        return token(LEARNER, "access", "platform", List.of("learner"),
                List.of("assessment.session.read", B10AssessmentAttemptBindingController.PERMISSION),
                "assessment.session.read " + B10AssessmentAttemptBindingController.PERMISSION);
    }

    private static Authentication token(String subject, String tokenType, String tenant, List<String> roles,
                                        List<String> permissions, String scope) {
        Jwt jwt = Jwt.withTokenValue("workload-token")
                .header("alg", "RS256")
                .header("typ", "JWT")
                .subject(subject)
                .issuer("http://127.0.0.1:18087")
                .audience(List.of("yuxuexing-api"))
                .issuedAt(Instant.parse(PINNED_AT))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("service_id", "learning-service")
                .claim("client_id", "learning-service")
                .claim("token_type", tokenType)
                .claim("tenant_id", tenant)
                .claim("roles", roles)
                .claim("permissions", permissions)
                .claim("scope", scope)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("SCOPE_" + scope)), subject);
    }

    private static final class Harness {
        final ObjectMapper mapper = new ObjectMapper();
        final AtomicInteger connections = new AtomicInteger();
        final AtomicInteger commits = new AtomicInteger();
        final AtomicInteger rollbacks = new AtomicInteger();
        final List<Boolean> readOnly = new ArrayList<>();
        final BindingJdbc jdbc;
        final B10AssessmentAttemptBindingController controller;

        Harness() {
            DataSource dataSource = dataSource();
            this.jdbc = new BindingJdbc(dataSource);
            this.controller = new B10AssessmentAttemptBindingController(jdbc, mapper);
        }

        private DataSource dataSource() {
            AtomicBoolean connectionReadOnly = new AtomicBoolean(false);
            Connection connection = proxy(Connection.class, (proxy, method, args) -> {
                if ("setReadOnly".equals(method.getName())) {
                    boolean readOnlyNow = (Boolean) args[0];
                    readOnly.add(readOnlyNow);
                    connectionReadOnly.set(readOnlyNow);
                    return null;
                }
                if ("commit".equals(method.getName())) {
                    commits.incrementAndGet();
                    return null;
                }
                if ("rollback".equals(method.getName())) {
                    rollbacks.incrementAndGet();
                    return null;
                }
                if ("isReadOnly".equals(method.getName())) {
                    return connectionReadOnly.get();
                }
                if ("getAutoCommit".equals(method.getName())) {
                    return true;
                }
                if ("isClosed".equals(method.getName())) {
                    return false;
                }
                if ("getMetaData".equals(method.getName())) {
                    return proxy(java.sql.DatabaseMetaData.class, (meta, metaMethod, metaArgs) ->
                            metaMethod.getName().equals("supportsTransactions") ? true : defaultValue(metaMethod.getReturnType()));
                }
                if ("createStatement".equals(method.getName()) || "prepareStatement".equals(method.getName())
                        || "prepareCall".equals(method.getName())) {
                    throw new SQLException("owner read must not prepare a statement");
                }
                return defaultValue(method.getReturnType());
            });
            return proxy(DataSource.class, (proxy, method, args) -> {
                if ("getConnection".equals(method.getName())) {
                    connections.incrementAndGet();
                    return connection;
                }
                if ("getParentLogger".equals(method.getName())) {
                    throw new SQLFeatureNotSupportedException();
                }
                return defaultValue(method.getReturnType());
            });
        }
    }

    private static final class BindingJdbc extends JdbcTemplate {
        String attemptId = ATTEMPT;
        String principal = LEARNER;
        String sessionId = SESSION;
        long version = VERSION;
        long epoch = EPOCH;
        long numericSnapshot = VERSION;
        String hash = HASH;
        Object ownerRef = SNAPSHOT;
        Object alternative = null;
        Object startedAt;
        final List<Map<String, Object>> events = new ArrayList<>();
        final List<Map<String, Object>> reports = new ArrayList<>();
        final List<String> sql = new ArrayList<>();
        final List<Object[]> args = new ArrayList<>();
        RuntimeException failure;
        int writes;

        BindingJdbc(DataSource dataSource) {
            super(dataSource);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            this.sql.add(sql);
            this.args.add(args == null ? new Object[0] : args.clone());
            String folded = sql.toLowerCase(Locale.ROOT);
            for (String banned : List.of(" for update", "insert ", "update ", "delete ", "b25_",
                    "answers_json", "score_bucket", "mistake", "items_json", "content_code",
                    "learning_", "content_service")) {
                if (folded.contains(banned)) {
                    throw new AssertionError(banned + " in " + sql);
                }
            }
            if (failure != null) {
                throw failure;
            }
            if (sql.contains("b10_assessment_attempt")) {
                if (args.length != 2 || !attemptId.equals(args[0]) || !principal.equals(args[1])) {
                    return List.of();
                }
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("attempt_id", attemptId);
                row.put("session_id", sessionId);
                row.put("principal_id", principal);
                row.put("tenant_id", "platform");
                row.put("session_session_id", sessionId);
                row.put("session_principal_id", principal);
                row.put("session_tenant_id", "platform");
                row.put("content_version_id", version);
                row.put("content_epoch", epoch);
                row.put("snapshot_id", numericSnapshot);
                row.put("snapshot_hash", hash);
                row.put("owner_snapshot_ref", ownerRef);
                row.put("alternative_content_version_id", alternative);
                row.put("started_at", startedAt);
                return List.of(row);
            }
            if (sql.contains("assessment_outbox_event")) {
                if (folded.contains("status") || folded.contains("published")) {
                    throw new AssertionError(sql);
                }
                List<Map<String, Object>> matched = new ArrayList<>();
                for (Map<String, Object> event : events) {
                    if (args.length == 2 && (java.util.Objects.equals(event.get("event_id"), args[0])
                            || java.util.Objects.equals(event.get("dedupe_key"), args[1]))) {
                        matched.add(event);
                    }
                }
                return matched;
            }
            if (sql.contains("b10_assessment_report")) {
                if (args.length != 2 || !attemptId.equals(args[0]) || !principal.equals(args[1])) {
                    return List.of();
                }
                return List.copyOf(reports);
            }
            throw new AssertionError("unexpected query " + sql);
        }

        @Override
        public int update(String sql, Object... args) {
            writes++;
            throw new AssertionError("write " + sql);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, args) -> {
            if (method.getDeclaringClass() == Object.class) {
                if ("toString".equals(method.getName())) {
                    return type.getSimpleName();
                }
                if ("hashCode".equals(method.getName())) {
                    return System.identityHashCode(proxy);
                }
                if ("equals".equals(method.getName())) {
                    return proxy == args[0];
                }
            }
            if ("isWrapperFor".equals(method.getName())) {
                return args[0] instanceof Class<?> wrapped && wrapped.isInstance(proxy);
            }
            if ("unwrap".equals(method.getName())) {
                if (args[0] instanceof Class<?> wrapped && wrapped.isInstance(proxy)) {
                    return proxy;
                }
                throw new SQLException("unwrap");
            }
            return handler.invoke(proxy, method, args);
        });
    }

    private static Object defaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == void.class || type == Void.class) {
            return null;
        }
        if (type == String.class) {
            return "";
        }
        return null;
    }

    /**
     * Reads the closed request into the handler's Jackson 3 tree. The handler writes 404/409 itself.
     */
    private static final class JsonNodeBodyConverter extends AbstractHttpMessageConverter<JsonNode> {
        private final ObjectMapper mapper;

        JsonNodeBodyConverter(ObjectMapper mapper) {
            super(MediaType.APPLICATION_JSON);
            this.mapper = mapper;
        }

        @Override
        protected boolean supports(Class<?> clazz) {
            return JsonNode.class.isAssignableFrom(clazz);
        }

        @Override
        public boolean canWrite(Class<?> clazz, MediaType mediaType) {
            return false;
        }

        @Override
        protected JsonNode readInternal(Class<? extends JsonNode> clazz, HttpInputMessage input) throws IOException {
            return mapper.readTree(input.getBody());
        }

        @Override
        protected void writeInternal(JsonNode node, HttpOutputMessage output) {
            throw new UnsupportedOperationException();
        }
    }
}
