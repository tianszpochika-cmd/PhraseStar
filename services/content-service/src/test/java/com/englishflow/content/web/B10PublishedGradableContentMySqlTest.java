package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcContentIdempotency;
import com.englishflow.content.adapter.jdbc.JdbcContentRepository;
import com.englishflow.content.adapter.jdbc.JdbcValidationReportStore;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.GradableQuestions;
import com.englishflow.content.domain.PublicContentProjection;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Opt-in owner probe for one published gradable reading version.
 * Synthetic in-process JWTs only. No IAM, gateway, broker, or admin DDL.
 */
@EnabledIfSystemProperty(named = "content.publishedReading.integration", matches = "true")
class B10PublishedGradableContentMySqlTest {

    private static final Pattern SCHEMA_NAME = Pattern.compile("csp_reading_[a-f0-9]+");
    private static final Pattern OWNER_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]{0,31}");
    private static final String SCHEMA_ENV = "CONTENT_PUBLISHED_READING_SCHEMA";
    private static final String USER_ENV = "CONTENT_PUBLISHED_READING_USERNAME";
    private static final String PASSWORD_ENV = "CONTENT_PUBLISHED_READING_PASSWORD";
    private static final String JDBC_URL_PREFIX = "jdbc:mysql://127.0.0.1:13306/";
    private static final String CODE = "reading.score.b10";
    private static final String OPEN = "reading.score.open";
    private static final String EDITOR = "editor-b10";
    private static final String FIRST = "reviewer-b10-l1";
    private static final String FINAL = "reviewer-b10-l2";
    private static final String PUBLISHER = "publisher-b10";
    private static final String CREATE_KEY = "b10-create-reading-0001";
    private static final String PUBLISH_KEY = "b10-publish-reading01";
    private static final Set<String> RAW_FIELDS = Set.of(
            "correctOption", "answerRule", "answerRules", "readingRuleSeal", "selectedOptionId",
            "correctAnswer", "solution", "scoringRule");
    private static final HttpHeaders HEADERS = new HttpHeaders();

    private static JdbcTemplate jdbc;
    private static CountingJdbc reads;
    private static TransactionTemplate transaction;
    private static ObjectMapper mapper;
    private static int outboxBaseline;

    @BeforeAll
    static void requireEmptyMysqlAndMigrateThroughV34() throws Exception {
        String schema = requiredEnv(SCHEMA_ENV).trim();
        String user = requiredEnv(USER_ENV).trim();
        String password = requiredEnv(PASSWORD_ENV);
        if (!SCHEMA_NAME.matcher(schema).matches()) {
            throw new AssertionError(SCHEMA_ENV + " must match csp_reading_[a-f0-9]+");
        }
        if (!OWNER_NAME.matcher(user).matches()) {
            throw new AssertionError(USER_ENV + " must be one dedicated owner account name");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(JDBC_URL_PREFIX + schema
                + "?useUnicode=true&characterEncoding=utf8&connectionTimeZone=UTC"
                + "&allowPublicKeyRetrieval=true&sslMode=DISABLED&connectTimeout=5000");
        dataSource.setUsername(user);
        dataSource.setPassword(password);
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            if (!"MySQL".equalsIgnoreCase(meta.getDatabaseProductName())) {
                throw new AssertionError("expected MySQL");
            }
            String reported = meta.getURL() == null ? "" : meta.getURL();
            if (!reported.startsWith(JDBC_URL_PREFIX + schema) || reported.contains("@")) {
                throw new AssertionError("connection must stay on the dedicated schema");
            }
        } catch (AssertionError failed) {
            throw failed;
        } catch (Exception failed) {
            throw new AssertionError(redacted("MySQL connection check failed", failed, user, password));
        }
        jdbc = new JdbcTemplate(dataSource);
        reads = new CountingJdbc(dataSource);
        transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        mapper = new ObjectMapper();
        try {
            assertEquals(schema, jdbc.queryForObject("SELECT DATABASE()", String.class));
            if (jdbc.queryForList("SHOW TABLES").size() != 0) {
                throw new AssertionError("baseline schema must be empty before Flyway");
            }
            var migrated = Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .defaultSchema(schema)
                    .createSchemas(false)
                    .cleanDisabled(true)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();
            assertTrue(migrated.success);
            assertTrue(migrated.migrationsExecuted >= 1);
        } catch (AssertionError failed) {
            throw failed;
        } catch (Exception failed) {
            throw new AssertionError(redacted("Flyway migrate failed", failed, user, password));
        }
        assertEquals(1, count(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '34' AND success = 1"));
        assertEquals("34", jdbc.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = 1 "
                        + "ORDER BY installed_rank DESC LIMIT 1",
                String.class));
        assertEquals(0, count("SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0"));
        outboxBaseline = count("SELECT COUNT(*) FROM content_outbox_event");
    }

    @Test
    void publishedReadingScoresFullOrZeroAndStaysReadOnly() throws Exception {
        B9ContentAdminController owner = controller();
        GradableAssessmentSnapshotController snapshots = new GradableAssessmentSnapshotController(reads, mapper);
        JwtAuthenticationToken editor = actor(EDITOR, "content:write");
        JwtAuthenticationToken first = actor(FIRST, "content:review:first");
        JwtAuthenticationToken fin = actor(FINAL, "content:review:final");
        JwtAuthenticationToken publisher = actor(PUBLISHER, "content:publish");
        JwtAuthenticationToken assessment = service(
                "assessment-service", "service", "assessment-service", List.of("content:answer-rules:read"));
        Map<String, Object> sealedDraft = readingDraft(
                "Reading score probe", List.of("LEARNER", "PUBLIC", "SEALED"), "evidence-b10-sealed");

        ContentOperationException workloadWrite = reject(owner, assessment, "CREATE_DRAFT", CODE, 0L,
                sealedDraft, "b10-workload-create-01", null);
        assertEquals(403, workloadWrite.status());
        assertEquals("CONTENT_EDITOR_REQUIRED", workloadWrite.code());
        ContentOperationException publisherWrite = reject(owner, publisher, "CREATE_DRAFT", CODE, 0L,
                sealedDraft, "b10-publisher-create01", null);
        assertEquals(403, publisherWrite.status());
        assertEquals("CONTENT_EDITOR_REQUIRED", publisherWrite.code());

        Map<String, Object> created = command(owner, editor, "CREATE_DRAFT", CODE, 0L,
                sealedDraft, CREATE_KEY, null);
        long versionId = ((Number) created.get("contentVersionId")).longValue();
        Map<String, Object> replay = command(controller(), editor, "CREATE_DRAFT", CODE, 0L,
                sealedDraft, CREATE_KEY, null);
        assertSameJson(created, replay);
        ContentOperationException reuse = reject(owner, editor, "CREATE_DRAFT", CODE, 0L,
                readingDraft("Reading score probe", List.of("LEARNER", "PUBLIC", "SEALED"), "evidence-b10-sealed",
                        "Different line"),
                CREATE_KEY, null);
        assertEquals(409, reuse.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", reuse.code());
        assertEquals(1, versions(CODE));
        assertScoped(CREATE_KEY, "platform:" + EDITOR + ":content.b9.draft");
        ContentOperationException reviewerCreate = reject(owner, first, "CREATE_DRAFT", CODE, 0L,
                sealedDraft, CREATE_KEY, null);
        assertEquals(403, reviewerCreate.status());
        assertEquals("CONTENT_EDITOR_REQUIRED", reviewerCreate.code());
        assertEquals(0, count(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key = ? AND scope = ?",
                CREATE_KEY, "platform:" + FIRST + ":content.b9.draft"));

        ContentVersion draft = version(CODE);
        assertEquals(ContentVersionStatus.DRAFT, draft.status());
        assertEquals(CopyrightStatus.PENDING, draft.rights().orElseThrow().status());
        assertEquals(Set.of("LEARNER", "PUBLIC", "SEALED"), Set.copyOf(draft.proposal().channelList()));
        assertStoredQuestion(draft, 0, 9L, "beta");
        assertStoredQuestion(draft, 1, 2L, "aye");
        String seal = String.valueOf(draft.payload().raw().get(GradableQuestions.SEAL_FIELD));
        assertTrue(seal.matches("[0-9a-f]{64}"));
        assertEquals(ContentPayloadHash.sha256(draft.payload().raw()), draft.contentHash());
        assertFalse(mapper.writeValueAsString(created).contains(seal));
        assertFalse(hasRawField(created), "command receipt contains a raw answer field");

        ContentOperationException editorReview = reject(owner, editor, "REVIEW_FIRST", CODE, stateOf(CODE),
                null, "b10-editor-review-001", "APPROVED");
        assertEquals(403, editorReview.status());
        assertEquals("CONTENT_REVIEW_L1_REQUIRED", editorReview.code());
        assertStatus(HttpStatus.GONE, () -> snapshots.getB10AssessmentContentSnapshot(
                assessment, Long.toString(versionId)));
        ContentOperationException earlyReview = reject(owner, first, "REVIEW_FIRST", CODE, stateOf(CODE),
                null, "b10-early-l1-00000001", "APPROVED");
        assertEquals(409, earlyReview.status());
        assertEquals("CONTENT_STATE_INVALID", earlyReview.code());
        assertEquals(ContentVersionStatus.DRAFT, version(CODE).status());

        Map<String, Object> validated = command(owner, editor, "VALIDATE_DRAFT", CODE, stateOf(CODE),
                null, "b10-validate-reading1", null);
        Map<?, ?> report = (Map<?, ?>) validated.get("validationReport");
        assertEquals(Boolean.TRUE, report.get("passed"));
        assertTrue(String.valueOf(report.get("reportId")).startsWith("vr_"));
        Map<String, Object> validatedAgain = command(owner, editor, "VALIDATE_DRAFT", CODE, stateOf(CODE),
                null, "b10-validate-reading1", null);
        assertEquals(report.get("reportId"), ((Map<?, ?>) validatedAgain.get("validationReport")).get("reportId"));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM content_validation_report WHERE content_version_id = ?", versionId));

        command(owner, editor, "SUBMIT_REVIEW", CODE, stateOf(CODE), null, "b10-submit-reading001", null);
        assertEquals(ContentVersionStatus.IN_REVIEW, version(CODE).status());
        command(owner, first, "REVIEW_FIRST", CODE, stateOf(CODE), null, "b10-review-l1-reading1", "APPROVED");
        ContentVersion approved = version(CODE);
        assertEquals(ContentVersionStatus.APPROVED, approved.status());
        assertEquals(CopyrightStatus.PENDING, approved.rights().orElseThrow().status());
        assertEquals(FIRST, approved.firstReviewer().orElseThrow());
        assertTrue(approved.finalReviewer().isEmpty());

        command(owner, fin, "REVIEW_FINAL", CODE, stateOf(CODE), null, "b10-review-l2-reading1", "APPROVED");
        ContentVersion activated = version(CODE);
        assertEquals(ContentVersionStatus.APPROVED, activated.status());
        assertEquals(CopyrightStatus.ACTIVE, activated.rights().orElseThrow().status());
        assertEquals(Set.of("LEARNER", "PUBLIC", "SEALED"), activated.rights().orElseThrow().permittedChannels());
        assertEquals("evidence-b10-sealed", activated.rights().orElseThrow().authorizationEvidenceRef());
        assertTrue(activated.rights().orElseThrow().allowsLearning());
        assertEquals(FINAL, activated.finalReviewer().orElseThrow());
        assertTrue(activated.publisher().isEmpty());

        Map<String, Object> published = command(owner, publisher, "PUBLISH", CODE, stateOf(CODE),
                null, PUBLISH_KEY, null);
        assertEquals(versionId, ((Number) published.get("contentVersionId")).longValue());
        String hash = payloadHash(versionId);
        Map<String, Object> publishedAgain = command(owner, publisher, "PUBLISH", CODE, stateOf(CODE),
                null, PUBLISH_KEY, null);
        assertEquals(versionId, ((Number) publishedAgain.get("contentVersionId")).longValue());
        assertEquals(hash, payloadHash(versionId));
        ContentOperationException coldPublish = reject(controller(), publisher, "PUBLISH", CODE, stateOf(CODE),
                null, PUBLISH_KEY, null);
        assertEquals(503, coldPublish.status());
        assertEquals("IDEMPOTENCY_REPLAY_UNAVAILABLE", coldPublish.code());
        assertEquals(hash, payloadHash(versionId));
        ContentVersion live = version(CODE);
        assertEquals(ContentVersionStatus.PUBLISHED, live.status());
        assertEquals(EDITOR, live.editor());
        assertEquals(FIRST, live.firstReviewer().orElseThrow());
        assertEquals(FINAL, live.finalReviewer().orElseThrow());
        assertEquals(PUBLISHER, live.publisher().orElseThrow());
        assertEquals(4, Set.of(live.editor(), live.firstReviewer().orElseThrow(),
                live.finalReviewer().orElseThrow(), live.publisher().orElseThrow()).size());
        assertEquals(1, versions(CODE));
        assertScoped(PUBLISH_KEY + ":publish", "platform:" + PUBLISHER + ":content.publish");

        String stable = footprint(versionId);
        ContentOperationException stale = reject(owner, publisher, "UNPUBLISH", CODE, stateOf(CODE) + 25L,
                null, "b10-unpublish-stale-01", null);
        assertEquals(409, stale.status());
        assertEquals("VERSION_CONFLICT", stale.code());
        assertEquals(ContentVersionStatus.PUBLISHED, version(CODE).status());

        String path = Long.toString(versionId);
        Map<String, Object> denialBody = new LinkedHashMap<>();
        denialBody.put("contentCode", CODE);
        denialBody.put("itemId", 9L);
        denialBody.put("selectedOptionId", "beta");
        denialBody.put("snapshotId", "snap_reading.score.b10-" + versionId);
        denialBody.put("snapshotHash", "ab".repeat(32));
        denialBody.put("ruleDigest", "cd".repeat(32));
        int readsBefore = reads.reads;
        assertStatus(HttpStatus.UNAUTHORIZED, () -> snapshots.getB10AssessmentContentSnapshot(null, path));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.getB10AssessmentContentSnapshot(learner(), path));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.scoreB10AssessmentContentSnapshot(learner(), path, denialBody));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.scoreB10AssessmentContentSnapshot(
                service("learning-service", "service", "learning-service", List.of("content:answer-rules:read")),
                path, denialBody));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.scoreB10AssessmentContentSnapshot(
                service("assessment-service", "access", "assessment-service", List.of("content:answer-rules:read")),
                path, denialBody));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.scoreB10AssessmentContentSnapshot(
                service("assessment-service", "service", "learning-service", List.of("content:answer-rules:read")),
                path, denialBody));
        assertStatus(HttpStatus.FORBIDDEN, () -> snapshots.scoreB10AssessmentContentSnapshot(
                service("assessment-service", "service", "assessment-service", List.of("content.read")),
                path, denialBody));
        assertStatus(HttpStatus.BAD_REQUEST, () -> snapshots.getB10AssessmentContentSnapshot(assessment, "01"));
        Map<String, Object> extra = new LinkedHashMap<>(denialBody);
        extra.put("role", "learner");
        assertStatus(HttpStatus.BAD_REQUEST, () -> snapshots.scoreB10AssessmentContentSnapshot(assessment, path, extra));
        assertEquals(readsBefore, reads.reads);

        Map<String, Object> firstSnapshot = data(snapshots, assessment, versionId);
        Map<String, Object> secondSnapshot = data(snapshots, assessment, versionId);
        assertEquals(firstSnapshot, secondSnapshot);
        assertSafe(firstSnapshot, seal);
        Map<String, Object> pin = map(firstSnapshot.get("pin"));
        assertEquals(Set.of("contentCode", "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash",
                "pinStatus", "pinnedAt", "recoveryReasonCode"), pin.keySet());
        assertEquals("PINNED", pin.get("pinStatus"));
        assertEquals("NONE", pin.get("recoveryReasonCode"));
        assertEquals(CODE, pin.get("contentCode"));
        assertEquals(versionId, ((Number) pin.get("contentVersionId")).longValue());
        assertEquals("snap_reading_" + versionId, pin.get("snapshotId"));
        assertEquals(pin.get("snapshotHash"), ContentPayloadHash.sha256(canonical(firstSnapshot)));
        List<Map<String, Object>> items = items(firstSnapshot);
        assertEquals(2, items.size());
        assertEquals(9L, ((Number) items.get(0).get("itemId")).longValue());
        assertEquals(2L, ((Number) items.get(1).get("itemId")).longValue());
        assertEquals(0, ((Number) items.get(0).get("displayOrder")).intValue());
        assertEquals("READING", items.get(0).get("itemType"));
        assertEquals("Second line", items.get(0).get("stem"));
        List<Map<String, Object>> options = list(items.get(0).get("options"));
        assertEquals(List.of("beta", "alpha"), List.of(options.get(0).get("optionId"), options.get(1).get("optionId")));
        Map<String, Object> rule = map(items.get(0).get("ruleContract"));
        Map<String, Object> otherRule = map(items.get(1).get("ruleContract"));
        String digest = String.valueOf(rule.get("ruleDigest"));
        String otherDigest = String.valueOf(otherRule.get("ruleDigest"));
        assertEquals(firstSnapshot.get("answerRuleSetVersion"), rule.get("answerRuleVersion"));
        assertEquals("DETERMINISTIC", rule.get("evaluationMode"));
        assertEquals(Boolean.TRUE, rule.get("sealed"));
        assertNotEquals(digest, otherDigest);
        assertEquals(hmac(seal, "item|" + versionId + "|9|beta"), digest);
        assertEquals(hmac(seal, "item|" + versionId + "|2|aye"), otherDigest);

        Map<String, Object> full = score(snapshots, assessment, versionId, CODE, 9L, "beta", pin, digest);
        Map<String, Object> zero = score(snapshots, assessment, versionId, CODE, 9L, "alpha", pin, digest);
        Map<String, Object> scoredAgain = score(snapshots, assessment, versionId, CODE, 9L, "beta", pin, digest);
        assertEquals(Set.of("itemId", "snapshotId", "ruleDigest", "outcome"), full.keySet());
        assertEquals("FULL", full.get("outcome"));
        assertEquals("ZERO", zero.get("outcome"));
        assertEquals(full, scoredAgain);
        assertEquals(digest, full.get("ruleDigest"));
        assertScoreHidden(full, zero, seal);

        Map<String, Object> wrongHash = new LinkedHashMap<>(pin);
        String snapshotHash = String.valueOf(pin.get("snapshotHash"));
        wrongHash.put("snapshotHash", snapshotHash.substring(0, 63) + (snapshotHash.charAt(63) == '0' ? '1' : '0'));
        ResponseStatusException mismatch = assertStatus(HttpStatus.CONFLICT,
                () -> score(snapshots, assessment, versionId, CODE, 9L, "beta", wrongHash, digest));
        assertFalse(String.valueOf(mismatch.getReason()).contains("beta"));
        assertStatus(HttpStatus.CONFLICT,
                () -> score(snapshots, assessment, versionId, CODE, 9L, "beta", pin, otherDigest));
        Map<String, Object> wrongId = new LinkedHashMap<>(pin);
        wrongId.put("snapshotId", "snap_reading.score.other-" + versionId);
        assertStatus(HttpStatus.CONFLICT,
                () -> score(snapshots, assessment, versionId, CODE, 9L, "beta", wrongId, digest));
        Map<String, Object> wrongCode = new LinkedHashMap<>(pin);
        wrongCode.put("contentCode", "reading.score.other");
        assertStatus(HttpStatus.CONFLICT,
                () -> score(snapshots, assessment, versionId, "reading.score.other", 9L, "beta", wrongCode, digest));
        assertStatus(HttpStatus.GONE,
                () -> score(snapshots, assessment, versionId, CODE, 99L, "beta", pin, digest));
        assertEquals(stable, footprint(versionId));
        assertEquals(0, reads.writes);

        long openVersionId = publishGradable(owner, OPEN, List.of("LEARNER", "PUBLIC"), "evidence-b10-open", "b10-open");
        ContentVersion open = version(OPEN);
        assertEquals(Set.of("LEARNER", "PUBLIC"), open.rights().orElseThrow().permittedChannels());
        assertFalse(open.rights().orElseThrow().permittedChannels().contains("SEALED"));
        assertFalse(open.rights().orElseThrow().permittedChannels().contains("ASSESSMENT"));
        assertTrue(open.rights().orElseThrow().allows(ContentChannel.LEARNER, Instant.now()));
        assertTrue(open.rights().orElseThrow().allows(ContentChannel.PUBLIC, Instant.now()));
        assertFalse(open.rights().orElseThrow().allows(ContentChannel.ASSESSMENT, Instant.now()));
        String openSeal = String.valueOf(open.payload().raw().get(GradableQuestions.SEAL_FIELD));
        assertOpenOwnerRead(openVersionId, openSeal);
        assertAssessmentDenied(snapshots, assessment, openVersionId);
        assertEquals(1, versions(CODE));
        assertEquals(1, versions(OPEN));

        command(owner, publisher, "UNPUBLISH", CODE, stateOf(CODE), null, "b10-unpublish-real-001", null);
        var archived = repository().findByCode(CODE).orElseThrow();
        assertTrue(archived.currentPublishedVersionId().isEmpty());
        assertEquals(ContentVersionStatus.ARCHIVED, archived.versions().getLast().status());
        assertStatus(HttpStatus.GONE, () -> snapshots.getB10AssessmentContentSnapshot(assessment, path));
        assertStatus(HttpStatus.GONE, () -> score(snapshots, assessment, versionId, CODE, 9L, "beta", pin, digest));
        assertEquals(ContentVersionStatus.PUBLISHED, version(OPEN).status());
        assertTrue(repository().findByCode(OPEN).orElseThrow().currentPublishedVersionId().isPresent());
        assertOpenOwnerRead(openVersionId, openSeal);
        assertAssessmentDenied(snapshots, assessment, openVersionId);
        assertEquals(outboxBaseline, count("SELECT COUNT(*) FROM content_outbox_event"));
    }

    private static long publishGradable(B9ContentAdminController owner, String code, List<String> channels,
                                         String evidence, String prefix) {
        command(owner, actor(EDITOR, "content:write"), "CREATE_DRAFT", code, 0L,
                readingDraft("Reading open probe", channels, evidence), prefix + "-create-000001", null);
        Map<String, Object> validated = command(owner, actor(EDITOR, "content:write"), "VALIDATE_DRAFT", code,
                stateOf(code), null, prefix + "-validate-0001", null);
        assertEquals(Boolean.TRUE, ((Map<?, ?>) validated.get("validationReport")).get("passed"));
        command(owner, actor(EDITOR, "content:write"), "SUBMIT_REVIEW", code, stateOf(code),
                null, prefix + "-submit-000001", null);
        command(owner, actor(FIRST, "content:review:first"), "REVIEW_FIRST", code, stateOf(code),
                null, prefix + "-review-l1-0001", "APPROVED");
        command(owner, actor(FINAL, "content:review:final"), "REVIEW_FINAL", code, stateOf(code),
                null, prefix + "-review-l2-0001", "APPROVED");
        Map<String, Object> published = command(owner, actor(PUBLISHER, "content:publish"), "PUBLISH", code,
                stateOf(code), null, prefix + "-publish-00001", null);
        ContentVersion version = version(code);
        assertEquals(ContentVersionStatus.PUBLISHED, version.status());
        assertEquals(Set.copyOf(channels), version.rights().orElseThrow().permittedChannels());
        assertEquals(4, Set.of(version.editor(), version.firstReviewer().orElseThrow(),
                version.finalReviewer().orElseThrow(), version.publisher().orElseThrow()).size());
        return ((Number) published.get("contentVersionId")).longValue();
    }

    private static void assertOpenOwnerRead(long versionId, String seal) throws Exception {
        ContentDefinition content = repository().findByCode(OPEN).orElseThrow();
        ContentVersion published = content.currentPublishedVersion().orElseThrow();
        assertEquals(ContentVersionStatus.PUBLISHED, published.status());
        assertEquals(versionId, published.versionId().value());
        assertEquals(versionId, content.currentPublishedVersionId().orElseThrow().value());
        ContentReadService ownerReads = new ContentReadService(
                repository(), new InMemoryPublicProjectionStore(), Clock.systemUTC());
        ContentActor learner = new ContentActor(
                "learner-b10", "platform", Set.of("learner"), Set.of("content.read"), false);
        PublicContentProjection learnerView = ownerReads.readByCode(
                OPEN, ContentAudience.LEARNER, ContentChannel.LEARNER, null, false, learner);
        PublicContentProjection publicView = ownerReads.readByCode(
                OPEN, ContentAudience.PUBLIC, ContentChannel.PUBLIC, null, false, null);
        assertEquals(ContentAudience.LEARNER, learnerView.audience());
        assertEquals(ContentAudience.PUBLIC, publicView.audience());
        for (PublicContentProjection view : List.of(learnerView, publicView)) {
            assertEquals(versionId, view.versionId().value());
            assertEquals("Reading open probe", view.title());
            assertFalse(view.containsAnswerRules());
            assertEquals("Synthetic reading", view.fields().get("summary"));
            Object rawItems = view.fields().get("items");
            assertTrue(rawItems instanceof List<?>);
            Object first = ((List<?>) rawItems).get(0);
            assertTrue(first instanceof Map<?, ?>);
            assertEquals("Read this short line.", ((Map<?, ?>) first).get("displayText"));
            assertFalse(view.fields().containsKey(GradableQuestions.FIELD));
            assertFalse(view.fields().containsKey(GradableQuestions.SEAL_FIELD));
            assertSafe(view.fields(), seal);
        }
    }

    /**
     * Protected assessment GET and score. The body names this version's
     * {@code snap_reading_<versionId>} and does not reuse another version pin.
     */
    private static void assertAssessmentDenied(GradableAssessmentSnapshotController snapshots,
                                                JwtAuthenticationToken assessment, long versionId) {
        String openPath = Long.toString(versionId);
        Map<String, Object> body = openScore(versionId);
        ResponseStatusException deniedGet = assertStatus(HttpStatus.FORBIDDEN,
                () -> snapshots.getB10AssessmentContentSnapshot(assessment, openPath));
        assertEquals("content rights are not active", deniedGet.getReason());
        ResponseStatusException deniedScore = assertStatus(HttpStatus.FORBIDDEN,
                () -> snapshots.scoreB10AssessmentContentSnapshot(assessment, openPath, body));
        assertEquals("content rights are not active", deniedScore.getReason());
    }

    private static Map<String, Object> openScore(long versionId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contentCode", OPEN);
        body.put("itemId", 9L);
        body.put("selectedOptionId", "beta");
        body.put("snapshotId", "snap_reading_" + versionId);
        body.put("snapshotHash", "ab".repeat(32));
        body.put("ruleDigest", "cd".repeat(32));
        return body;
    }

    private static void assertScoped(String key, String scope) {
        assertEquals(1, count(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key = ? AND scope = ?",
                key, scope));
        assertEquals(0, count(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key = ? AND scope <> ?",
                key, scope));
    }

    private static void assertStoredQuestion(ContentVersion version, int index, long itemId, String correct) {
        List<?> questions = (List<?>) version.payload().raw().get(GradableQuestions.FIELD);
        Map<?, ?> question = (Map<?, ?>) questions.get(index);
        assertEquals(itemId, ((Number) question.get("itemId")).longValue());
        assertEquals(correct, ((Map<?, ?>) question.get("answerRule")).get("correctOption"));
    }

    private static void assertSafe(Object body, String seal) throws Exception {
        assertFalse(hasRawField(body), "response contains a raw answer field");
        String json = mapper.writeValueAsString(body);
        assertFalse(json.contains(seal));
        assertFalse(json.contains("\"correctOption\""));
        assertFalse(json.contains("\"answerRule\""));
        assertFalse(json.contains("readingRuleSeal"));
        assertFalse(json.contains("\"selectedOptionId\""));
    }

    private static void assertScoreHidden(Map<String, Object> full, Map<String, Object> zero, String seal)
            throws Exception {
        assertFalse(hasRawField(full), "score contains a raw answer field");
        assertFalse(hasRawField(zero), "score contains a raw answer field");
        String json = mapper.writeValueAsString(Map.of("full", full, "zero", zero));
        assertFalse(json.contains(seal));
        for (String hidden : List.of("beta", "alpha", "aye", "nope", "Second line", "First line",
                "correctOption", "readingRuleSeal", "selectedOptionId")) {
            assertFalse(json.contains(hidden), "score contains hidden material");
        }
    }

    private static boolean hasRawField(Object node) {
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (RAW_FIELDS.contains(String.valueOf(entry.getKey())) || hasRawField(entry.getValue())) {
                    return true;
                }
            }
        } else if (node instanceof List<?> list) {
            for (Object item : list) {
                if (hasRawField(item)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Map<String, Object> canonical(Map<String, Object> data) {
        Map<String, Object> pin = map(data.get("pin"));
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("answerRuleSetVersion", data.get("answerRuleSetVersion"));
        canonical.put("contentCode", pin.get("contentCode"));
        canonical.put("contentEpoch", ((Number) pin.get("contentEpoch")).longValue());
        canonical.put("contentVersionId", ((Number) pin.get("contentVersionId")).longValue());
        canonical.put("items", data.get("items"));
        canonical.put("publishedAt", pin.get("pinnedAt"));
        canonical.put("snapshotId", pin.get("snapshotId"));
        return canonical;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(GradableAssessmentSnapshotController snapshots,
                                             JwtAuthenticationToken actor, long versionId) {
        return (Map<String, Object>) snapshots.getB10AssessmentContentSnapshot(
                actor, Long.toString(versionId)).get("data");
    }

    private static Map<String, Object> score(GradableAssessmentSnapshotController snapshots,
                                              JwtAuthenticationToken actor, long versionId, String code,
                                              long itemId, String selected, Map<String, Object> pin, String digest) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contentCode", code);
        body.put("itemId", itemId);
        body.put("selectedOptionId", selected);
        body.put("snapshotId", pin.get("snapshotId"));
        body.put("snapshotHash", pin.get("snapshotHash"));
        body.put("ruleDigest", digest);
        return snapshots.scoreB10AssessmentContentSnapshot(actor, Long.toString(versionId), body);
    }

    private static ResponseStatusException assertStatus(HttpStatus status, Runnable call) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, call::run);
        assertEquals(status, error.getStatusCode());
        return error;
    }

    private static void assertSameJson(Object fresh, Object replay) throws Exception {
        JsonNode left = mapper.readTree(mapper.writeValueAsString(fresh));
        JsonNode right = mapper.readTree(mapper.writeValueAsString(replay));
        assertEquals(left, right);
    }

    private static JdbcContentRepository repository() {
        return new JdbcContentRepository(jdbc, mapper, transaction);
    }

    private static B9ContentAdminController controller() {
        JdbcContentRepository store = repository();
        JdbcContentIdempotency idempotency = new JdbcContentIdempotency(
                jdbc, transaction, mapper, Clock.systemUTC());
        JdbcValidationReportStore reports = new JdbcValidationReportStore(jdbc, mapper);
        ContentCommandService commands = new ContentCommandService(store,
                new InMemoryContentOutbox(), idempotency, new InMemoryPublicProjectionStore(),
                new RecordingContentCacheInvalidator(), reports, Clock.systemUTC());
        ScheduledPublishService schedules = mock(ScheduledPublishService.class);
        when(schedules.listByPack(anyString(), anyInt(), any())).thenReturn(List.of());
        return new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), schedules, store,
                new VerifiedContentPrincipalFactory(), idempotency, reports);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> command(B9ContentAdminController controller, JwtAuthenticationToken actor,
                                                String operation, String code, long expected,
                                                Map<String, Object> draft, String key, String decision) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", expected);
        if (draft != null) {
            body.put("content", draft);
        }
        if (decision != null) {
            body.put("reviewDecision", decision);
        }
        ResponseEntity<Map<String, Object>> response = controller.command(body, actor, key, HEADERS);
        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        assertNotNull(response.getBody());
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        assertNotNull(data);
        assertFalse(hasRawField(data), "command receipt contains a raw answer field");
        return data;
    }

    private static ContentOperationException reject(B9ContentAdminController controller, JwtAuthenticationToken actor,
                                                     String operation, String code, long expected,
                                                     Map<String, Object> draft, String key, String decision) {
        return assertThrows(ContentOperationException.class,
                () -> command(controller, actor, operation, code, expected, draft, key, decision));
    }

    private static Map<String, Object> readingDraft(String title, List<String> channels, String evidence) {
        return readingDraft(title, channels, evidence, "Second line");
    }

    private static Map<String, Object> readingDraft(String title, List<String> channels, String evidence, String stem) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", title);
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "source-b10");
        result.put("licenseCode", "license-b10");
        result.put("permittedChannels", channels);
        result.put("authorizationEvidenceRef", evidence);
        result.put("allowsLearning", true);
        result.put("summary", "Synthetic reading");
        result.put("items", List.of(Map.of("displayText", "Read this short line.")));
        result.put("gradableQuestions", List.of(
                question(9L, stem, List.of(option("beta", "Bee"), option("alpha", "Aye")), "beta"),
                question(2L, "First line", List.of(option("aye", "Aye"), option("nope", "Nope")), "aye")));
        return result;
    }

    private static Map<String, Object> question(long itemId, String stem, List<Map<String, Object>> options,
                                                 String correct) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemId", itemId);
        result.put("stem", stem);
        result.put("options", options);
        result.put("answerRule", Map.of("correctOption", correct));
        return result;
    }

    private static Map<String, Object> option(String optionId, String label) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("optionId", optionId);
        result.put("label", label);
        return result;
    }

    private static ContentVersion version(String code) {
        return repository().findByCode(code).orElseThrow().versions().getLast();
    }

    private static long stateOf(String code) {
        return repository().findByCode(code).orElseThrow().stateVersion();
    }

    private static int versions(String code) {
        return count("""
                SELECT COUNT(*) FROM content_version v
                  JOIN content_definition c ON c.content_id = v.content_id
                 WHERE c.content_code = ?
                """, code);
    }

    private static String payloadHash(long versionId) {
        return jdbc.queryForObject(
                "SELECT payload_hash FROM content_version WHERE content_version_id = ?",
                String.class, versionId);
    }

    private static String footprint(long versionId) {
        String payload = jdbc.queryForObject(
                "SELECT payload_json FROM content_version WHERE content_version_id = ?",
                (resultSet, rowNumber) -> resultSet.getString("payload_json"), versionId);
        String row = jdbc.queryForObject("""
                SELECT CONCAT_WS(':', payload_hash, status, state_version, copyright_status,
                                  IF(archived_at IS NULL, '0', '1'))
                  FROM content_version WHERE content_version_id = ?
                """, String.class, versionId);
        return row + ":" + sha256(payload == null ? "" : payload)
                + "|" + count("SELECT COUNT(*) FROM content_version")
                + "|" + count("SELECT COUNT(*) FROM content_definition")
                + "|" + count("SELECT COUNT(*) FROM content_idempotency_record")
                + "|" + count("SELECT COUNT(*) FROM content_validation_report")
                + "|" + count("SELECT COUNT(*) FROM content_outbox_event");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failed) {
            throw new AssertionError("SHA-256 is required");
        }
    }

    private static JwtAuthenticationToken actor(String subject, String permission) {
        return token(subject, null, null, List.of(), List.of(permission), false);
    }

    private static JwtAuthenticationToken learner() {
        return token("learner-b10", "access", null, List.of("learner"), List.of("content.read"), true);
    }

    private static JwtAuthenticationToken service(String subject, String tokenType, String serviceId,
                                                   List<String> permissions) {
        return token(subject, tokenType, serviceId, List.of(), permissions, false);
    }

    private static JwtAuthenticationToken token(String subject, String tokenType, String serviceId,
                                                 List<String> roles, List<String> permissions, boolean learnerFacts) {
        Instant now = Instant.parse("2026-11-06T00:00:00Z");
        Jwt.Builder builder = Jwt.withTokenValue("synthetic-b10-token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (tokenType != null) {
            builder.claim("token_type", tokenType);
        }
        if (serviceId != null) {
            builder.claim("service_id", serviceId);
        }
        if (learnerFacts) {
            builder.claim("adult_gate", "PASSED").claim("consent_state", "GRANTED");
        }
        Jwt jwt = builder.build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private static String hmac(String seal, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(HexFormat.of().parseHex(seal), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> data) {
        return (List<Map<String, Object>>) data.get("items");
    }

    private static int count(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.intValue();
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new AssertionError(name + " is required");
        }
        return value;
    }

    private static String redacted(String summary, Throwable failed, String user, String password) {
        String detail = String.valueOf(failed.getMessage());
        if (user != null && !user.isEmpty()) {
            detail = detail.replace(user, "[account]");
        }
        if (password != null && !password.isEmpty()) {
            detail = detail.replace(password, "[secret]");
        }
        return summary + ": " + detail;
    }

    /** Snapshot JDBC. Reads go to the owner schema. A write fails the probe. */
    private static final class CountingJdbc extends JdbcTemplate {
        private int reads;
        private int writes;

        private CountingJdbc(DriverManagerDataSource dataSource) {
            super(dataSource);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            reads++;
            return super.queryForList(sql, args);
        }

        @Override
        public int update(String sql, Object... args) {
            writes++;
            throw new AssertionError("snapshot path must not write");
        }
    }
}
