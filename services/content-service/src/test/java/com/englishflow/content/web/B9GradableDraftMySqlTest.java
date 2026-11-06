package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcContentIdempotency;
import com.englishflow.content.adapter.jdbc.JdbcContentRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentProjectionPolicy;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Opt-in owner readback for one gradable draft. The editor token is synthetic;
 * this test never calls IAM, a publisher, or a broker.
 */
@EnabledIfSystemProperty(named = "content.gradableDraft.integration", matches = "true")
class B9GradableDraftMySqlTest {

    private static final Pattern SCHEMA_NAME = Pattern.compile("cs_mobile_gq_[a-f0-9]+");
    private static final Pattern OWNER_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]{0,31}");
    private static final String SCHEMA_ENV = "CONTENT_GRADABLE_DRAFT_SCHEMA";
    private static final String USER_ENV = "CONTENT_GRADABLE_DRAFT_USERNAME";
    private static final String PASSWORD_ENV = "CONTENT_GRADABLE_DRAFT_PASSWORD";
    private static final String JDBC_URL_PREFIX = "jdbc:mysql://127.0.0.1:13306/";

    private static JdbcTemplate jdbc;
    private static TransactionTemplate transaction;
    private static ObjectMapper mapper;

    @BeforeAll
    static void requireEmptyMysqlAndMigrateThroughV34() throws Exception {
        String schema = requiredEnv(SCHEMA_ENV).trim();
        String user = requiredEnv(USER_ENV).trim();
        String password = requiredEnv(PASSWORD_ENV);
        if (!SCHEMA_NAME.matcher(schema).matches()) {
            throw new AssertionError(SCHEMA_ENV + " must match cs_mobile_gq_[a-f0-9]+");
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
                throw new AssertionError("expected MySQL, got " + meta.getDatabaseProductName());
            }
            String reported = meta.getURL() == null ? "" : meta.getURL();
            if (!reported.startsWith(JDBC_URL_PREFIX + schema) || reported.contains("@")) {
                throw new AssertionError("connection must stay on " + JDBC_URL_PREFIX + schema);
            }
        }
        jdbc = new JdbcTemplate(dataSource);
        transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        mapper = new ObjectMapper();
        assertEquals(schema, jdbc.queryForObject("SELECT DATABASE()", String.class));
        int existing = jdbc.queryForList("SHOW TABLES").size();
        if (existing != 0) {
            throw new AssertionError("baseline schema must be empty before Flyway, found " + existing + " tables");
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
        assertEquals(1, count(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '34' AND success = 1"));
        assertEquals("34", jdbc.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = 1 "
                        + "ORDER BY installed_rank DESC LIMIT 1",
                String.class));
        assertEquals(0, count("SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0"));
    }

    @Test
    void ownerReadbackKeepsFirstPayloadAndReplaysTheDraft() throws Exception {
        String code = "gq-order-1";
        Map<String, Object> createdDraft = questions(List.of(
                question(20, "  Second stem  ", List.of(option("beta", "Bee"), option("alpha", "Aye")), "beta"),
                question(10L, "First stem", List.of(option("alpha", "Aye"), option("beta", "Bee")), "alpha")));
        Map<String, Object> created = command(controller(), "CREATE_DRAFT", code, 0L, null,
                createdDraft, "gq-create-order-0001");
        assertEquals(1, ((Number) created.get("stateVersion")).intValue());
        B9ContentAdminController other = controller();
        Map<String, Object> replay = command(other, "CREATE_DRAFT", code, 0L, null,
                createdDraft, "gq-create-order-0001");
        assertSameJson(created, replay);
        ContentOperationException changed = assertThrows(ContentOperationException.class,
                () -> command(other, "CREATE_DRAFT", code, 0L, null,
                        questions(List.of(question(20, "Different stem",
                                List.of(option("alpha", "Aye"), option("beta", "Bee")), "alpha"))),
                        "gq-create-order-0001"));
        assertEquals(409, changed.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", changed.code());

        ContentVersion first = version(code, 1);
        String firstHash = first.contentHash();
        assertOwnerQuestion(first, 0, 20L, "  Second stem  ", List.of("beta", "alpha"),
                List.of("Bee", "Aye"), "beta");
        assertOwnerQuestion(first, 1, 10L, "First stem", List.of("alpha", "beta"),
                List.of("Aye", "Bee"), "alpha");

        Map<String, Object> revised = questions(List.of(
                question(10L, "First stem", List.of(option("beta", "Bee"), option("alpha", "Aye")), "beta"),
                question(20, "  Second stem  ", List.of(option("alpha", "Aye"), option("beta", "Bee")), "alpha")));
        Map<String, Object> saved = command(controller(), "SAVE_DRAFT", code, 1L, 1,
                revised, "gq-save-order-000001");
        assertEquals(2, ((Number) saved.get("stateVersion")).intValue());
        Map<String, Object> savedReplay = command(controller(), "SAVE_DRAFT", code, 1L, 1,
                revised, "gq-save-order-000001");
        assertSameJson(saved, savedReplay);
        ContentOperationException saveConflict = assertThrows(ContentOperationException.class,
                () -> command(controller(), "SAVE_DRAFT", code, 1L, 1,
                        questions(List.of(question(10L, "Changed again",
                                List.of(option("alpha", "Aye"), option("beta", "Bee")), "alpha"))),
                        "gq-save-order-000001"));
        assertEquals(409, saveConflict.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", saveConflict.code());

        JdbcContentRepository fresh = repository();
        var stored = fresh.findByCode(code).orElseThrow();
        assertEquals(2, stored.versions().size());
        assertEquals(2, stored.stateVersion());
        ContentVersion reloadedFirst = stored.versions().getFirst();
        ContentVersion second = stored.versions().get(1);
        assertEquals(1, reloadedFirst.versionNumber());
        assertEquals(2, second.versionNumber());
        assertEquals(firstHash, reloadedFirst.contentHash());
        assertOwnerQuestion(reloadedFirst, 0, 20L, "  Second stem  ", List.of("beta", "alpha"),
                List.of("Bee", "Aye"), "beta");
        assertOwnerQuestion(reloadedFirst, 1, 10L, "First stem", List.of("alpha", "beta"),
                List.of("Aye", "Bee"), "alpha");
        assertOwnerQuestion(second, 0, 10L, "First stem", List.of("beta", "alpha"),
                List.of("Bee", "Aye"), "beta");
        assertOwnerQuestion(second, 1, 20L, "  Second stem  ", List.of("alpha", "beta"),
                List.of("Aye", "Bee"), "alpha");
        assertNotEquals(reloadedFirst.contentHash(), second.contentHash());
        Map<String, Object> detail = controller().get(code, editor(), new HttpHeaders()).getBody();
        assertNotNull(detail);
        assertNoAnswer(detail);
    }

    @Test
    void invalidOptInWritesNothingAndLegacyAbsenceStaysValid() {
        String rejected = "gq-invalid-1";
        String key = "gq-invalid-key-0001";
        int definitions = count("SELECT COUNT(*) FROM content_definition WHERE content_code = ?", rejected);
        int versions = count("SELECT COUNT(*) FROM content_version WHERE content_id = ?", rejected);
        int receipts = count(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key = ?", key);
        Map<String, Object> broken = draft();
        broken.put("gradableQuestions", List.of(question(4, "Stem",
                List.of(option("beta", "Bee"), option("alpha", "Aye")), "gamma")));
        ContentOperationException error = assertThrows(ContentOperationException.class,
                () -> command(controller(), "CREATE_DRAFT", rejected, 0L, null, broken, key));
        assertEquals(400, error.status());
        assertEquals("GRADABLE_QUESTIONS_INVALID", error.code());
        assertEquals(definitions, count(
                "SELECT COUNT(*) FROM content_definition WHERE content_code = ?", rejected));
        assertEquals(versions, count(
                "SELECT COUNT(*) FROM content_version WHERE content_id = ?", rejected));
        assertEquals(receipts, count(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key = ?", key));
        assertTrue(repository().findByCode(rejected).isEmpty());

        String code = "gq-legacy-1";
        command(controller(), "CREATE_DRAFT", code, 0L, null, draft(), "gq-legacy-key-00001");
        ContentVersion version = repository().findByCode(code).orElseThrow().versions().getFirst();
        assertEquals(Set.of("summary", "contentLocale", "targetLevel", "items"),
                Set.copyOf(version.payload().raw().keySet()));
        assertFalse(version.payload().raw().containsKey("gradableQuestions"));
        assertPendingDraft(version);
        assertEquals(ContentPayloadHash.sha256(version.payload().raw()), version.contentHash());
        assertEquals("Read this sentence.", ((Map<?, ?>) ((List<?>) version.payload().raw()
                .get("items")).getFirst()).get("displayText"));
        Map<String, Object> detail = controller().get(code, editor(), new HttpHeaders()).getBody();
        assertNotNull(detail);
        assertNoAnswer(detail);
        assertFalse(hasKey(detail, "gradableQuestions"));
    }

    /** Object key order is not significant. Array order and parsed number values are. */
    private static void assertSameJson(Object fresh, Object replay) throws Exception {
        JsonNode left = mapper.readTree(mapper.writeValueAsString(fresh));
        JsonNode right = mapper.readTree(mapper.writeValueAsString(replay));
        assertEquals(left, right);
    }

    private static ContentVersion version(String code, int number) {
        return repository().findByCode(code).orElseThrow().versions().stream()
                .filter(candidate -> candidate.versionNumber() == number)
                .findFirst()
                .orElseThrow();
    }

    private static void assertOwnerQuestion(ContentVersion version, int index, long itemId, String stem,
                                            List<String> optionIds, List<String> labels, String correct) {
        assertPendingDraft(version);
        assertEquals(ContentPayloadHash.sha256(version.payload().raw()), version.contentHash());
        assertEquals("Read this sentence.", ((Map<?, ?>) ((List<?>) version.payload().raw()
                .get("items")).getFirst()).get("displayText"));
        List<?> questions = (List<?>) version.payload().raw().get("gradableQuestions");
        Map<?, ?> question = (Map<?, ?>) questions.get(index);
        assertEquals(itemId, ((Number) question.get("itemId")).longValue());
        assertEquals(stem, question.get("stem"));
        List<?> options = (List<?>) question.get("options");
        assertEquals(optionIds.size(), options.size());
        for (int optionIndex = 0; optionIndex < optionIds.size(); optionIndex++) {
            Map<?, ?> option = (Map<?, ?>) options.get(optionIndex);
            assertEquals(optionIds.get(optionIndex), option.get("optionId"));
            assertEquals(labels.get(optionIndex), option.get("label"));
        }
        assertEquals(correct, ((Map<?, ?>) question.get("answerRule")).get("correctOption"));
    }

    private static void assertPendingDraft(ContentVersion version) {
        ContentRights rights = version.rights().orElseThrow();
        assertEquals(CopyrightStatus.PENDING, rights.status());
        assertFalse(rights.allowsLearning());
        assertEquals(Set.of(), rights.permittedChannels());
        assertEquals("SOURCE-GQ", rights.sourceCode());
        assertEquals("LICENSE-GQ", rights.licenseCode());
        assertNull(rights.authorizationEvidenceRef());
        assertEquals(ContentVersionStatus.DRAFT, version.status());
        assertEquals("editor-gq", version.editor());
        assertTrue(version.publisher().isEmpty());
    }

    private static void assertNoAnswer(Object node) {
        assertFalse(hasAnswer(node), "response contains an answer");
    }

    private static boolean hasAnswer(Object node) {
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (ContentProjectionPolicy.isAnswerRuleKey(key) || "correctOption".equals(key)) {
                    return true;
                }
                if (hasAnswer(entry.getValue())) {
                    return true;
                }
            }
        } else if (node instanceof List<?> list) {
            for (Object item : list) {
                if (hasAnswer(item)) {
                    return true;
                }
            }
        }
        return false;
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

    private static JdbcContentRepository repository() {
        return new JdbcContentRepository(jdbc, mapper, transaction);
    }

    private static B9ContentAdminController controller() {
        JdbcContentRepository store = repository();
        JdbcContentIdempotency idempotency = new JdbcContentIdempotency(
                jdbc, transaction, mapper, Clock.systemUTC());
        ContentCommandService commands = new ContentCommandService(store,
                new InMemoryContentOutbox(), idempotency, new InMemoryPublicProjectionStore(),
                new RecordingContentCacheInvalidator(), new InMemoryValidationReportStore(),
                Clock.systemUTC());
        ScheduledPublishService schedules = mock(ScheduledPublishService.class);
        when(schedules.listByPack(anyString(), anyInt(), any())).thenReturn(List.of());
        return new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), schedules, store,
                new VerifiedContentPrincipalFactory(), idempotency, new InMemoryValidationReportStore());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> command(B9ContentAdminController controller,
            String operation, String code, long expected, Integer target,
            Map<String, Object> draft, String key) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", expected);
        body.put("content", draft);
        if (target != null) {
            body.put("targetVersionNumber", target);
        }
        ResponseEntity<Map<String, Object>> response = controller.command(
                body, editor(), key, new HttpHeaders());
        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNoAnswer(response.getBody());
        return (Map<String, Object>) response.getBody().get("data");
    }

    private static Map<String, Object> questions(List<Map<String, Object>> questions) {
        Map<String, Object> result = draft();
        result.put("gradableQuestions", questions);
        return result;
    }

    private static Map<String, Object> draft() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Reading draft");
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "SOURCE-GQ");
        result.put("licenseCode", "LICENSE-GQ");
        result.put("summary", "Owner draft");
        result.put("items", List.of(Map.of("displayText", "Read this sentence.")));
        return result;
    }

    private static Map<String, Object> question(Object itemId, String stem,
                                                List<Map<String, Object>> options, String correct) {
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

    private static JwtAuthenticationToken editor() {
        Instant now = Instant.parse("2026-11-06T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("synthetic-test-token")
                .header("alg", "RS256")
                .subject("editor-gq")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of("content:write"))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), "editor-gq");
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
}
