package com.englishflow.content.web;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.GradableQuestions;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Service-boundary tests: draft input never establishes copyright authority. */
class B9ContentAdminRightsBoundaryTest {

    private static final String CODE = "rights-boundary-pack";
    private static final HttpHeaders HEADERS = new HttpHeaders();

    private InMemoryContentRepository repository;
    private InMemoryContentOutbox outbox;
    private InMemoryValidationReportStore reports;
    private B9ContentAdminController controller;

    @BeforeEach
    void setUp() {
        repository = new InMemoryContentRepository();
        outbox = new InMemoryContentOutbox();
        reports = new InMemoryValidationReportStore();
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        ContentCommandService commands = new ContentCommandService(
                repository, outbox, idempotency,
                new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(),
                reports, Clock.systemUTC());
        controller = new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), mock(ScheduledPublishService.class),
                repository, new VerifiedContentPrincipalFactory(), idempotency, reports);
    }

    @Test
    void createAndSaveKeepRealSourceAndLicensePendingDespiteClientAuthorityFields() {
        Map<String, Object> draft = draft();
        draft.put("copyrightStatus", "ACTIVE");
        draft.put("allowsLearning", true);
        draft.put("permittedChannels", List.of("LEARNER", "PUBLIC"));
        draft.put("authorizationEvidenceRef", "client-claimed-evidence");
        command("CREATE_DRAFT", CODE, draft, editor(), "create-draft-rights-1");

        assertPendingRights(latest());
        assertEquals("SOURCE-ONE", latest().rights().orElseThrow().sourceCode());
        assertEquals("LICENSE-ONE", latest().rights().orElseThrow().licenseCode());

        Map<String, Object> revision = draft();
        revision.put("sourceCode", "SOURCE-TWO");
        revision.put("licenseCode", "LICENSE-TWO");
        revision.put("copyrightStatus", "ACTIVE");
        revision.put("authorizationEvidenceRef", "another-client-claim");
        command("SAVE_DRAFT", CODE, revision, editor(), "save-draft-rights-1");

        assertEquals(2, content().versions().size());
        assertPendingRights(latest());
        assertEquals("SOURCE-TWO", latest().rights().orElseThrow().sourceCode());
        assertEquals("LICENSE-TWO", latest().rights().orElseThrow().licenseCode());
    }

    @Test
    void missingRightsFieldsRejectCreateBeforeAnyDefinitionIsWritten() {
        for (String field : List.of("sourceCode", "licenseCode")) {
            Map<String, Object> incomplete = draft();
            incomplete.remove(field);
            String code = CODE + "-" + field;
            ContentOperationException error = assertThrows(ContentOperationException.class,
                    () -> command("CREATE_DRAFT", code, incomplete, editor(), "missing-" + field));
            assertEquals(400, error.status());
            assertEquals("CONTENT_FIELD_REQUIRED", error.code());
            assertTrue(repository.findByCode(code).isEmpty(), "invalid draft must leave no content definition");
        }
    }

    @Test
    void unauthorizedReviewAndReleaseCommandsRejectBeforeLookingUpContent() {
        for (String operation : List.of("REVIEW_FIRST", "REVIEW_FINAL", "PUBLISH", "UNPUBLISH", "ROLLBACK")) {
            String missingCode = "missing-" + operation.toLowerCase();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("command", operation);
            body.put("contentCode", missingCode);
            body.put("expectedStateVersion", 0);
            body.put("reviewDecision", "APPROVED");
            ContentOperationException denied = assertThrows(ContentOperationException.class,
                    () -> controller.command(body, actor("learner-1", "learner.profile.read"),
                            "unauthorized-" + operation, HEADERS), operation);
            assertEquals(403, denied.status(), operation);
            assertTrue(repository.findByCode(missingCode).isEmpty());
        }
    }

    @Test
    void saveWithoutLicenseDoesNotAppendARevision() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "create-draft-before-save");
        Map<String, Object> incomplete = draft();
        incomplete.put("licenseCode", " ");

        ContentOperationException error = assertThrows(ContentOperationException.class,
                () -> command("SAVE_DRAFT", CODE, incomplete, editor(), "save-without-license"));
        assertEquals("CONTENT_FIELD_REQUIRED", error.code());
        assertEquals(1, content().versions().size());
    }

    @Test
    void pendingRightsBlockReviewSubmissionAndKeepTheDraftUnchanged() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "create-draft-review");
        long revision = content().stateVersion();
        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals(false, state.get("reviewSubmissionReady"));
        assertEquals("RIGHTS_NOT_READY", state.get("reviewSubmissionReason"));

        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", CODE, null, editor(), "submit-draft-review"));
        assertEquals(409, blocked.status());
        assertEquals("CONTENT_RIGHTS_NOT_READY", blocked.code());
        assertEquals(ContentVersionStatus.DRAFT, latest().status());
        assertEquals(revision, content().stateVersion());
        assertEquals(0L, outbox.countByType("content.version.submitted.v1"));
        assertTrue(content().currentPublishedVersionId().isEmpty());
    }

    @Test
    void activeRightsAloneCannotReplaceVersionBoundPassAndMediaFacts() {
        ContentDefinition content = ContentDefinition.create(
                ContentId.of(CODE), "platform", CODE, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        content.addDraft(ContentVersionId.of(1L), draft(), new ContentRights(
                        "SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.ACTIVE, true,
                        Set.of("LEARNER", "PUBLIC"), null, null, "owner-evidence-1"),
                "editor-1", "draft", Instant.now());
        repository.create(content);

        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals("VALID", state.get("rightsStatus"));
        assertEquals(false, state.get("reviewSubmissionReady"));
        assertEquals("VALIDATION_REPORT_UNAVAILABLE", state.get("reviewSubmissionReason"));
        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", CODE, null, editor(), "active-rights-alone"));
        assertEquals("CONTENT_REVIEW_EVIDENCE_UNAVAILABLE", blocked.code());
        assertEquals(ContentVersionStatus.DRAFT, latest().status());
        assertEquals(0L, outbox.countByType("content.version.submitted.v1"));
    }

    @Test
    void existingInReviewStillRequiresExplicitDecisionsAndPublicationRights() {
        ContentDefinition content = ContentDefinition.create(
                ContentId.of(CODE), "platform", CODE, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        ContentVersion legacyReview = content.addDraft(ContentVersionId.of(1001L), draft(),
                new ContentRights("SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.PENDING,
                        false, Set.of(), null, null, null),
                "editor-1", "legacy review", Instant.now());
        legacyReview.submitForReview("editor-1");
        repository.create(content);

        assertMissingDecision("REVIEW_FIRST", firstReviewer(), "first-without-decision");
        assertEquals(ContentVersionStatus.IN_REVIEW, latest().status());
        command("REVIEW_FIRST", CODE, null, firstReviewer(), "first-approved", "APPROVED");

        assertMissingDecision("REVIEW_FINAL", finalReviewer(), "final-without-decision");
        assertEquals(ContentVersionStatus.APPROVED, latest().status());
        assertTrue(latest().finalReviewer().isEmpty());
        command("REVIEW_FINAL", CODE, null, finalReviewer(), "final-approved", "APPROVED");

        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", CODE, null, publisher(), "publish-with-pending-rights"));
        assertEquals("CONTENT_RIGHTS_NOT_READY", blocked.code());
        assertTrue(content().currentPublishedVersionId().isEmpty());
    }

    @Test
    void emptyAutoValidationReturnsFindingsAndDoesNotInventRights() {
        Map<String, Object> empty = data(controller.validateAuto(Map.of(), editor(), "validate-empty-1", HEADERS).getBody());
        assertEquals(false, empty.get("passed"));
        assertFinding(empty, "RIGHTS_MISSING");
        assertFinding(empty, "STRUCTURE_INCOMPLETE");

        Map<String, Object> pending = data(controller.validateAuto(
                Map.of("content", draft()), editor(), "validate-draft-1", HEADERS).getBody());
        assertEquals(false, pending.get("passed"));
        assertFinding(pending, "RIGHTS_EVIDENCE_MISSING");
        assertFinding(pending, "RIGHTS_LEARNING_DENIED");
    }

    @Test
    void autoValidationReplaysTheOriginalReportAndRejectsChangedDraftUnderTheSameKey() {
        Map<String, Object> firstBody = Map.of("content", draft());
        Map<String, Object> first = data(controller.validateAuto(
                firstBody, editor(), "validate-replay-1", HEADERS).getBody());
        Map<String, Object> replay = data(controller.validateAuto(
                firstBody, editor(), "validate-replay-1", HEADERS).getBody());
        assertEquals(first, replay);

        Map<String, Object> changed = new LinkedHashMap<>(draft());
        changed.put("title", "different draft");
        ContentOperationException conflict = assertThrows(ContentOperationException.class,
                () -> controller.validateAuto(Map.of("content", changed), editor(),
                        "validate-replay-1", HEADERS));
        assertEquals(409, conflict.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", conflict.code());

        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> controller.validateAuto(firstBody, editor(), null, HEADERS));
        assertEquals(400, missing.status());
        assertEquals("IDEMPOTENCY_KEY_REQUIRED", missing.code());
    }

    @Test
    void batchImportWithoutLicenseFailsWithoutCreatingAPartialDefinition() {
        Map<String, Object> incomplete = draft();
        incomplete.remove("licenseCode");
        Map<String, Object> row = Map.of("contentCode", CODE, "content", incomplete);
        Map<String, Object> result = data(controller.importBatch(
                Map.of("items", List.of(row)), editor(), "batch-missing-rights-1", HEADERS).getBody());
        assertEquals(1L, result.get("failed"));
        assertEquals("CONTENT_FIELD_REQUIRED", ((Map<?, ?>) ((List<?>) result.get("items")).getFirst()).get("errorCode"));
        assertTrue(repository.findByCode(CODE).isEmpty());
    }

    @Test
    void absentGradableQuestionsKeepLegacyPayloadBytes() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "legacy-create-draft");
        assertLegacyPayload(latest());
        Map<String, Object> revision = draft();
        revision.put("summary", "Revised summary");
        command("SAVE_DRAFT", CODE, revision, editor(), "legacy-save-draft");

        assertEquals(2, content().versions().size());
        ContentVersion first = content().versions().getFirst();
        ContentVersion second = latest();
        assertLegacyPayload(first);
        assertEquals("", first.payload().raw().get("summary"));
        assertLegacyPayload(second);
        assertEquals("Revised summary", second.payload().raw().get("summary"));
        assertNotEquals(first.contentHash(), second.contentHash());
        assertEquals(ContentPayloadHash.sha256(first.payload().raw()), first.contentHash());
        Map<String, Object> editorDraft = editorDraft(CODE);
        assertSame(second.payload().raw(), editorDraft.get("payload"));
    }

    @Test
    void optedInVersionsKeepOrderHashAndImmutability() {
        String code = "gradable-versions";
        command("CREATE_DRAFT", code, questionsDraft(List.of(
                question(20, "  Second stem  ", List.of(option("beta", "  Bee  "), option("alpha", "Aye")), "beta"),
                question(10L, "First stem", List.of(option("alpha", "Aye"), option("beta", "Bee")), "alpha"))),
                editor(), "gradable-version-create");
        ContentVersion first = version(code, 0);
        assertPendingRights(first);
        assertQuestionOrder(first, List.of(20L, 10L), List.of("beta", "alpha"));
        assertEquals("  Second stem  ", question(first, 0).get("stem"));
        assertEquals("  Bee  ", option(first, 0, 0).get("label"));
        assertEquals("Read this sentence.",
                ((Map<?, ?>) ((List<?>) first.payload().raw().get("items")).getFirst()).get("displayText"));
        assertEquals(ContentPayloadHash.sha256(first.payload().raw()), first.contentHash());
        long firstId = first.versionId().value();
        String firstHash = first.contentHash();
        Map<String, Object> firstPayload = first.payload().raw();
        String firstSeal = seal(first);

        String token = "a" + "b".repeat(63);
        List<Map<String, Object>> eight = new ArrayList<>();
        eight.add(option(token, "L".repeat(512)));
        for (int index = 1; index < 8; index++) {
            eight.add(option("o" + index, "Label " + index));
        }
        command("SAVE_DRAFT", code, questionsDraft(List.of(
                question(9007199254740991L, "q".repeat(4096), eight, token),
                question(1, "Floor", List.of(option("m", "Em"), option("n", "En")), "n"))),
                editor(), "gradable-version-save");
        ContentVersion second = version(code, 1);
        assertSame(firstPayload, version(code, 0).payload().raw());
        assertEquals(firstId, version(code, 0).versionId().value());
        assertEquals(firstHash, version(code, 0).contentHash());
        assertNotEquals(firstHash, second.contentHash());
        assertEquals(ContentPayloadHash.sha256(second.payload().raw()), second.contentHash());
        assertQuestionOrder(second, List.of(9007199254740991L, 1L), List.of(token, "m"));
        assertEquals(4096, question(second, 0).get("stem").toString().length());
        assertEquals(8, ((List<?>) question(second, 0).get("options")).size());
        assertEquals(64, option(second, 0, 0).get("optionId").toString().length());
        assertEquals(512, option(second, 0, 0).get("label").toString().length());
        String secondSeal = seal(second);
        Map<String, Object> secondPayload = second.payload().raw();
        assertNotEquals(firstSeal, secondSeal);
        assertEquals(firstSeal, seal(version(code, 0)));
        assertSame(firstPayload, version(code, 0).payload().raw());

        command("SAVE_DRAFT", code, draft(), editor(), "gradable-version-clear");
        ContentVersion third = version(code, 2);
        assertLegacyPayload(third);
        assertSame(firstPayload, version(code, 0).payload().raw());
        assertSame(secondPayload, version(code, 1).payload().raw());
        assertEquals(firstSeal, seal(version(code, 0)));
        assertEquals(secondSeal, seal(version(code, 1)));
        assertEquals(second.contentHash(), version(code, 1).contentHash());
        assertNotEquals(second.contentHash(), third.contentHash());

        String legacyCode = "b109-unsealed";
        ContentDefinition legacyOwner = ContentDefinition.create(
                ContentId.of(legacyCode), "platform", legacyCode, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        Map<String, Object> legacyFields = new LinkedHashMap<>();
        legacyFields.put("summary", "");
        legacyFields.put("contentLocale", "en-US");
        legacyFields.put("targetLevel", "A1");
        legacyFields.put("items", List.of(Map.of("displayText", "Read this sentence.")));
        legacyFields.put("gradableQuestions", List.of(question(4, "Stem", twoOptions(), "alpha")));
        legacyOwner.addDraft(ContentVersionId.of(1L), legacyFields, new ContentRights(
                        "SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.PENDING,
                        false, Set.of(), null, null, null),
                "editor-1", "draft", Instant.now());
        repository.create(legacyOwner);
        Map<String, Object> unmarked = version(legacyCode, 0).payload().raw();
        assertFalse(unmarked.containsKey(GradableQuestions.SEAL_FIELD));
        assertFalse(hasKey(editorDraft(legacyCode), GradableQuestions.SEAL_FIELD));
        assertSame(unmarked, version(legacyCode, 0).payload().raw());
        command("SAVE_DRAFT", legacyCode, questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))),
                editor(), "b109-unsealed-save");
        assertSame(unmarked, version(legacyCode, 0).payload().raw());
        assertFalse(version(legacyCode, 0).payload().raw().containsKey(GradableQuestions.SEAL_FIELD));
        String born = seal(version(legacyCode, 1));
        assertFalse(hasKey(editorDraft(legacyCode), GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(editorDraft(legacyCode)).contains(born));
    }

    @Test
    void optedInIdempotencyReplaysAndRejectsAChangedBody() {
        String code = "gradable-idem";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", "CREATE_DRAFT");
        body.put("contentCode", code);
        body.put("expectedStateVersion", 0);
        body.put("content", questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))));
        Map<String, Object> created = data(controller.command(body, editor(), "gradable-idem-key-1", HEADERS).getBody());
        ContentVersion createdVersion = repository.findByCode(code).orElseThrow().versions().getFirst();
        String createdSeal = seal(createdVersion);
        Map<String, Object> createdPayload = createdVersion.payload().raw();
        Map<String, Object> replay = data(controller.command(body, editor(), "gradable-idem-key-1", HEADERS).getBody());
        assertEquals(created, replay);
        assertEquals(1, repository.findByCode(code).orElseThrow().versions().size());
        assertSame(createdPayload, version(code, 0).payload().raw());
        assertEquals(createdSeal, seal(version(code, 0)));
        assertFalse(hasKey(created, GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(created).contains(createdSeal));

        Map<String, Object> changed = new LinkedHashMap<>(body);
        changed.put("content", questionsDraft(List.of(question(4, "Other stem", twoOptions(), "alpha"))));
        ContentOperationException conflict = assertThrows(ContentOperationException.class,
                () -> controller.command(changed, editor(), "gradable-idem-key-1", HEADERS));
        assertEquals(409, conflict.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", conflict.code());
        ContentVersion stored = repository.findByCode(code).orElseThrow().versions().getFirst();
        assertEquals(1, repository.findByCode(code).orElseThrow().versions().size());
        assertEquals("Stem", question(stored, 0).get("stem"));
        assertEquals("alpha", ((Map<?, ?>) question(stored, 0).get("answerRule")).get("correctOption"));
        assertEquals(createdSeal, seal(stored));
        assertSame(createdPayload, stored.payload().raw());

        command("SAVE_DRAFT", code, questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))),
                editor(), "gradable-idem-save");
        assertSame(createdPayload, version(code, 0).payload().raw());
        assertEquals(createdSeal, seal(version(code, 0)));
        assertNotEquals(createdSeal, seal(version(code, 1)));
    }

    @Test
    void malformedGradableQuestionsAreNotWritten() {
        Map<String, Object> nullReport = data(controller.validateAuto(
                Map.of("content", questionsDraft(null)), editor(), "validate-null-questions", HEADERS).getBody());
        assertEquals(false, nullReport.get("passed"));
        assertFinding(nullReport, "GRADABLE_QUESTIONS_INVALID");
        assertNoFinding(nullReport, "ANSWER_LEAK_DETECTED");
        Map<String, Object> openReport = data(controller.validateAuto(
                Map.of("content", questionsDraft(List.of(Map.of("answerRule", Map.of("correctOption", "alpha"))))),
                editor(), "validate-open-questions", HEADERS).getBody());
        assertFinding(openReport, "GRADABLE_QUESTIONS_INVALID");
        assertFinding(openReport, "ANSWER_LEAK_DETECTED");
        assertTrue(repository.findByCode(CODE).isEmpty());

        assertQuestionsRejected("null", null);
        assertQuestionsRejected("empty", List.of());
        assertQuestionsRejected("object", Map.of("itemId", 1));
        List<Object> nullRow = new ArrayList<>();
        nullRow.add(null);
        assertQuestionsRejected("null-row", nullRow);
        assertQuestionsRejected("string-row", List.of("question"));
        assertQuestionsRejected("string-id", List.of(question("12", "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("leading-zero", List.of(question("01", "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("float-id", List.of(question(1.0d, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("fraction", List.of(question(1.5d, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("decimal", List.of(question(new BigDecimal("1.0"), "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("integral-decimal", List.of(question(new BigDecimal("1"), "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("bool-id", List.of(question(true, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("zero", List.of(question(0, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("negative", List.of(question(-1, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("too-big", List.of(question(9007199254740992L, "Stem", twoOptions(), "alpha")));
        assertQuestionsRejected("duplicate-item", List.of(
                question(4, "One", twoOptions(), "alpha"), question(4L, "Two", twoOptions(), "beta")));
        assertQuestionsRejected("duplicate-option", List.of(question(4, "Stem",
                List.of(option("alpha", "Aye"), option("alpha", "Bee")), "alpha")));
        assertQuestionsRejected("one-option", List.of(question(4, "Stem", List.of(option("alpha", "Aye")), "alpha")));
        List<Map<String, Object>> nine = new ArrayList<>();
        for (int index = 0; index < 9; index++) {
            nine.add(option("o" + index, "Label " + index));
        }
        assertQuestionsRejected("nine-options", List.of(question(4, "Stem", nine, "o0")));
        assertQuestionsRejected("wrong-member", List.of(question(4, "Stem", twoOptions(), "gamma")));
        assertQuestionsRejected("case-answer", List.of(question(4, "Stem", twoOptions(), "Alpha")));
        assertQuestionsRejected("upper-option", List.of(question(4, "Stem",
                List.of(option("Alpha", "Aye"), option("beta", "Bee")), "Alpha")));
        assertQuestionsRejected("spaced-answer", List.of(question(4, "Stem", twoOptions(), "alpha ")));
        assertQuestionsRejected("blank-stem", List.of(question(4, " \n", twoOptions(), "alpha")));
        assertQuestionsRejected("blank-label", List.of(question(4, "Stem",
                List.of(option("alpha", " "), option("beta", "Bee")), "alpha")));
        assertQuestionsRejected("nbsp-stem", List.of(question(4, "\u00A0", twoOptions(), "alpha")));
        assertQuestionsRejected("ideographic-stem", List.of(question(4, "\u3000\u3000", twoOptions(), "alpha")));
        assertQuestionsRejected("bom-stem", List.of(question(4, "\uFEFF", twoOptions(), "alpha")));
        assertQuestionsRejected("nbsp-label", List.of(question(4, "Stem",
                List.of(option("alpha", "\u00A0"), option("beta", "Bee")), "alpha")));
        assertQuestionsRejected("long-stem", List.of(question(4, "q".repeat(4097), twoOptions(), "alpha")));
        assertQuestionsRejected("long-codepoints", List.of(question(
                4, Character.toString(0x1F600).repeat(4097), twoOptions(), "alpha")));
        assertQuestionsRejected("long-label", List.of(question(4, "Stem",
                List.of(option("alpha", "L".repeat(513)), option("beta", "Bee")), "alpha")));
        assertQuestionsRejected("long-token", List.of(question(4, "Stem",
                List.of(option("a" + "b".repeat(64), "Aye"), option("beta", "Bee")), "a" + "b".repeat(64))));
        Map<String, Object> openQuestion = question(4, "Stem", twoOptions(), "alpha");
        openQuestion.put("explanation", "because");
        assertQuestionsRejected("open-question", List.of(openQuestion));
        Map<String, Object> plantedQuestion = question(4, "Stem", twoOptions(), "alpha");
        plantedQuestion.put(GradableQuestions.SEAL_FIELD, "c".repeat(64));
        assertQuestionsRejected("caller-question-seal", List.of(plantedQuestion));
        Map<String, Object> openOption = option("alpha", "Aye");
        openOption.put("correct", true);
        assertQuestionsRejected("open-option", List.of(question(4, "Stem",
                List.of(openOption, option("beta", "Bee")), "alpha")));
        Map<String, Object> openRule = question(4, "Stem", twoOptions(), "alpha");
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("correctOption", "alpha");
        rule.put("acceptedKeys", List.of("alpha"));
        openRule.put("answerRule", rule);
        assertQuestionsRejected("open-rule", List.of(openRule));
        Map<String, Object> missingRule = question(4, "Stem", twoOptions(), "alpha");
        missingRule.remove("answerRule");
        assertQuestionsRejected("missing-rule", List.of(missingRule));
        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int index = 1; index <= 101; index++) {
            tooMany.add(question(index, "Stem " + index, twoOptions(), "alpha"));
        }
        assertQuestionsRejected("too-many", tooMany);

        command("CREATE_DRAFT", CODE, draft(), editor(), "malformed-save-base");
        Map<String, Object> savedPayload = latest().payload().raw();
        String savedHash = latest().contentHash();
        Map<String, Object> broken = draft();
        broken.put("gradableQuestions", null);
        ContentOperationException save = assertThrows(ContentOperationException.class,
                () -> command("SAVE_DRAFT", CODE, broken, editor(), "malformed-save-null"));
        assertEquals("GRADABLE_QUESTIONS_INVALID", save.code());
        assertEquals(1, content().versions().size());
        assertSame(savedPayload, latest().payload().raw());
        assertEquals(savedHash, latest().contentHash());

        Map<String, Object> planted = questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha")));
        planted.put(GradableQuestions.SEAL_FIELD, "f".repeat(64));
        ContentOperationException callerSeal = assertThrows(ContentOperationException.class,
                () -> command("SAVE_DRAFT", CODE, planted, editor(), "caller-seal-save"));
        assertEquals(400, callerSeal.status());
        assertEquals("CONTENT_COMMAND_INVALID", callerSeal.code());
        assertFalse(callerSeal.getMessage().contains("f".repeat(64)));
        assertEquals(1, content().versions().size());
        assertSame(savedPayload, latest().payload().raw());
        assertEquals(savedHash, latest().contentHash());
        ContentOperationException plantedCreate = assertThrows(ContentOperationException.class,
                () -> command("CREATE_DRAFT", "caller-seal-create", planted, editor(), "caller-seal-create"));
        assertEquals("CONTENT_COMMAND_INVALID", plantedCreate.code());
        assertTrue(repository.findByCode("caller-seal-create").isEmpty());

        List<Map<String, Object>> hundred = new ArrayList<>();
        for (int index = 1; index <= 100; index++) {
            hundred.add(question(index, "Stem " + index, twoOptions(), "alpha"));
        }
        command("CREATE_DRAFT", "bounds-100", questionsDraft(hundred), editor(), "bounds-100-create");
        ContentVersion bounded = repository.findByCode("bounds-100").orElseThrow().versions().getFirst();
        List<?> stored = (List<?>) bounded.payload().raw().get("gradableQuestions");
        assertEquals(100, stored.size());
        assertEquals(1L, ((Number) ((Map<?, ?>) stored.getFirst()).get("itemId")).longValue());
        assertEquals(100L, ((Number) ((Map<?, ?>) stored.getLast()).get("itemId")).longValue());

        String emoji = Character.toString(0x1F600);
        command("CREATE_DRAFT", "bounds-emoji", questionsDraft(List.of(question(
                4, emoji.repeat(4096), List.of(option("alpha", "\u00A0Aye"), option("beta", "Bee")), "alpha"))),
                editor(), "bounds-emoji-create");
        ContentVersion emojiVersion = repository.findByCode("bounds-emoji").orElseThrow().versions().getFirst();
        String storedStem = question(emojiVersion, 0).get("stem").toString();
        assertEquals(4096, storedStem.codePointCount(0, storedStem.length()));
        assertEquals(8192, storedStem.length());
        assertEquals("\u00A0Aye", option(emojiVersion, 0, 0).get("label"));
    }

    @Test
    void sealedOwnerIdsRejectOptInBeforeCreate() {
        Map<String, Object> questions = questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha")));
        for (String code : List.of("p1.placement.v1", "p1-placement-bank-v1")) {
            ContentOperationException error = assertThrows(ContentOperationException.class,
                    () -> command("CREATE_DRAFT", code, questions, editor(), "sealed-" + code));
            assertEquals(400, error.status(), code);
            assertEquals("GRADABLE_QUESTIONS_SEALED_BANK", error.code(), code);
            assertTrue(repository.findByCode(code).isEmpty(), code);
        }
        command("CREATE_DRAFT", "p1.placement.v2", questions, editor(), "sealed-near-miss-key");
        command("CREATE_DRAFT", "P1.PLACEMENT.V1", questions, editor(), "sealed-case-variant-1");
        assertTrue(repository.findByCode("p1.placement.v2").orElseThrow().versions().getFirst()
                .payload().raw().containsKey("gradableQuestions"));
        assertTrue(repository.findByCode("P1.PLACEMENT.V1").orElseThrow().versions().getFirst()
                .payload().raw().containsKey("gradableQuestions"));
        assertTrue(repository.findByCode("p1.placement.v1").isEmpty());
    }

    @Test
    void sealedAliasOwnerRejectsSaveWithoutANewVersion() {
        String alias = "placement-alias-code";
        ContentDefinition seeded = ContentDefinition.create(
                ContentId.of("p1-placement-bank-v1"), "platform", alias, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        seeded.addDraft(ContentVersionId.of(1L), draft(), new ContentRights(
                        "SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.PENDING,
                        false, Set.of(), null, null, null),
                "editor-1", "draft", Instant.now());
        repository.create(seeded);
        Map<String, Object> before = seeded.versions().getFirst().payload().raw();
        String hash = seeded.versions().getFirst().contentHash();
        long revision = seeded.stateVersion();

        ContentOperationException error = assertThrows(ContentOperationException.class,
                () -> command("SAVE_DRAFT", alias,
                        questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))),
                        editor(), "sealed-alias-save"));
        assertEquals(400, error.status());
        assertEquals("GRADABLE_QUESTIONS_SEALED_BANK", error.code());
        ContentDefinition stored = repository.findByCode(alias).orElseThrow();
        assertEquals("p1-placement-bank-v1", stored.contentId().value());
        assertEquals(1, stored.versions().size());
        assertEquals(revision, stored.stateVersion());
        assertSame(before, stored.versions().getFirst().payload().raw());
        assertEquals(hash, stored.versions().getFirst().contentHash());
        assertFalse(stored.versions().getFirst().payload().raw().containsKey("gradableQuestions"));
    }

    @Test
    void optedInResponsesOmitThePrivateField() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", "CREATE_DRAFT");
        body.put("contentCode", CODE);
        body.put("expectedStateVersion", 0);
        body.put("content", questionsDraft(List.of(
                question(20, "Second stem", List.of(option("beta", "Bee"), option("alpha", "Aye")), "beta"))));
        Map<String, Object> receipt = controller.command(body, editor(), "redact-create-draft", HEADERS).getBody();
        String storedSeal = seal(latest());
        assertFalse(hasKey(receipt, "gradableQuestions"));
        assertFalse(hasKey(receipt, "answerRule"));
        assertFalse(hasKey(receipt, "correctOption"));
        assertFalse(hasKey(receipt, GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(receipt).contains(storedSeal));
        Map<String, Object> detail = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertFalse(hasKey(detail, "gradableQuestions"));
        assertFalse(hasKey(detail, "answerRule"));
        assertFalse(hasKey(detail, "correctOption"));
        assertFalse(hasKey(detail, GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(detail).contains(storedSeal));
        Map<String, Object> shown = editorDraft(CODE);
        Map<String, Object> stored = latest().payload().raw();
        Map<String, Object> visible = new LinkedHashMap<>(stored);
        visible.remove("gradableQuestions");
        visible.remove(GradableQuestions.SEAL_FIELD);
        assertEquals(visible, shown.get("payload"));
        assertFalse(((Map<?, ?>) shown.get("payload")).containsKey("gradableQuestions"));
        assertFalse(((Map<?, ?>) shown.get("payload")).containsKey(GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(shown).contains(storedSeal));
        assertSame(stored.get("items"), ((Map<?, ?>) shown.get("payload")).get("items"));
        assertTrue(hasKey(stored.get("gradableQuestions"), "correctOption"));
        assertEquals("beta", ((Map<?, ?>) question(latest(), 0).get("answerRule")).get("correctOption"));
        assertEquals(1, content().versions().size());
    }

    @Test
    void reviewPublisherAndReportGatesStayClosedForOptIn() {
        command("CREATE_DRAFT", CODE, questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))),
                editor(), "review-opt-in-create");
        assertPendingRights(latest());
        long revision = content().stateVersion();
        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals(false, state.get("reviewSubmissionReady"));
        assertEquals("RIGHTS_NOT_READY", state.get("reviewSubmissionReason"));
        ContentOperationException submit = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", CODE, null, editor(), "review-opt-in-submit"));
        assertEquals(409, submit.status());
        assertEquals("CONTENT_RIGHTS_NOT_READY", submit.code());
        ContentOperationException editorPublish = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", CODE, null, editor(), "review-opt-in-editor-publish"));
        assertEquals(403, editorPublish.status());
        assertEquals("CONTENT_PUBLISHER_REQUIRED", editorPublish.code());
        ContentOperationException publisherPublish = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", CODE, null, publisher(), "review-opt-in-publish"));
        assertEquals("CONTENT_RIGHTS_NOT_READY", publisherPublish.code());
        assertEquals(ContentVersionStatus.DRAFT, latest().status());
        assertEquals(revision, content().stateVersion());
        assertEquals(0L, outbox.countByType("content.version.submitted.v1"));
        assertTrue(content().currentPublishedVersionId().isEmpty());

        Map<String, Object> authoring = data(controller.validateAuto(
                Map.of("content", questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha")))),
                editor(), "validate-authoring-opt-in", HEADERS).getBody());
        assertEquals(false, authoring.get("passed"));
        assertFinding(authoring, "RIGHTS_EVIDENCE_MISSING");
        assertFinding(authoring, "RIGHTS_LEARNING_DENIED");
        assertNoFinding(authoring, "ANSWER_LEAK_DETECTED");
        assertNoFinding(authoring, "GRADABLE_QUESTIONS_INVALID");
        Map<String, Object> storedReport = data(controller.validateAuto(
                Map.of("contentCode", CODE), editor(), "validate-stored-opt-in", HEADERS).getBody());
        assertNoFinding(storedReport, "ANSWER_LEAK_DETECTED");
        assertNoFinding(storedReport, "GRADABLE_QUESTIONS_INVALID");
        String storedSeal = seal(latest());
        assertFalse(hasKey(storedReport, GradableQuestions.SEAL_FIELD));
        assertFalse(String.valueOf(storedReport).contains(storedSeal));

        String activeCode = "active-gradable";
        ContentDefinition active = ContentDefinition.create(
                ContentId.of(activeCode), "platform", activeCode, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        Map<String, Object> payload = draft();
        payload.put("gradableQuestions", List.of(question(8, "Stem", twoOptions(), "alpha")));
        active.addDraft(ContentVersionId.of(1L), payload, new ContentRights(
                        "SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.ACTIVE, true,
                        Set.of("LEARNER", "PUBLIC"), null, null, "owner-evidence-1"),
                "editor-1", "draft", Instant.now());
        repository.create(active);
        Map<String, Object> unmarked = active.versions().getFirst().payload().raw();
        assertFalse(unmarked.containsKey(GradableQuestions.SEAL_FIELD));
        Map<String, Object> activeState = data(controller.get(activeCode, editor(), HEADERS).getBody());
        assertFalse(hasKey(activeState, GradableQuestions.SEAL_FIELD));
        assertSame(unmarked, repository.findByCode(activeCode).orElseThrow().versions().getFirst().payload().raw());
        assertFalse(hasKey(editorDraft(activeCode), GradableQuestions.SEAL_FIELD));
        assertEquals(false, activeState.get("reviewSubmissionReady"));
        assertEquals("VALIDATION_REPORT_UNAVAILABLE", activeState.get("reviewSubmissionReason"));
        ContentOperationException activeSubmit = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", activeCode, null, editor(), "active-opt-in-submit"));
        assertEquals("CONTENT_REVIEW_EVIDENCE_UNAVAILABLE", activeSubmit.code());
        ContentOperationException activePublish = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", activeCode, null, publisher(), "active-opt-in-publish"));
        assertEquals("CONTENT_REVIEW_EVIDENCE_UNAVAILABLE", activePublish.code());
        assertEquals(ContentVersionStatus.DRAFT, repository.findByCode(activeCode).orElseThrow()
                .versions().getFirst().status());
        assertTrue(repository.findByCode(activeCode).orElseThrow().currentPublishedVersionId().isEmpty());
    }

    @Test
    void legacyAnswerKeysStillBlockBesideAValidOptIn() {
        Map<String, Object> legacyItem = new LinkedHashMap<>();
        legacyItem.put("displayText", "Read this sentence.");
        legacyItem.put("answerRule", Map.of("correctOption", "hidden-legacy"));
        Map<String, Object> legacy = draft();
        legacy.put("items", List.of(legacyItem));
        command("CREATE_DRAFT", CODE, legacy, editor(), "legacy-answer-create");
        assertLegacyPayload(latest());
        assertSame(latest().payload().raw(), editorDraft(CODE).get("payload"));
        assertEquals("hidden-legacy", ((Map<?, ?>) ((Map<?, ?>) ((List<?>) latest().payload().raw()
                .get("items")).getFirst()).get("answerRule")).get("correctOption"));
        Map<String, Object> storedReport = data(controller.validateAuto(
                Map.of("contentCode", CODE), editor(), "validate-legacy-answer", HEADERS).getBody());
        assertFinding(storedReport, "ANSWER_LEAK_DETECTED");

        Map<String, Object> mixed = questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha")));
        mixed.put("items", List.of(legacyItem));
        Map<String, Object> mixedReport = data(controller.validateAuto(
                Map.of("content", mixed), editor(), "validate-mixed-answer", HEADERS).getBody());
        assertFinding(mixedReport, "ANSWER_LEAK_DETECTED");
        assertNoFinding(mixedReport, "GRADABLE_QUESTIONS_INVALID");
        Map<String, Object> clean = data(controller.validateAuto(
                Map.of("content", questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha")))),
                editor(), "validate-clean-opt-in", HEADERS).getBody());
        assertNoFinding(clean, "ANSWER_LEAK_DETECTED");
    }

    @Test
    void batchDraftRejectsOptInBeforeWriteAndKeepsOrdinaryRows() {
        Map<String, Object> ordinary = Map.of("contentCode", CODE, "content", draft());
        Map<String, Object> opted = new LinkedHashMap<>();
        opted.put("contentCode", "batch-opt-in");
        opted.put("gradableQuestions", List.of(question(4, "Envelope", twoOptions(), "alpha")));
        opted.put("content", questionsDraft(List.of(question(4, "Stem", twoOptions(), "alpha"))));
        Map<String, Object> result = data(controller.importBatch(
                Map.of("items", List.of(ordinary, opted)), editor(), "batch-opt-in-guard-1", HEADERS).getBody());
        assertEquals(1L, result.get("accepted"));
        assertEquals(0L, result.get("skipped"));
        assertEquals(1L, result.get("failed"));
        List<?> items = (List<?>) result.get("items");
        assertEquals("ACCEPTED", ((Map<?, ?>) items.getFirst()).get("status"));
        Map<?, ?> rejected = (Map<?, ?>) items.get(1);
        assertEquals("FAILED", rejected.get("status"));
        assertEquals("GRADABLE_QUESTIONS_UNSUPPORTED", rejected.get("errorCode"));
        assertNull(rejected.get("contentVersionId"));
        assertLegacyPayload(repository.findByCode(CODE).orElseThrow().versions().getFirst());
        assertTrue(repository.findByCode("batch-opt-in").isEmpty());

        Map<String, Object> dry = data(controller.importBatch(
                Map.of("dryRun", true, "items", List.of(opted)),
                editor(), "batch-opt-in-dry-1", HEADERS).getBody());
        assertEquals(0L, dry.get("ready"));
        assertEquals(1L, dry.get("invalid"));
        assertEquals("INVALID", ((Map<?, ?>) ((List<?>) dry.get("items")).getFirst()).get("status"));
        assertEquals("GRADABLE_QUESTIONS_UNSUPPORTED",
                ((Map<?, ?>) ((List<?>) dry.get("items")).getFirst()).get("errorCode"));
        assertTrue(repository.findByCode("batch-opt-in").isEmpty());
    }

    private void assertMissingDecision(String operation, JwtAuthenticationToken actor, String key) {
        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> command(operation, CODE, null, actor, key));
        assertEquals(400, missing.status());
        assertEquals("REVIEW_DECISION_REQUIRED", missing.code());
    }

    private static void assertPendingRights(ContentVersion version) {
        ContentRights rights = version.rights().orElseThrow();
        assertEquals(CopyrightStatus.PENDING, rights.status());
        assertFalse(rights.allowsLearning());
        assertEquals(Set.of(), rights.permittedChannels());
        assertNull(rights.authorizationEvidenceRef());
        assertNull(rights.startsAt());
        assertNull(rights.expiresAt());
    }

    private static void assertFinding(Map<String, Object> report, String code) {
        assertTrue(((List<?>) report.get("findings")).stream()
                .map(Map.class::cast).anyMatch(finding -> code.equals(finding.get("code"))), code);
    }

    private ContentDefinition content() {
        return repository.findByCode(CODE).orElseThrow();
    }

    private ContentVersion latest() {
        return content().versions().getLast();
    }

    private void command(String operation, String code, Map<String, Object> draft,
                         JwtAuthenticationToken actor, String key) {
        command(operation, code, draft, actor, key, null);
    }

    private void command(String operation, String code, Map<String, Object> draft,
                         JwtAuthenticationToken actor, String key, String decision) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", repository.findByCode(code)
                .map(ContentDefinition::stateVersion).orElse(0L));
        if (draft != null) body.put("content", draft);
        if (decision != null) body.put("reviewDecision", decision);
        assertEquals(202, controller.command(body, actor, key, HEADERS).getStatusCode().value());
    }

    private static Map<String, Object> draft() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Rights boundary lesson");
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "SOURCE-ONE");
        result.put("licenseCode", "LICENSE-ONE");
        result.put("items", List.of(Map.of("displayText", "Read this sentence.")));
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    private static JwtAuthenticationToken editor() {
        return actor("editor-1", "content:write");
    }

    private static JwtAuthenticationToken firstReviewer() {
        return actor("reviewer-1", "content:review:first");
    }

    private static JwtAuthenticationToken finalReviewer() {
        return actor("reviewer-2", "content:review:final");
    }

    private static JwtAuthenticationToken publisher() {
        return actor("publisher-1", "content:publish");
    }

    private static JwtAuthenticationToken actor(String subject, String permission) {
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-only")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of(permission))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private void assertQuestionsRejected(String name, Object questions) {
        String code = "bad-" + name;
        ContentOperationException error = assertThrows(ContentOperationException.class,
                () -> command("CREATE_DRAFT", code, questionsDraft(questions), editor(), "bad-" + name + "-create"),
                name);
        assertEquals(400, error.status(), name);
        assertEquals("GRADABLE_QUESTIONS_INVALID", error.code(), name);
        assertTrue(repository.findByCode(code).isEmpty(), name);
    }

    private ContentVersion version(String code, int index) {
        return repository.findByCode(code).orElseThrow().versions().get(index);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> editorDraft(String code) {
        return (Map<String, Object>) data(controller.get(code, editor(), HEADERS).getBody()).get("editorDraft");
    }

    private static void assertLegacyPayload(ContentVersion version) {
        assertEquals(List.of("summary", "contentLocale", "targetLevel", "items"),
                new ArrayList<>(version.payload().raw().keySet()));
        assertFalse(version.payload().raw().containsKey(GradableQuestions.SEAL_FIELD));
    }

    private static String seal(ContentVersion version) {
        Object value = version.payload().raw().get(GradableQuestions.SEAL_FIELD);
        assertTrue(value instanceof String);
        String seal = (String) value;
        assertEquals(64, seal.length());
        assertTrue(seal.matches("[0-9a-f]{64}"));
        assertNotEquals(version.contentHash(), seal);
        assertFalse(question(version, 0).containsKey(GradableQuestions.SEAL_FIELD));
        Map<String, Object> withoutSeal = new LinkedHashMap<>(version.payload().raw());
        withoutSeal.remove(GradableQuestions.SEAL_FIELD);
        assertNotEquals(ContentPayloadHash.sha256(withoutSeal), seal);
        Object correct = ((Map<?, ?>) question(version, 0).get("answerRule")).get("correctOption");
        assertNotEquals(ContentPayloadHash.sha256(Map.of("correctOption", String.valueOf(correct))), seal);
        return seal;
    }

    private static void assertQuestionOrder(ContentVersion version, List<Long> itemIds, List<String> firstOptionIds) {
        List<?> questions = (List<?>) version.payload().raw().get("gradableQuestions");
        assertEquals(itemIds.size(), questions.size());
        for (int index = 0; index < itemIds.size(); index++) {
            assertEquals(itemIds.get(index).longValue(),
                    ((Number) question(version, index).get("itemId")).longValue());
            assertEquals(firstOptionIds.get(index), option(version, index, 0).get("optionId"));
        }
    }

    private static void assertNoFinding(Map<String, Object> report, String code) {
        assertFalse(((List<?>) report.get("findings")).stream()
                .map(Map.class::cast).anyMatch(finding -> code.equals(finding.get("code"))), code);
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

    private static Map<String, Object> questionsDraft(Object questions) {
        Map<String, Object> result = draft();
        result.put("gradableQuestions", questions);
        return result;
    }

    private static Map<?, ?> question(ContentVersion version, int index) {
        return (Map<?, ?>) ((List<?>) version.payload().raw().get("gradableQuestions")).get(index);
    }

    private static Map<?, ?> option(ContentVersion version, int questionIndex, int optionIndex) {
        return (Map<?, ?>) ((List<?>) question(version, questionIndex).get("options")).get(optionIndex);
    }

    private static Map<String, Object> question(
            Object itemId, String stem, List<Map<String, Object>> options, String correct) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemId", itemId);
        result.put("stem", stem);
        result.put("options", options);
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("correctOption", correct);
        result.put("answerRule", rule);
        return result;
    }

    private static List<Map<String, Object>> twoOptions() {
        return List.of(option("alpha", "Aye"), option("beta", "Bee"));
    }

    private static Map<String, Object> option(String optionId, String label) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("optionId", optionId);
        result.put("label", label);
        return result;
    }
}
