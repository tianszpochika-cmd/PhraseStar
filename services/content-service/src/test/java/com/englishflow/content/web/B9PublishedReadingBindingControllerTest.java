package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcPublishedReadingBindings;
import com.englishflow.content.adapter.jdbc.JdbcPublishedReadingBindings.Command;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.GradableQuestions;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Owner bind of a published reading version. H2 stands in for MySQL and is not a migration. */
class B9PublishedReadingBindingControllerTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);
    private static final String HASH = "ab".repeat(32);
    /** Synthetic 256-bit seal: 64 lowercase hex characters. Not a receipt or projection field. */
    private static final String SEAL = "cd".repeat(32);
    private static final Object OMIT_SEAL = new Object();
    private static final String KEY = "binding-key-0001";
    private static final String REQUEST_ID = "req-bind-01";
    private static final String TRACE_ID = "0123456789abcdef0123456789abcdef";

    private final ObjectMapper mapper = new ObjectMapper();
    private final VerifiedContentPrincipalFactory principals = new VerifiedContentPrincipalFactory();

    @Test
    @DisplayName("verified publisher binds the current version once for learner assessment, sealed, and star rights")
    void verifiedPublisherBindsCurrentVersionOnce() throws Exception {
        Database db = database();
        String payload = articlePayload(article(88001L), List.of(
                question(88011L, "Stem 88011"), question(88012L, "Stem 88012")));
        insertPublished(db, new Fixture(payload));
        insertPublished(db, variant("reading.unit.sealed", "reading-unit-sealed", 1002L, 88021L, 88031L,
                "[\"LEARNER\",\"SEALED\"]"));
        insertPublished(db, variant("reading.unit.star", "reading-unit-star", 1003L, 88041L, 88051L, "[\"*\"]"));

        ResponseEntity<Map<String, Object>> response = call(db, KEY, request(
                "reading.unit.v1", 1001L, HASH.toUpperCase(Locale.ROOT), 4L));
        assertEquals(HttpStatus.OK.value(), response.getStatusCode().value());
        assertFixedMeta(response);
        Map<String, Object> data = data(response);
        assertEquals("reading.unit.v1", data.get("contentCode"));
        assertEquals(1001L, number(data.get("contentVersionId")));
        assertEquals(HASH, data.get("payloadHash"));
        assertEquals(4L, number(data.get("stateVersion")));
        assertEquals(88001L, number(data.get("articleId")));
        assertEquals("88011", data.get("articleQuestionItemId"));
        assertEquals(List.of("88011", "88012"), data.get("questionItemIds"));
        assertEquals("b3-reading-article-88001", data.get("articleExperienceId"));
        assertEquals(List.of("b3-reading-question-88011", "b3-reading-question-88012"), data.get("questionExperienceIds"));
        assertEquals("ACTIVE", data.get("bindingStatus"));
        assertEquals(Boolean.FALSE, data.get("replayed"));
        Map<String, Object> practice = map(data.get("practiceRef"));
        assertEquals(Set.of("contentCode", "contentVersionId", "questionItemId"), practice.keySet());
        assertEquals("reading.unit.v1", practice.get("contentCode"));
        assertEquals(1001L, number(practice.get("contentVersionId")));
        assertEquals("88011", practice.get("questionItemId"));
        String receiptJson = mapper.writeValueAsString(data);
        assertFalse(receiptJson.contains("Small routines"), receiptJson);
        assertFalse(receiptJson.contains("Stem "), receiptJson);
        assertFalse(receiptJson.contains("alpha"), receiptJson);
        assertFalse(receiptJson.contains("correctOption"), receiptJson);
        assertFalse(receiptJson.contains(SEAL), receiptJson);
        assertFalse(receiptJson.contains("readingRuleSeal"), receiptJson);

        Map<String, Object> articleExperience = single(db, """
                SELECT experience_id, resource_type, resource_key, content_version_id, availability, payload_json
                  FROM b3_content_experience WHERE resource_key = '88001'
                """);
        assertEquals("b3-reading-article-88001", text(articleExperience.get("experience_id")));
        assertEquals("READING_ARTICLE", text(articleExperience.get("resource_type")));
        assertEquals("88001", text(articleExperience.get("resource_key")));
        assertEquals(1001L, number(articleExperience.get("content_version_id")));
        assertEquals("PUBLISHED", text(articleExperience.get("availability")));
        Map<String, Object> articleBody = jsonMap(text(articleExperience.get("payload_json")));
        assertEquals(Set.of("articleId", "title", "cefrLevel", "wordCount", "contentVersionId", "blocks"),
                articleBody.keySet());
        assertEquals("Closed routines", articleBody.get("title"));
        assertEquals("B1", articleBody.get("cefrLevel"));
        assertEquals(8L, number(articleBody.get("wordCount")));
        assertEquals(1001L, number(articleBody.get("contentVersionId")));
        List<Map<String, Object>> blocks = list(articleBody.get("blocks"));
        assertEquals(2, blocks.size());
        assertEquals("Small routines make progress", blocks.get(0).get("text"));
        assertEquals("rendered-1", blocks.get(0).get("translation"));
        assertEquals("Review keeps it visible", blocks.get(1).get("text"));

        Map<String, Object> questionExperience = single(db, """
                SELECT experience_id, resource_key, content_version_id, payload_json
                  FROM b3_content_experience WHERE resource_key = '88011'
                """);
        assertEquals("b3-reading-question-88011", text(questionExperience.get("experience_id")));
        assertEquals("88011", text(questionExperience.get("resource_key")));
        assertEquals(1001L, number(questionExperience.get("content_version_id")));
        Map<String, Object> questionBody = jsonMap(text(questionExperience.get("payload_json")));
        assertEquals(Set.of("questionId", "articleId", "stemText", "options", "contentVersionId"), questionBody.keySet());
        assertEquals("Stem 88011", questionBody.get("stemText"));
        assertEquals(88001L, number(questionBody.get("articleId")));
        assertEquals(88011L, number(questionBody.get("questionId")));
        List<Map<String, Object>> options = list(questionBody.get("options"));
        assertEquals(Set.of("optionCode", "label"), options.get(0).keySet());
        assertEquals("alpha", options.get(0).get("optionCode"));
        assertEquals("Alpha label", options.get(0).get("label"));

        Map<String, Object> articleBinding = single(db, """
                SELECT b3_experience_id, content_code, content_version_id, question_item_id, status
                  FROM content_b3_item_binding WHERE b3_resource_key = '88001'
                """);
        assertEquals("b3-reading-article-88001", text(articleBinding.get("b3_experience_id")));
        assertEquals("reading.unit.v1", text(articleBinding.get("content_code")));
        assertEquals(1001L, number(articleBinding.get("content_version_id")));
        assertEquals("88011", text(articleBinding.get("question_item_id")));
        assertEquals("ACTIVE", text(articleBinding.get("status")));
        assertEquals("88011", text(single(db, """
                SELECT question_item_id FROM content_b3_item_binding WHERE b3_resource_key = '88011'
                """).get("question_item_id")));

        String experiences = mapper.writeValueAsString(rows(db, "SELECT payload_json FROM b3_content_experience"));
        assertFalse(experiences.contains(SEAL), experiences);
        assertFalse(experiences.contains("readingRuleSeal"), experiences);
        assertFalse(experiences.contains("correctOption"), experiences);
        assertFalse(experiences.contains("answerRule"), experiences);
        assertFalse(experiences.contains("estimatedMinutes"), experiences);
        assertFalse(experiences.contains("rightsStatus"), experiences);
        assertFalse(experiences.contains("practiceRef"), experiences);
        assertFalse(experiences.contains("questionType"), experiences);
        assertFalse(experiences.contains("\"topic\""), experiences);
        for (Map<String, Object> row : rows(db, "SELECT resource_key FROM b3_content_experience")) {
            assertTrue(text(row.get("resource_key")).matches("[1-9][0-9]{0,15}"));
        }

        Map<String, Object> idempotency = single(db, """
                SELECT scope, request_fingerprint, status, response_json
                  FROM content_idempotency_record WHERE idempotency_key = ?
                """, KEY);
        Map<String, Object> digest = new LinkedHashMap<>();
        digest.put("contentCode", "reading.unit.v1");
        digest.put("contentVersionId", 1001L);
        digest.put("expectedHash", HASH.toUpperCase(Locale.ROOT));
        digest.put("expectedStateVersion", 4L);
        assertEquals("content-reading-binding:publisher-1", text(idempotency.get("scope")));
        assertEquals(ContentPayloadHash.sha256(digest), text(idempotency.get("request_fingerprint")));
        assertEquals("COMPLETED", text(idempotency.get("status")));
        assertEquals(Boolean.FALSE, jsonMap(text(idempotency.get("response_json"))).get("replayed"));

        Map<String, Object> definition = single(db, """
                SELECT current_published_version_id, state_version FROM content_definition
                 WHERE content_code = 'reading.unit.v1'
                """);
        assertEquals(1001L, number(definition.get("current_published_version_id")));
        assertEquals(4L, number(definition.get("state_version")));
        Map<String, Object> version = single(db, """
                SELECT payload_json, payload_hash FROM content_version WHERE content_version_id = 1001
                """);
        assertEquals(HASH, text(version.get("payload_hash")));
        assertEquals(payload, text(version.get("payload_json")));
        assertTrue(text(version.get("payload_json")).contains("correctOption"));
        assertTrue(text(version.get("payload_json")).contains(SEAL));

        ResponseEntity<Map<String, Object>> sealed = call(db, "binding-key-seal01",
                request("reading.unit.sealed", 1002L, HASH, 4L));
        ResponseEntity<Map<String, Object>> star = call(db, "binding-key-star01",
                request("reading.unit.star", 1003L, HASH, 4L));
        assertEquals(List.of("88031"), data(sealed).get("questionItemIds"));
        assertEquals("88031", data(sealed).get("articleQuestionItemId"));
        assertEquals(Boolean.FALSE, data(sealed).get("replayed"));
        assertEquals(List.of("88051"), data(star).get("questionItemIds"));
        assertEquals(1L, count(db, """
                SELECT COUNT(*) FROM b3_content_experience
                 WHERE resource_type = 'READING_QUESTION' AND content_version_id = 1002
                """));
        assertEquals(1L, count(db, """
                SELECT COUNT(*) FROM b3_content_experience
                 WHERE resource_type = 'READING_QUESTION' AND content_version_id = 1003
                """));
        assertEquals(2L, count(db, """
                SELECT COUNT(*) FROM b3_content_experience
                 WHERE resource_type = 'READING_QUESTION' AND content_version_id = 1001
                """));
        assertEquals(7L, count(db, "SELECT COUNT(*) FROM b3_content_experience"));
        assertEquals(7L, count(db, "SELECT COUNT(*) FROM content_b3_item_binding"));
    }

    @Test
    @DisplayName("same-key replay and exact current-version match do not rewrite stored rows")
    void replayAndExactMatchDoNotRewriteStoredRows() throws Exception {
        Database db = database();
        insertPublished(db, new Fixture(articlePayload(article(88001L), List.of(
                question(88011L, "Stem 88011"), question(88012L, "Stem 88012")))));
        Map<String, Object> body = request("reading.unit.v1", 1001L, HASH, 4L);
        Map<String, Object> first = data(call(db, KEY, body));
        assertEquals(Boolean.FALSE, first.get("replayed"));
        String storedReceipt = text(single(db, """
                SELECT response_json FROM content_idempotency_record WHERE idempotency_key = ?
                """, KEY).get("response_json"));
        String storedExperiences = dump(db, "SELECT experience_id, payload_json FROM b3_content_experience ORDER BY experience_id");
        assertEquals(3L, count(db, "SELECT COUNT(*) FROM b3_content_experience"));

        Map<String, Object> replay = data(call(db, KEY, body));
        assertEquals(Boolean.TRUE, replay.get("replayed"));
        assertEquals(1001L, number(replay.get("contentVersionId")));
        assertEquals(first.get("questionItemIds"), replay.get("questionItemIds"));
        assertEquals(storedReceipt, text(single(db, """
                SELECT response_json FROM content_idempotency_record WHERE idempotency_key = ?
                """, KEY).get("response_json")));
        assertEquals(Boolean.FALSE, jsonMap(storedReceipt).get("replayed"));
        assertEquals(storedExperiences, dump(db, """
                SELECT experience_id, payload_json FROM b3_content_experience ORDER BY experience_id
                """));

        Map<String, Object> exact = data(call(db, "binding-key-0002", body));
        assertEquals(Boolean.TRUE, exact.get("replayed"));
        assertEquals(1001L, number(exact.get("contentVersionId")));
        assertEquals(3L, count(db, "SELECT COUNT(*) FROM b3_content_experience"));
        assertEquals(3L, count(db, "SELECT COUNT(*) FROM content_b3_item_binding"));
        assertEquals(2L, count(db, "SELECT COUNT(*) FROM content_idempotency_record"));
        assertEquals(Boolean.FALSE, jsonMap(text(single(db, """
                SELECT response_json FROM content_idempotency_record WHERE idempotency_key = 'binding-key-0002'
                """).get("response_json"))).get("replayed"));
        assertEquals(storedExperiences, dump(db, """
                SELECT experience_id, payload_json FROM b3_content_experience ORDER BY experience_id
                """));

        db.jdbc.update("DELETE FROM content_b3_item_binding WHERE b3_resource_key = '88012'");
        db.jdbc.update("DELETE FROM b3_content_experience WHERE resource_key = '88012'");
        String partial = dumpAll(db);
        ResponseEntity<Map<String, Object>> mixed = call(db, "binding-key-0003", body);
        assertError(mixed, HttpStatus.CONFLICT, "READING_BINDING_CROSS_OWNER_KEY",
                "reading binding key is owned by different content");
        assertEquals(partial, dumpAll(db));
        assertEquals(0L, count(db, "SELECT COUNT(*) FROM b3_content_experience WHERE resource_key = '88012'"));

        db.jdbc.update("UPDATE content_definition SET current_published_version_id = 1002 WHERE content_code = 'reading.unit.v1'");
        Map<String, Object> moved = data(call(db, KEY, body));
        assertEquals(Boolean.TRUE, moved.get("replayed"));
        assertEquals(1001L, number(moved.get("contentVersionId")));
        assertEquals(HASH, moved.get("payloadHash"));
        assertEquals(storedReceipt, text(single(db, """
                SELECT response_json FROM content_idempotency_record WHERE idempotency_key = ?
                """, KEY).get("response_json")));
        assertEquals(1001L, number(single(db, """
                SELECT content_version_id FROM b3_content_experience WHERE resource_key = '88001'
                """).get("content_version_id")));

        ResponseEntity<Map<String, Object>> conflict = call(db, KEY,
                request("reading.unit.v1", 1001L, "ff".repeat(32), 4L));
        assertError(conflict, HttpStatus.CONFLICT, "READING_BINDING_IDEMPOTENCY_CONFLICT",
                "Idempotency-Key was reused for a different request");
        assertFalse(mapper.writeValueAsString(conflict.getBody()).contains("replayed"));
        assertEquals(storedReceipt, text(single(db, """
                SELECT response_json FROM content_idempotency_record WHERE idempotency_key = ?
                """, KEY).get("response_json")));
        assertEquals(2L, count(db, "SELECT COUNT(*) FROM content_idempotency_record"));
    }

    @Test
    @DisplayName("auth, validation, and owner conflicts leave every existing row untouched")
    void rejectedCallsLeaveEveryExistingRowUntouched() throws Exception {
        B9PublishedReadingBindingController denying = denyingController();
        Map<String, Object> valid = request("reading.unit.v1", 1001L, HASH, 4L);
        assertDenied(denying, null, KEY, valid, HttpStatus.UNAUTHORIZED, "READING_BINDING_AUTH_REQUIRED",
                "a verified access token is required");
        JwtAuthenticationToken unauthenticated = publisher();
        unauthenticated.setAuthenticated(false);
        assertDenied(denying, unauthenticated, KEY, valid, HttpStatus.UNAUTHORIZED, "READING_BINDING_AUTH_REQUIRED",
                "a verified access token is required");
        assertDenied(denying, new UsernamePasswordAuthenticationToken("publisher-1", "secret"), KEY, valid,
                HttpStatus.UNAUTHORIZED, "READING_BINDING_AUTH_REQUIRED", "a verified access token is required");
        assertDenied(denying, token("publisher-1", "secret-tenant", List.of(), List.of("content:publish")), KEY, valid,
                HttpStatus.UNAUTHORIZED, "READING_BINDING_AUTH_REQUIRED", "a verified access token is required");
        assertFalse(mapper.writeValueAsString(call(denying, token(
                "publisher-1", "secret-tenant", List.of(), List.of("content:publish")), KEY, valid, headers()).getBody())
                .contains("secret-tenant"));
        assertDenied(denying, token("has space", "platform", List.of(), List.of("content:publish")), KEY, valid,
                HttpStatus.UNAUTHORIZED, "READING_BINDING_AUTH_REQUIRED", "a verified access token is required");
        assertDenied(denying, token("publisher-1", "platform", List.of(), List.of()), KEY, valid,
                HttpStatus.FORBIDDEN, "READING_BINDING_PUBLISH_PERMISSION_REQUIRED", "content:publish is required");
        assertDenied(denying, token("publisher-1", "platform", List.of("content-publisher"), List.of()), KEY, valid,
                HttpStatus.FORBIDDEN, "READING_BINDING_PUBLISH_PERMISSION_REQUIRED", "content:publish is required");
        assertDenied(denying, token("editor-1", "platform", List.of("content-editor"), List.of("content:write")), KEY, valid,
                HttpStatus.FORBIDDEN, "READING_BINDING_PUBLISH_PERMISSION_REQUIRED", "content:publish is required");

        assertDenied(denying, publisher(), null, valid, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        assertDenied(denying, publisher(), "binding-key-000", valid, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        assertDenied(denying, publisher(), KEY, null, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        Map<String, Object> extra = request("reading.unit.v1", 1001L, HASH, 4L);
        extra.put("actor", "publisher-1");
        assertDenied(denying, publisher(), KEY, extra, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        assertDenied(denying, publisher(), KEY, request("reading.unit.v1", 1001L, HASH, 0L),
                HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION", "reading binding request is invalid");
        Map<String, Object> stringVersion = request("reading.unit.v1", 1001L, HASH, 4L);
        stringVersion.put("contentVersionId", "1001");
        assertDenied(denying, publisher(), KEY, stringVersion, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        Map<String, Object> decimalVersion = request("reading.unit.v1", 1001L, HASH, 4L);
        decimalVersion.put("contentVersionId", 1001.0d);
        assertDenied(denying, publisher(), KEY, decimalVersion, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");
        Map<String, Object> paddedCode = request(" reading.unit.v1", 1001L, HASH, 4L);
        assertDenied(denying, publisher(), KEY, paddedCode, HttpStatus.BAD_REQUEST, "READING_BINDING_VALIDATION",
                "reading binding request is invalid");

        HttpHeaders generatedHeaders = new HttpHeaders();
        generatedHeaders.set("X-Request-Id", "bad");
        generatedHeaders.set("X-Trace-Id", "ZZZ");
        ResponseEntity<Map<String, Object>> generated = call(denying, publisher(), KEY, extra, generatedHeaders);
        assertEquals(HttpStatus.BAD_REQUEST.value(), generated.getStatusCode().value());
        String requestId = generated.getHeaders().getFirst("X-Request-Id");
        String traceId = generated.getHeaders().getFirst("X-Trace-Id");
        assertTrue(requestId != null && requestId.matches("local-[0-9a-f]{32}"), requestId);
        assertTrue(traceId != null && traceId.matches("[0-9a-f]{32}"), traceId);
        assertEquals("v1", generated.getHeaders().getFirst("X-API-Version"));
        assertEquals(requestId, map(generated.getBody().get("meta")).get("requestId"));
        assertEquals(traceId, map(generated.getBody().get("meta")).get("traceId"));
        assertEquals("2026-06-01T00:00:00Z", map(generated.getBody().get("meta")).get("serverTime"));

        Database db = database();
        String validPayload = articlePayload(article(88001L), List.of(
                question(88011L, "Stem 88011"), question(88012L, "Stem 88012")));
        Map<String, Object> body = request("reading.unit.v1", 1001L, HASH, 4L);
        reject(db, validPayload, fixture -> fixture.publisher = "publisher-2", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_PUBLISHER_MISMATCH",
                "verified subject is not the stored publisher");
        reject(db, validPayload, fixture -> fixture.editor = "reviewer-1", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_ACTORS_INVALID", "stored publication actors are invalid");
        reject(db, validPayload, fixture -> fixture.publisher = " ", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_ACTORS_INVALID", "stored publication actors are invalid");
        reject(db, validPayload, null, null, KEY, request("reading.unit.v1", 1001L, "ff".repeat(32), 4L),
                HttpStatus.CONFLICT, "READING_BINDING_CAS_CONFLICT",
                "published version hash or state does not match");
        reject(db, validPayload, null, null, KEY, request("reading.unit.v1", 1001L, HASH, 5L),
                HttpStatus.CONFLICT, "READING_BINDING_CAS_CONFLICT",
                "published version hash or state does not match");
        reject(db, validPayload, fixture -> fixture.status = "ARCHIVED", null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_NOT_PUBLISHED",
                "content version is not the current published version");
        reject(db, validPayload, fixture -> fixture.archivedAt = "2026-05-02T00:00:00Z", null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_NOT_PUBLISHED",
                "content version is not the current published version");
        reject(db, validPayload, fixture -> fixture.publishedAt = null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_NOT_PUBLISHED",
                "content version is not the current published version");
        reject(db, validPayload, fixture -> fixture.publishedAt = "yesterday", null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_NOT_PUBLISHED",
                "content version is not the current published version");
        reject(db, validPayload, fixture -> fixture.pointer = null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_NOT_PUBLISHED",
                "content version is not the current published version");
        reject(db, validPayload, fixture -> fixture.pointer = 1002L, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_IDENTITY_MISMATCH",
                "content identity does not match the published definition");
        reject(db, validPayload, null, null, KEY, request("reading.missing.v1", 1001L, HASH, 4L),
                HttpStatus.CONFLICT, "READING_BINDING_IDENTITY_MISMATCH",
                "content identity does not match the published definition");
        reject(db, validPayload, fixture -> fixture.tenant = "school", null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_IDENTITY_MISMATCH",
                "content identity does not match the published definition");
        reject(db, validPayload, null, null, KEY, request(GradableQuestions.SEALED_CODE, 1001L, HASH, 4L),
                HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY", "reading binding key is reserved");
        reject(db, validPayload, null, null, KEY, request("reading.unit.v1", 301L, HASH, 4L),
                HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY", "reading binding key is reserved");
        reject(db, validPayload, null, null, KEY, request("reading.unit.v1", 266100L, HASH, 4L),
                HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY", "reading binding key is reserved");
        reject(db, validPayload, fixture -> fixture.contentId = GradableQuestions.SEALED_OWNER_ID, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY", "reading binding key is reserved");
        reject(db, articlePayload(article(3501L), List.of(question(88011L, "Stem 88011"), question(88012L, "Stem 88012"))),
                null, null, KEY, body, HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY",
                "reading binding key is reserved");
        reject(db, articlePayload(article(88001L), List.of(question(3950L, "Stem 3950"), question(88012L, "Stem 88012"))),
                null, null, KEY, body, HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY",
                "reading binding key is reserved");
        reject(db, articlePayload(article(88001L), List.of(question(266001L, "Stem 266001"))),
                null, null, KEY, body, HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY",
                "reading binding key is reserved");
        reject(db, articlePayload(article(88001L), List.of(question(266010L, "Stem 266010"))),
                null, null, KEY, body, HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY",
                "reading binding key is reserved");
        reject(db, articlePayload(article(3501L), List.of(question(88011L, "Stem 88011"))), null, () -> db.jdbc.update("""
                INSERT INTO b3_content_experience
                    (experience_id, tenant_id, domain_code, resource_type, resource_key,
                     content_version_id, availability, payload_json)
                VALUES ('b3-reading-article-3501', 'platform', 'READING', 'READING_ARTICLE', '3501',
                        1002, 'PUBLISHED', '{"kept":true}')
                """), KEY, body, HttpStatus.CONFLICT, "READING_BINDING_RESERVED_KEY",
                "reading binding key is reserved");
        reject(db, validPayload, null, () -> db.jdbc.update("""
                INSERT INTO b3_content_experience
                    (experience_id, tenant_id, domain_code, resource_type, resource_key,
                     content_version_id, availability, payload_json)
                VALUES ('b3-reading-article-88001', 'platform', 'READING', 'READING_ARTICLE', '88001',
                        1002, 'PUBLISHED', '{"kept":true}')
                """), KEY, body, HttpStatus.CONFLICT, "READING_BINDING_CROSS_OWNER_KEY",
                "reading binding key is owned by different content");

        reject(db, articlePayload(null, List.of(question(88011L, "Stem 88011"))), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        Map<String, Object> clientArticle = new LinkedHashMap<>();
        clientArticle.put("articleId", 88001L);
        clientArticle.put("blocks", List.of(
                block(1, "Small routines make progress"), block(2, "Review keeps it visible")));
        reject(db, articlePayload(clientArticle, List.of(question(88011L, "Stem 88011"))), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        Map<String, Object> estimated = article(88001L);
        estimated.put("estimatedMinutes", 5);
        reject(db, articlePayload(estimated, List.of(question(88011L, "Stem 88011"))), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        Map<String, Object> wrongCount = article(88001L);
        wrongCount.put("wordCount", 7L);
        reject(db, articlePayload(wrongCount, List.of(question(88011L, "Stem 88011"))), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        reject(db, articlePayload(article(88011L), List.of(question(88011L, "Stem 88011"))), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        reject(db, "{", null, null, KEY, body, HttpStatus.CONFLICT, "READING_BINDING_ARTICLE_REQUIRED",
                "published version has no closed reading article");
        reject(db, articlePayload(article(88001L), null), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        reject(db, articlePayload(article(88001L), List.of()), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        Map<String, Object> badRule = question(88011L, "Stem 88011");
        badRule.put("answerRule", Map.of("correctOption", "gamma"));
        reject(db, articlePayload(article(88001L), List.of(badRule)), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        Map<String, Object> topic = question(88011L, "Stem 88011");
        topic.put("topic", "habits");
        reject(db, articlePayload(article(88001L), List.of(topic)), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        assertTrue(GradableQuestions.isStoredSeal(SEAL));
        assertTrue(GradableQuestions.isStoredSeal(SEAL.toUpperCase(Locale.ROOT)));
        assertFalse(GradableQuestions.isStoredSeal(null));
        assertFalse(GradableQuestions.isStoredSeal(""));
        assertFalse(GradableQuestions.isStoredSeal("ab".repeat(31)));
        assertFalse(GradableQuestions.isStoredSeal(SEAL + "e"));
        assertFalse(GradableQuestions.isStoredSeal("g".repeat(64)));
        assertFalse(GradableQuestions.isStoredSeal(8675309));
        Map<String, Object> sealedQuestion = question(88011L, "Stem 88011");
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), OMIT_SEAL), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), null), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), ""), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions");
        String shortSeal = "ab".repeat(31);
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), shortSeal), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions", shortSeal);
        String longSeal = SEAL + "e";
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), longSeal), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions", longSeal);
        String nonHex = "g".repeat(64);
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), nonHex), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions", nonHex);
        reject(db, articlePayload(article(88001L), List.of(sealedQuestion), 8675309), null, null, KEY, body,
                HttpStatus.CONFLICT, "READING_BINDING_QUESTIONS_REQUIRED",
                "published version has no closed gradable questions", "8675309");

        reject(db, validPayload, fixture -> fixture.channels = "[\"LEARNER\"]", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.channels = "[\"LEARNER\",\"PUBLIC\"]", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.channels = "[\"SEALED\"]", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.channels = "[\"ASSESSMENT\"]", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.copyright = "REVOKED", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.learning = false, null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.evidence = " ", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.source = " ", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.license = "", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.expires = "2026-06-01T00:00:00Z", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.starts = "2026-07-01T00:00:00Z", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        reject(db, validPayload, fixture -> fixture.expires = "not-a-date", null, KEY, body,
                HttpStatus.FORBIDDEN, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
    }

    @Test
    @DisplayName("a failed experience insert rolls back the owner transaction")
    void failedInsertRollsBackTheOwnerTransaction() throws Exception {
        DriverManagerDataSource dataSource = dataSource();
        FailOnSecondExperience jdbc = new FailOnSecondExperience(dataSource);
        schema(jdbc);
        Database db = new Database(jdbc);
        String payload = articlePayload(article(88001L), List.of(
                question(88011L, "Stem 88011"), question(88012L, "Stem 88012")));
        insertPublished(db, new Fixture(payload));
        Command command = new Command("publisher-1", KEY, "reading.unit.v1", 1001L, HASH, 4L);
        assertThrows(DataAccessResourceFailureException.class, () -> db.store.bind(command));
        assertEquals(0L, count(db, "SELECT COUNT(*) FROM b3_content_experience"));
        assertEquals(0L, count(db, "SELECT COUNT(*) FROM content_b3_item_binding"));
        assertEquals(0L, count(db, "SELECT COUNT(*) FROM content_idempotency_record"));
        assertEquals(payload, text(single(db, "SELECT payload_json FROM content_version").get("payload_json")));
        assertEquals(1001L, number(single(db, """
                SELECT current_published_version_id FROM content_definition
                """).get("current_published_version_id")));
    }

    private void reject(
            Database db, String payload, Consumer<Fixture> arrange, Runnable afterSeed, String key,
            Map<String, Object> body, HttpStatus status, String code, String message) throws Exception {
        reject(db, payload, arrange, afterSeed, key, body, status, code, message, null);
    }

    private void reject(
            Database db, String payload, Consumer<Fixture> arrange, Runnable afterSeed, String key,
            Map<String, Object> body, HttpStatus status, String code, String message, String withheld)
            throws Exception {
        Fixture fixture = new Fixture(payload);
        if (arrange != null) {
            arrange.accept(fixture);
        }
        wipe(db);
        insertPublished(db, fixture);
        if (afterSeed != null) {
            afterSeed.run();
        }
        String before = dumpAll(db);
        ResponseEntity<Map<String, Object>> response = call(db, key, body);
        assertError(response, status, code, message);
        if (withheld != null) {
            assertFalse(mapper.writeValueAsString(response.getBody()).contains(withheld), code);
        }
        assertEquals(before, dumpAll(db), code);
    }

    private void assertDenied(
            B9PublishedReadingBindingController controller, Authentication authentication, String key,
            Map<String, Object> body, HttpStatus status, String code, String message) throws Exception {
        assertError(call(controller, authentication, key, body, headers()), status, code, message);
    }

    private ResponseEntity<Map<String, Object>> call(Database db, String key, Map<String, Object> body) {
        return call(db.controller, publisher(), key, body, headers());
    }

    private ResponseEntity<Map<String, Object>> call(
            B9PublishedReadingBindingController controller, Authentication authentication, String key,
            Map<String, Object> body, HttpHeaders headers) {
        return controller.bindB9PublishedReading(authentication, key, headers, body);
    }

    private void assertError(
            ResponseEntity<Map<String, Object>> response, HttpStatus status, String code, String message)
            throws Exception {
        assertEquals(status.value(), response.getStatusCode().value(), code);
        assertFixedMeta(response);
        Map<String, Object> body = response.getBody();
        assertEquals(Set.of("error", "meta"), body.keySet(), code);
        Map<String, Object> error = map(body.get("error"));
        assertEquals(Set.of("errorCode", "message", "retryable"), error.keySet(), code);
        assertEquals(code, error.get("errorCode"));
        assertEquals(message, error.get("message"));
        assertEquals(Boolean.FALSE, error.get("retryable"));
        String json = mapper.writeValueAsString(body);
        assertFalse(json.contains("Small routines"), code);
        assertFalse(json.contains("Stem "), code);
        assertFalse(json.contains("correctOption"), code);
        assertFalse(json.contains("publisher-1"), code);
        assertFalse(json.contains("editor-1"), code);
        assertFalse(json.contains(SEAL), code);
        assertFalse(json.contains("readingRuleSeal"), code);
    }

    private static void assertFixedMeta(ResponseEntity<Map<String, Object>> response) {
        assertEquals(REQUEST_ID, response.getHeaders().getFirst("X-Request-Id"));
        assertEquals(TRACE_ID, response.getHeaders().getFirst("X-Trace-Id"));
        assertEquals("v1", response.getHeaders().getFirst("X-API-Version"));
        Map<String, Object> meta = map(response.getBody().get("meta"));
        assertEquals(Set.of("requestId", "traceId", "apiVersion", "schemaVersion", "serverTime"), meta.keySet());
        assertEquals(REQUEST_ID, meta.get("requestId"));
        assertEquals(TRACE_ID, meta.get("traceId"));
        assertEquals("v1", meta.get("apiVersion"));
        assertEquals("1.0.0", meta.get("schemaVersion"));
        assertEquals("2026-06-01T00:00:00Z", meta.get("serverTime"));
    }

    private static HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Request-Id", REQUEST_ID);
        headers.set("X-Trace-Id", TRACE_ID);
        return headers;
    }

    private static Map<String, Object> request(String code, long versionId, String hash, long stateVersion) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contentCode", code);
        body.put("contentVersionId", versionId);
        body.put("expectedHash", hash);
        body.put("expectedStateVersion", stateVersion);
        return body;
    }

    private Fixture variant(
            String code, String contentId, long versionId, long articleId, long itemId, String channels)
            throws Exception {
        Fixture fixture = new Fixture(articlePayload(article(articleId), List.of(question(itemId, "Stem " + itemId))));
        fixture.code = code;
        fixture.contentId = contentId;
        fixture.pointer = versionId;
        fixture.versionId = versionId;
        fixture.channels = channels;
        return fixture;
    }

    private String articlePayload(Object article, Object questions) throws Exception {
        return articlePayload(article, questions, SEAL);
    }

    /** {@code seal} of {@link #OMIT_SEAL} drops the key. Null is stored as JSON null. */
    private String articlePayload(Object article, Object questions, Object seal) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("summary", "ignored summary");
        if (article != null) {
            body.put("readingArticle", article);
        }
        if (questions != null) {
            body.put("gradableQuestions", questions);
        }
        if (seal != OMIT_SEAL) {
            body.put(GradableQuestions.SEAL_FIELD, seal);
        }
        body.put("items", List.of(Map.of("itemId", 1L, "stem", "should not be copied")));
        return mapper.writeValueAsString(body);
    }

    private static Map<String, Object> article(long articleId) {
        Map<String, Object> article = new LinkedHashMap<>();
        article.put("articleId", articleId);
        article.put("title", "Closed routines");
        article.put("cefrLevel", "B1");
        article.put("wordCount", 8L);
        article.put("blocks", List.of(
                block(1, "Small routines make progress"),
                block(2, "Review keeps it visible")));
        return article;
    }

    private static Map<String, Object> block(int number, String text) {
        Map<String, Object> block = new LinkedHashMap<>();
        block.put("blockId", "block-" + number);
        block.put("blockIndex", number - 1);
        block.put("text", text);
        block.put("translation", "rendered-" + number);
        return block;
    }

    private static Map<String, Object> question(long itemId, String stem) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("itemId", itemId);
        question.put("stem", stem);
        question.put("options", List.of(
                Map.of("optionId", "alpha", "label", "Alpha label"),
                Map.of("optionId", "beta", "label", "Beta label")));
        question.put("answerRule", Map.of("correctOption", "alpha"));
        return question;
    }

    private void insertPublished(Database db, Fixture fixture) {
        db.jdbc.update("""
                INSERT INTO content_definition
                    (content_id, tenant_id, content_code, current_published_version_id, state_version)
                VALUES (?, ?, ?, ?, ?)
                """, fixture.contentId, fixture.tenant, fixture.code, fixture.pointer, fixture.stateVersion);
        db.jdbc.update("""
                INSERT INTO content_version (
                    content_version_id, content_id, status, payload_json, payload_hash,
                    published_at, archived_at, copyright_status, rights_allows_learning,
                    rights_source_code, rights_license_code, rights_permitted_channels,
                    rights_starts_at, rights_expires_at, authorization_evidence_ref,
                    editor, first_reviewer, final_reviewer, publisher)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                fixture.versionId, fixture.contentId, fixture.status, fixture.payload, fixture.hash,
                fixture.publishedAt, fixture.archivedAt, fixture.copyright, fixture.learning,
                fixture.source, fixture.license, fixture.channels, fixture.starts, fixture.expires,
                fixture.evidence, fixture.editor, fixture.firstReviewer, fixture.finalReviewer, fixture.publisher);
    }

    private void wipe(Database db) {
        db.jdbc.update("DELETE FROM content_b3_item_binding");
        db.jdbc.update("DELETE FROM b3_content_experience");
        db.jdbc.update("DELETE FROM content_idempotency_record");
        db.jdbc.update("DELETE FROM content_version");
        db.jdbc.update("DELETE FROM content_definition");
    }

    private String dumpAll(Database db) {
        return dump(db, """
                SELECT content_id, tenant_id, content_code, current_published_version_id, state_version
                  FROM content_definition ORDER BY content_id
                """)
                + dump(db, """
                SELECT content_version_id, status, payload_json, payload_hash, published_at, archived_at,
                       copyright_status, publisher FROM content_version ORDER BY content_version_id
                """)
                + dump(db, """
                SELECT experience_id, resource_type, resource_key, content_version_id, availability, payload_json
                  FROM b3_content_experience ORDER BY experience_id
                """)
                + dump(db, """
                SELECT b3_resource_type, b3_resource_key, b3_experience_id, content_code, content_version_id,
                       question_item_id, status
                  FROM content_b3_item_binding ORDER BY b3_resource_key, b3_resource_type
                """)
                + dump(db, """
                SELECT scope, idempotency_key, request_fingerprint, status, response_json
                  FROM content_idempotency_record ORDER BY idempotency_key
                """);
    }

    private String dump(Database db, String sql) {
        StringBuilder builder = new StringBuilder();
        for (Map<String, Object> row : rows(db, sql)) {
            builder.append(row).append('\n');
        }
        return builder.toString();
    }

    private Map<String, Object> single(Database db, String sql, Object... args) {
        List<Map<String, Object>> found = rows(db, sql, args);
        assertEquals(1, found.size(), sql);
        return found.get(0);
    }

    private List<Map<String, Object>> rows(Database db, String sql, Object... args) {
        return db.jdbc.queryForList(sql, args).stream()
                .map(B9PublishedReadingBindingControllerTest::lower).toList();
    }

    private static long count(Database db, String sql) {
        Long count = db.jdbc.queryForObject(sql, Long.class);
        return count == null ? 0L : count;
    }

    private static Map<String, Object> lower(Map<String, Object> row) {
        Map<String, Object> copy = new LinkedHashMap<>();
        row.forEach((key, value) -> copy.put(key == null ? "" : key.toLowerCase(Locale.ROOT), value));
        return copy;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> jsonMap(String json) throws Exception {
        return mapper.readValue(json, Map.class);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(ResponseEntity<Map<String, Object>> response) {
        return (Map<String, Object>) response.getBody().get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private static String text(Object value) {
        if (value instanceof String string) {
            return string;
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return value == null ? null : String.valueOf(value);
    }

    private Database database() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource());
        schema(jdbc);
        return new Database(jdbc);
    }

    private B9PublishedReadingBindingController denyingController() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        DenyingJdbc jdbc = new DenyingJdbc(dataSource);
        return new Database(jdbc).controller;
    }

    private static DriverManagerDataSource dataSource() {
        return new DriverManagerDataSource(
                "jdbc:h2:mem:reading-bind-" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1",
                "sa", "");
    }

    private static void schema(JdbcTemplate jdbc) {
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY,
                    tenant_id VARCHAR(128) NOT NULL,
                    content_code VARCHAR(128) NOT NULL,
                    current_published_version_id BIGINT NULL,
                    state_version BIGINT NOT NULL)
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY,
                    content_id VARCHAR(128) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    payload_json VARCHAR(16000) NOT NULL,
                    payload_hash VARCHAR(64) NOT NULL,
                    published_at VARCHAR(64) NULL,
                    archived_at VARCHAR(64) NULL,
                    copyright_status VARCHAR(32) NULL,
                    rights_allows_learning BOOLEAN NULL,
                    rights_source_code VARCHAR(128) NULL,
                    rights_license_code VARCHAR(128) NULL,
                    rights_permitted_channels VARCHAR(256) NULL,
                    rights_starts_at VARCHAR(64) NULL,
                    rights_expires_at VARCHAR(64) NULL,
                    authorization_evidence_ref VARCHAR(128) NULL,
                    editor VARCHAR(128) NULL,
                    first_reviewer VARCHAR(128) NULL,
                    final_reviewer VARCHAR(128) NULL,
                    publisher VARCHAR(128) NULL)
                """);
        jdbc.execute("""
                CREATE TABLE b3_content_experience (
                    experience_id VARCHAR(96) PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    domain_code VARCHAR(32) NOT NULL,
                    resource_type VARCHAR(64) NOT NULL,
                    resource_key VARCHAR(96) NOT NULL,
                    content_version_id BIGINT NOT NULL,
                    availability VARCHAR(16) NOT NULL,
                    payload_json VARCHAR(16000) NOT NULL,
                    UNIQUE (tenant_id, domain_code, resource_type, resource_key))
                """);
        jdbc.execute("""
                CREATE TABLE content_b3_item_binding (
                    binding_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    b3_domain VARCHAR(32) NOT NULL,
                    b3_resource_type VARCHAR(64) NOT NULL,
                    b3_resource_key VARCHAR(96) NOT NULL,
                    b3_experience_id VARCHAR(96) NOT NULL,
                    content_code VARCHAR(128) NOT NULL,
                    content_version_id BIGINT NOT NULL,
                    question_item_id VARCHAR(128) NOT NULL,
                    status VARCHAR(16) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (tenant_id, b3_domain, b3_resource_type, b3_resource_key))
                """);
        jdbc.execute("""
                CREATE TABLE content_idempotency_record (
                    scope VARCHAR(255) NOT NULL,
                    idempotency_key VARCHAR(128) NOT NULL,
                    request_fingerprint VARCHAR(64) NOT NULL,
                    status VARCHAR(24) NOT NULL,
                    response_json VARCHAR(16000) NULL,
                    recorded_at TIMESTAMP NOT NULL,
                    PRIMARY KEY (scope, idempotency_key))
                """);
    }

    private final class Database {
        private final JdbcTemplate jdbc;
        private final JdbcPublishedReadingBindings store;
        private final B9PublishedReadingBindingController controller;

        private Database(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
            this.store = new JdbcPublishedReadingBindings(
                    jdbc, mapper,
                    new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource())),
                    CLOCK);
            this.controller = new B9PublishedReadingBindingController(store, principals, CLOCK);
        }
    }

    private static JwtAuthenticationToken publisher() {
        return token("publisher-1", "platform", List.of(), List.of("content:publish"));
    }

    private static JwtAuthenticationToken token(
            String subject, String tenant, List<String> roles, List<String> permissions) {
        Instant now = Instant.parse("2026-06-01T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("token-" + subject)
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", tenant)
                .claim("roles", roles)
                .claim("permissions", permissions)
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private static final class Fixture {
        private String contentId = "reading-unit-v1";
        private String tenant = "platform";
        private String code = "reading.unit.v1";
        private Long pointer = 1001L;
        private long stateVersion = 4L;
        private long versionId = 1001L;
        private String status = "PUBLISHED";
        private final String payload;
        private String hash = HASH;
        private String publishedAt = "2026-05-01T00:00:00Z";
        private String archivedAt;
        private String copyright = "ACTIVE";
        private Boolean learning = Boolean.TRUE;
        private String source = "source-1";
        private String license = "license-1";
        private String channels = "[\"LEARNER\",\"ASSESSMENT\"]";
        private String starts = "2026-01-01T00:00:00Z";
        private String expires = "2026-12-01T00:00:00Z";
        private String evidence = "evidence-1";
        private String editor = "editor-1";
        private String firstReviewer = "reviewer-1";
        private String finalReviewer = "reviewer-2";
        private String publisher = "publisher-1";

        private Fixture(String payload) {
            this.payload = payload;
        }
    }

    private static final class DenyingJdbc extends JdbcTemplate {
        private DenyingJdbc(DriverManagerDataSource dataSource) {
            super(dataSource);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            throw new AssertionError("reading bind must not touch jdbc before authorization and validation");
        }

        @Override
        public int update(String sql, Object... args) {
            throw new AssertionError("reading bind must not touch jdbc before authorization and validation");
        }

        @Override
        public void execute(String sql) {
            throw new AssertionError("reading bind must not touch jdbc before authorization and validation");
        }
    }

    private static final class FailOnSecondExperience extends JdbcTemplate {
        private int experienceInserts;

        private FailOnSecondExperience(DriverManagerDataSource dataSource) {
            super(dataSource);
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT INTO b3_content_experience")) {
                experienceInserts++;
                if (experienceInserts == 2) {
                    throw new DataAccessResourceFailureException("second experience insert failed");
                }
            }
            return super.update(sql, args);
        }
    }
}
