package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Answer-leak prevention and audience/channel projection rules for {@link ContentProjectionPolicy}. */
@DisplayName("ContentProjectionPolicy answer-leak and audience rules")
class ContentProjectionPolicyTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final String STORED_SEAL =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    private static ContentRights publishableRights(Set<String> channels) {
        return new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                channels, NOW.minusSeconds(60), null, "evidence-1");
    }

    private static ContentVersion publishedVersion(ContentRights rights, Map<String, Object> fields, ContentVersionStatus status) {
        String hash = ContentPayloadHash.sha256(fields);
        return ContentVersion.rehydrate(
                ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, fields, hash,
                rights, null, "editor-1", "note", NOW, status, null, null, null,
                status == ContentVersionStatus.PUBLISHED ? NOW : null, null, null, 0, 0, 1L);
    }

    private static ContentDefinition definitionWith(ContentVersion version) {
        boolean published = version.status() == ContentVersionStatus.PUBLISHED;
        return ContentDefinition.rehydrate(
                ContentId.of("cnt_proj_1"), "platform", "vocab-proj-1", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW,
                List.of(version), published ? version.versionId() : null, 1L, 1L);
    }

    @Test
    @DisplayName("public projection strips restricted answer-rule keys")
    void publicProjectionStripsAnswerRules() {
        Map<String, Object> fields = Map.of(
                "term", "cat", "definition", "猫",
                "answerRule", Map.of("correctOption", "A"),
                GradableQuestions.SEAL_FIELD, STORED_SEAL);
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC", "LEARNER")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.fields().containsKey("answerRule"));
        assertTrue(projection.fields().containsKey("term"));
        assertFalse(hasKey(projection.fields(), GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(projection.fields()).contains(STORED_SEAL));
        assertNotEquals(STORED_SEAL, projection.contentHash());
    }

    @Test
    @DisplayName("nested answer rules inside options are also stripped")
    void nestedAnswerRulesStripped() {
        Map<String, Object> fields = Map.of(
                "prompt", "choose",
                "options", List.of(
                        Map.of("label", "A"),
                        Map.of("correct", true, "answerRule", Map.of("correctOption", "A"))));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.containsAnswerRules());
        List<?> options = (List<?>) projection.fields().get("options");
        assertEquals(2, options.size());
        for (Object option : options) {
            assertFalse(((Map<?, ?>) option).containsKey("answerRule"));
        }
    }

    @Test
    @DisplayName("admin preview returns the raw payload including answer rules")
    void adminPreviewReturnsRawPayload() {
        Map<String, Object> fields = Map.of(
                "term", "cat", "answerRule", Map.of("correctOption", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN, NOW, false);
        assertTrue(projection.fields().containsKey("answerRule"));
    }

    @Test
    @DisplayName("unpublished versions are not available to public readers")
    void unpublishedNotAvailable() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), Map.of("term", "cat"), ContentVersionStatus.DRAFT);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_NOT_PUBLISHED", ex.code());
    }

    @Test
    @DisplayName("missing rights block projection")
    void missingRightsBlockProjection() {
        ContentVersion version = publishedVersion(null, Map.of("term", "cat"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_RIGHTS_NOT_READY", ex.code());
    }

    @Test
    @DisplayName("rights that do not allow the channel block projection")
    void channelNotAllowedBlocksProjection() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("LEARNER")), Map.of("term", "cat"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_RIGHTS_NOT_READY", ex.code());
    }

    @Test
    @DisplayName("assessment snapshot returns answer rules for a published question")
    void assessmentSnapshotReturnsAnswerRules() {
        Map<String, Object> fields = Map.of(
                "prompt", "choose", "options", List.of("A", "B"),
                "answerRule", Map.of("correctOption", "A"),
                GradableQuestions.SEAL_FIELD, STORED_SEAL);
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("ASSESSMENT", "PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        AssessmentContentSnapshot snapshot = ContentProjectionPolicy.assessmentSnapshot(
                content, version, ContentChannel.ASSESSMENT, NOW);
        assertTrue(snapshot.answerRules().containsKey("correctOption"));
        assertFalse(snapshot.learnerFields().containsKey("answerRule"));
        assertFalse(hasKey(snapshot.learnerFields(), GradableQuestions.SEAL_FIELD));
        assertFalse(hasKey(snapshot.answerRules(), GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(snapshot.learnerFields()).contains(STORED_SEAL));
        assertFalse(String.valueOf(snapshot.answerRules()).contains(STORED_SEAL));
        assertNotEquals(STORED_SEAL, snapshot.contentHash());
    }

    @Test
    @DisplayName("assessment snapshot rejects content with no answer rule")
    void assessmentSnapshotRequiresAnswerRule() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("ASSESSMENT")), Map.of("prompt", "choose"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.assessmentSnapshot(content, version, ContentChannel.ASSESSMENT, NOW));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("isAnswerRuleKey detects known keys and case-insensitive substrings")
    void isAnswerRuleKeyDetectsVariants() {
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("answerRule"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("AnswerRule"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("myanswerrulefield"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("correctAnswer"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("scoringRule"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey("title"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey("options"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey(null));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey(GradableQuestions.SEAL_FIELD));
    }

    @Test
    @DisplayName("answer rule leak is blocked even on a poisoned projection path")
    void assessmentLeakBlockedForAnswerRulesKey() {
        // A key containing the substring but not in the explicit list must still be detected.
        Map<String, Object> fields = Map.of("prompt", "x", "expectedAnswer", Map.of("value", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.fields().containsKey("expectedAnswer"));
        assertEquals(null, projection.fields().get("expectedAnswer"));
    }

    @Test
    @DisplayName("public and learner projections omit the top-level opt-in and legacy answer keys")
    void publicAndLearnerOmitOptInAnswers() {
        Map<String, Object> fields = optInPayload();
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC", "LEARNER")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        for (ContentAudience audience : List.of(ContentAudience.PUBLIC, ContentAudience.LEARNER)) {
            ContentChannel channel = audience == ContentAudience.PUBLIC
                    ? ContentChannel.PUBLIC : ContentChannel.LEARNER;
            PublicContentProjection projection = ContentProjectionPolicy.project(
                    content, version, audience, channel, NOW, false);
            assertFalse(projection.fields().containsKey("gradableQuestions"), audience.name());
            assertFalse(projection.fields().containsKey(GradableQuestions.SEAL_FIELD), audience.name());
            assertFalse(hasKey(projection.fields(), GradableQuestions.SEAL_FIELD), audience.name());
            assertFalse(String.valueOf(projection.fields()).contains(STORED_SEAL), audience.name());
            assertNotEquals(STORED_SEAL, projection.contentHash(), audience.name());
            assertFalse(projection.containsAnswerRules(), audience.name());
            assertFalse(hasKey(projection.fields(), "answerRule"), audience.name());
            assertFalse(hasKey(projection.fields(), "correctOption"), audience.name());
            assertEquals("choose", projection.fields().get("prompt"));
            Map<?, ?> item = (Map<?, ?>) ((List<?>) projection.fields().get("items")).getFirst();
            assertEquals("Visible", item.get("displayText"));
            assertTrue(item.containsKey("gradableQuestions"), audience.name());
            assertFalse(item.containsKey("answerRule"), audience.name());
            Map<?, ?> nested = (Map<?, ?>) ((List<?>) item.get("gradableQuestions")).getFirst();
            assertEquals("Choose", nested.get("stem"));
            assertFalse(nested.containsKey("answerRule"));
        }
    }

    @Test
    @DisplayName("admin preview omits the top-level opt-in and keeps the legacy payload")
    void adminPreviewRedactsOptInAnswersOnly() {
        Map<String, Object> legacy = Map.of("term", "cat", "answerRule", Map.of("correctOption", "A"));
        ContentVersion legacyVersion = publishedVersion(
                publishableRights(Set.of("PUBLIC")), legacy, ContentVersionStatus.PUBLISHED);
        PublicContentProjection unchanged = ContentProjectionPolicy.project(
                definitionWith(legacyVersion), legacyVersion, ContentAudience.ADMIN_PREVIEW,
                ContentChannel.ADMIN, NOW, false);
        assertEquals(legacyVersion.payload().raw(), unchanged.fields());
        assertTrue(unchanged.fields().containsKey("answerRule"));
        assertFalse(unchanged.fields().containsKey(GradableQuestions.SEAL_FIELD));

        Map<String, Object> fields = optInPayload();
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        PublicContentProjection preview = ContentProjectionPolicy.project(
                definitionWith(version), version, ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN, NOW, false);
        Map<String, Object> expected = new LinkedHashMap<>(version.payload().raw());
        expected.remove("gradableQuestions");
        expected.remove(GradableQuestions.SEAL_FIELD);
        assertEquals(expected, preview.fields());
        assertFalse(preview.fields().containsKey("gradableQuestions"));
        assertFalse(preview.fields().containsKey(GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(preview.fields()).contains(STORED_SEAL));
        assertEquals(version.payload().raw().get("answerRule"), preview.fields().get("answerRule"));
        assertEquals(version.payload().raw().get("items"), preview.fields().get("items"));
        assertEquals("legacy", ((Map<?, ?>) preview.fields().get("answerRule")).get("correctOption"));
        assertTrue(hasKey(version.payload().raw().get("gradableQuestions"), "correctOption"));
        assertEquals("beta", ((Map<?, ?>) ((Map<?, ?>) ((List<?>) version.payload().raw()
                .get("gradableQuestions")).getFirst()).get("answerRule")).get("correctOption"));

        Map<String, Object> malformed = new LinkedHashMap<>();
        malformed.put("term", "cat");
        malformed.put("gradableQuestions", List.of(Map.of("answerRule", Map.of("correctOption", "secret"))));
        malformed.put("answerRule", Map.of("correctOption", "A"));
        ContentVersion malformedVersion = publishedVersion(
                publishableRights(Set.of("PUBLIC")), malformed, ContentVersionStatus.PUBLISHED);
        PublicContentProjection hidden = ContentProjectionPolicy.project(
                definitionWith(malformedVersion), malformedVersion, ContentAudience.ADMIN_PREVIEW,
                ContentChannel.ADMIN, NOW, false);
        Map<String, Object> malformedExpected = new LinkedHashMap<>(malformedVersion.payload().raw());
        malformedExpected.remove("gradableQuestions");
        assertEquals(malformedExpected, hidden.fields());
        assertFalse(hidden.fields().containsKey("gradableQuestions"));
        assertFalse(hidden.fields().containsKey(GradableQuestions.SEAL_FIELD));
        assertEquals("A", ((Map<?, ?>) hidden.fields().get("answerRule")).get("correctOption"));
        assertFalse(String.valueOf(hidden.fields()).contains("secret"));
    }

    @Test
    @DisplayName("assessment snapshot does not read the opt-in answer")
    void assessmentSnapshotIgnoresOptInAnswers() {
        Map<String, Object> fields = optInPayload();
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("ASSESSMENT", "PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        AssessmentContentSnapshot snapshot = ContentProjectionPolicy.assessmentSnapshot(
                content, version, ContentChannel.ASSESSMENT, NOW);
        assertEquals("legacy", snapshot.answerRules().get("correctOption"));
        assertFalse(snapshot.answerRules().containsKey("itemId"));
        assertFalse(snapshot.learnerFields().containsKey("gradableQuestions"));
        assertFalse(snapshot.learnerFields().containsKey(GradableQuestions.SEAL_FIELD));
        assertFalse(snapshot.learnerFields().containsKey("answerRule"));
        assertFalse(hasKey(snapshot.learnerFields(), "correctOption"));
        assertFalse(hasKey(snapshot.learnerFields(), GradableQuestions.SEAL_FIELD));
        assertFalse(hasKey(snapshot.answerRules(), GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(snapshot.learnerFields()).contains(STORED_SEAL));
        assertFalse(String.valueOf(snapshot.answerRules()).contains(STORED_SEAL));
        assertNotEquals(STORED_SEAL, snapshot.contentHash());

        ContentVersion optInOnly = publishedVersion(
                publishableRights(Set.of("ASSESSMENT")), Map.of(
                        "prompt", "choose",
                        "gradableQuestions", List.of(closedQuestion()),
                        GradableQuestions.SEAL_FIELD, STORED_SEAL),
                ContentVersionStatus.PUBLISHED);
        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.assessmentSnapshot(
                        definitionWith(optInOnly), optInOnly, ContentChannel.ASSESSMENT, NOW));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", missing.code());
        assertFalse(missing.getMessage().contains(STORED_SEAL));
    }

    @Test
    @DisplayName("public, learner, admin preview, and assessment omit the owner article")
    void publicLearnerAdminAndAssessmentOmitTheOwnerArticle() {
        Map<String, Object> plain = new LinkedHashMap<>();
        plain.put("title", "Visible title");
        plain.put("blocks", List.of(Map.of("text", "visible block")));
        ContentVersion plainVersion = publishedVersion(
                publishableRights(Set.of("PUBLIC")), plain, ContentVersionStatus.PUBLISHED);
        PublicContentProjection unchanged = ContentProjectionPolicy.project(
                definitionWith(plainVersion), plainVersion, ContentAudience.ADMIN_PREVIEW,
                ContentChannel.ADMIN, NOW, false);
        assertEquals(plainVersion.payload().raw(), unchanged.fields());

        Map<String, Object> nestedBlock = new LinkedHashMap<>();
        nestedBlock.put("text", "nested-article-legacy");
        Map<String, Object> nestedArticle = new LinkedHashMap<>();
        nestedArticle.put("articleId", 42);
        nestedArticle.put("blocks", List.of(nestedBlock));
        nestedArticle.put("rightsStatus", "NESTED_RIGHTS");
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("displayText", "Visible");
        item.put("readingArticle", nestedArticle);
        item.put("gradableQuestions", List.of(closedQuestion()));
        Map<String, Object> ownerBlock = new LinkedHashMap<>();
        ownerBlock.put("blockId", "block-1");
        ownerBlock.put("blockIndex", 0);
        ownerBlock.put("text", "top-article-secret");
        ownerBlock.put("translation", "top-article-translation");
        Map<String, Object> owner = new LinkedHashMap<>();
        owner.put("articleId", 8L);
        owner.put("title", "Exact article title");
        owner.put("cefrLevel", "B1");
        owner.put("wordCount", 2);
        owner.put("rightsStatus", "SECRET_RIGHTS_FLAG");
        owner.put("estimatedMinutes", 9);
        owner.put("blocks", List.of(ownerBlock));
        owner.put("answerRule", Map.of("correctOption", "top-article-secret"));
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("title", "Visible title");
        fields.put("blocks", List.of(Map.of("text", "visible block")));
        fields.put("prompt", "choose");
        fields.put("items", List.of(item));
        fields.put("answerRule", Map.of("correctOption", "legacy-option"));
        fields.put("gradableQuestions", List.of(closedQuestion()));
        fields.put(GradableQuestions.SEAL_FIELD, STORED_SEAL);
        fields.put("readingArticle", owner);
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC", "LEARNER", "ASSESSMENT")),
                fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        for (ContentAudience audience : List.of(ContentAudience.PUBLIC, ContentAudience.LEARNER)) {
            ContentChannel channel = audience == ContentAudience.PUBLIC
                    ? ContentChannel.PUBLIC : ContentChannel.LEARNER;
            PublicContentProjection projection = ContentProjectionPolicy.project(
                    content, version, audience, channel, NOW, false);
            assertFalse(projection.fields().containsKey("readingArticle"), audience.name());
            assertFalse(projection.fields().containsKey("gradableQuestions"), audience.name());
            assertFalse(projection.fields().containsKey(GradableQuestions.SEAL_FIELD), audience.name());
            assertFalse(hasKey(projection.fields(), "answerRule"), audience.name());
            assertFalse(hasKey(projection.fields(), "correctOption"), audience.name());
            assertFalse(String.valueOf(projection.fields()).contains("top-article-secret"), audience.name());
            assertFalse(String.valueOf(projection.fields()).contains("SECRET_RIGHTS_FLAG"), audience.name());
            assertFalse(String.valueOf(projection.fields()).contains(STORED_SEAL), audience.name());
            assertEquals("Visible title", projection.fields().get("title"), audience.name());
            assertEquals("visible block",
                    ((Map<?, ?>) ((List<?>) projection.fields().get("blocks")).getFirst()).get("text"),
                    audience.name());
            Map<?, ?> shown = (Map<?, ?>) ((List<?>) projection.fields().get("items")).getFirst();
            assertEquals("Visible", shown.get("displayText"), audience.name());
            assertTrue(shown.containsKey("readingArticle"), audience.name());
            Map<?, ?> shownArticle = (Map<?, ?>) shown.get("readingArticle");
            assertEquals("nested-article-legacy",
                    ((Map<?, ?>) ((List<?>) shownArticle.get("blocks")).getFirst()).get("text"), audience.name());
            assertEquals("NESTED_RIGHTS", shownArticle.get("rightsStatus"), audience.name());
            assertTrue(shown.containsKey("gradableQuestions"), audience.name());
            assertFalse(((Map<?, ?>) ((List<?>) shown.get("gradableQuestions")).getFirst()).containsKey("answerRule"),
                    audience.name());
        }

        PublicContentProjection preview = ContentProjectionPolicy.project(
                content, version, ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN, NOW, false);
        Map<String, Object> expected = new LinkedHashMap<>(version.payload().raw());
        expected.remove("readingArticle");
        expected.remove("gradableQuestions");
        expected.remove(GradableQuestions.SEAL_FIELD);
        assertEquals(expected, preview.fields());
        assertFalse(preview.fields().containsKey("readingArticle"));
        assertFalse(String.valueOf(preview.fields()).contains("top-article-secret"));
        assertFalse(String.valueOf(preview.fields()).contains("SECRET_RIGHTS_FLAG"));
        assertFalse(String.valueOf(preview.fields()).contains(STORED_SEAL));
        assertEquals("legacy-option", ((Map<?, ?>) preview.fields().get("answerRule")).get("correctOption"));
        assertEquals("Visible title", preview.fields().get("title"));
        assertEquals("visible block",
                ((Map<?, ?>) ((List<?>) preview.fields().get("blocks")).getFirst()).get("text"));
        Map<?, ?> adminItem = (Map<?, ?>) ((List<?>) preview.fields().get("items")).getFirst();
        assertTrue(adminItem.containsKey("readingArticle"));
        assertEquals("nested-article-legacy", ((Map<?, ?>) ((List<?>) ((Map<?, ?>) adminItem.get("readingArticle"))
                .get("blocks")).getFirst()).get("text"));
        assertEquals(version.payload().raw().get("items"), preview.fields().get("items"));

        AssessmentContentSnapshot snapshot = ContentProjectionPolicy.assessmentSnapshot(
                content, version, ContentChannel.ASSESSMENT, NOW);
        assertEquals("legacy-option", snapshot.answerRules().get("correctOption"));
        assertFalse(snapshot.learnerFields().containsKey("readingArticle"));
        assertFalse(snapshot.learnerFields().containsKey("gradableQuestions"));
        assertFalse(snapshot.learnerFields().containsKey(GradableQuestions.SEAL_FIELD));
        assertFalse(hasKey(snapshot.learnerFields(), "correctOption"));
        assertFalse(String.valueOf(snapshot.learnerFields()).contains("top-article-secret"));
        assertFalse(String.valueOf(snapshot.answerRules()).contains("top-article-secret"));
        assertFalse(String.valueOf(snapshot.learnerFields()).contains("SECRET_RIGHTS_FLAG"));
        assertEquals("visible block",
                ((Map<?, ?>) ((List<?>) snapshot.learnerFields().get("blocks")).getFirst()).get("text"));
        Map<?, ?> learnerItem = (Map<?, ?>) ((List<?>) snapshot.learnerFields().get("items")).getFirst();
        assertTrue(learnerItem.containsKey("readingArticle"));
        assertEquals("nested-article-legacy", ((Map<?, ?>) ((List<?>) ((Map<?, ?>) learnerItem.get("readingArticle"))
                .get("blocks")).getFirst()).get("text"));

        Map<String, Object> articleOnly = new LinkedHashMap<>();
        articleOnly.put("prompt", "choose");
        articleOnly.put("readingArticle", owner);
        ContentVersion hidden = publishedVersion(
                publishableRights(Set.of("ASSESSMENT")), articleOnly, ContentVersionStatus.PUBLISHED);
        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.assessmentSnapshot(
                        definitionWith(hidden), hidden, ContentChannel.ASSESSMENT, NOW));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", missing.code());
        assertFalse(missing.getMessage().contains("top-article-secret"));
    }

    private static Map<String, Object> optInPayload() {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("displayText", "Visible");
        item.put("gradableQuestions", List.of(closedQuestion()));
        item.put("answerRule", Map.of("correctOption", "nested"));
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("gradableQuestions", List.of(closedQuestion()));
        fields.put(GradableQuestions.SEAL_FIELD, STORED_SEAL);
        fields.put("prompt", "choose");
        fields.put("items", List.of(item));
        fields.put("answerRule", Map.of("correctOption", "legacy"));
        return fields;
    }

    private static Map<String, Object> closedQuestion() {
        Map<String, Object> alpha = new LinkedHashMap<>();
        alpha.put("optionId", "alpha");
        alpha.put("label", "Aye");
        Map<String, Object> beta = new LinkedHashMap<>();
        beta.put("optionId", "beta");
        beta.put("label", "Bee");
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("itemId", 4);
        question.put("stem", "Choose");
        question.put("options", List.of(beta, alpha));
        question.put("answerRule", Map.of("correctOption", "beta"));
        return question;
    }

    private static boolean hasKey(Object node, String key) {
        if (node instanceof Map<?, ?> map) {
            if (map.containsKey(key)) {
                return true;
            }
            for (Object value : map.values()) {
                if (hasKey(value, key)) {
                    return true;
                }
            }
        } else if (node instanceof List<?> list) {
            for (Object item : list) {
                if (hasKey(item, key)) {
                    return true;
                }
            }
        }
        return false;
    }
}
