package com.englishflow.assessment.web;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import com.englishflow.assessment.domain.AttemptGuard;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in proof that a B10 pin time is the session's stored {@code started_at}.
 *
 * <p>The class stays skipped unless {@code assessment.pin.mysql} is {@code true}. It opens only
 * {@code jdbc:mysql://127.0.0.1:13306/} for a pre-created {@code asm_pin_[a-f0-9]+} schema and the
 * dedicated account in the environment. It does not create or drop a schema. A non-empty schema is
 * rejected before the real Flyway migrations, which must apply V12. Assertion text omits the
 * account, the password, the grader prompt, and the grader answer.
 */
@EnabledIfSystemProperty(named = "assessment.pin.mysql", matches = "true")
class B10AssessmentPinMySqlTest {

    private static final String ENDPOINT = "jdbc:mysql://127.0.0.1:13306/";
    private static final String CONTENT_CODE = "course-b25-basics";
    private static final long CONTENT_VERSION = 25001L;
    private static final long CONTENT_EPOCH = 1L;
    private static final long SNAPSHOT_ID = 25001L;
    private static final String SNAPSHOT_HASH = "0000000000000000000000000000000000000000000000000000000000000001";
    private static final String ITEM_ID = "pinmysql0001";
    private static final String CREATE_KEY = "pin-mysql-create";
    private static final String SUBMIT_KEY = "pin-mysql-submit";
    private static final String SUBJECT = "prn_pinmysql00000001";
    private static final Instant FRACTIONAL_PROBE = Instant.parse("2026-11-06T00:00:00.123456Z");
    private static final DateTimeFormatter WALL = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSSSSS")
            .withZone(ZoneOffset.UTC);
    private static final List<String> VERSIONS = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12");

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void pinnedAtEqualsStoredSessionStartAcrossCreateReadReplayAttemptAndReport() {
        String schema = dedicatedSchema(required("ASSESSMENT_PIN_TEST_SCHEMA"));
        String user = required("ASSESSMENT_PIN_TEST_USER");
        String password = required("ASSESSMENT_PIN_TEST_PASSWORD");
        String url = url(schema);
        DriverManagerDataSource dataSource = new DriverManagerDataSource(url, user, password);
        assertEquals(url, dataSource.getUrl());
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        TransactionTemplate transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        transactions.setTimeout(30);

        assertFixedEndpoint(jdbc, schema);
        assertUtcSession(jdbc);
        assertEmpty(jdbc);
        assertFractionalConnector(jdbc);
        migrate(dataSource, schema);
        assertMigratedThroughV12(jdbc);
        insertLocalGraderItem(jdbc);

        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(
                jdbc, mapper, "http://127.0.0.1:18089");
        JwtAuthenticationToken principal = syntheticPrincipal();
        Map<String, Object> request = Map.of(
                "contentCode", CONTENT_CODE,
                "contentVersionId", CONTENT_VERSION,
                "mode", "PRACTICE",
                "clientSessionRef", CREATE_KEY);

        Map<String, Object> created = owner(transactions, () -> controller.createSession(
                principal, request, CREATE_KEY, null));
        String sessionId = id(data(created), "sessionId", "asess_");
        Instant startedAt = readStartedAt(jdbc, sessionId);
        Map<String, Object> stored = sessionIdentity(jdbc, sessionId);
        assertLocalPinRow(stored);
        assertSessionPin(data(created), stored, startedAt);

        Map<String, Object> read = owner(transactions, () -> controller.readSession(principal, sessionId));
        assertEquals(sessionId, id(data(read), "sessionId", "asess_"));
        assertSessionPin(data(read), stored, startedAt);

        Map<String, Object> replay = owner(transactions, () -> controller.createSession(
                principal, request, CREATE_KEY, null));
        assertEquals(sessionId, id(data(replay), "sessionId", "asess_"));
        assertSessionPin(data(replay), stored, startedAt);
        assertEquals(1L, count(jdbc, "b10_assessment_session"));
        assertEquals(0L, count(jdbc, "b10_assessment_attempt"));
        assertEquals(0L, count(jdbc, "b10_assessment_report"));

        Object itemId = itemId(data(created));
        Map<String, Object> submission = Map.of(
                "submissionId", "pinmysqlsub0001",
                "expectedStateVersion", 1,
                "items", List.of(Map.of("itemId", itemId, "response", Map.of("selectedOptionKey", "k"))));
        Map<String, Object> attempt = owner(transactions, () -> controller.submitAttempt(
                principal, sessionId, submission, SUBMIT_KEY, null, null));
        Map<String, Object> attemptData = data(attempt);
        assertEquals(sessionId, id(attemptData, "sessionId", "asess_"));
        String attemptId = id(attemptData, "attemptId", "aatm_");
        String reportId = id(attemptData, "reportId", "rpt_");
        assertPin(pin(attemptData), stored, startedAt);

        Map<String, Object> report = owner(transactions, () -> controller.readReport(principal, reportId));
        Map<String, Object> reportData = data(report);
        assertEquals(reportId, id(reportData, "reportId", "rpt_"));
        assertEquals(attemptId, id(reportData, "attemptId", "aatm_"));
        assertPin(pin(reportData), stored, startedAt);
        assertPin(storedReportPin(jdbc, reportId, sessionId, attemptId), stored, startedAt);

        assertEquals(startedAt, readStartedAt(jdbc, sessionId));
        assertLocalPinRow(sessionIdentity(jdbc, sessionId));
        assertEquals(1L, count(jdbc, "b10_assessment_session"));
        assertEquals(1L, count(jdbc, "b10_assessment_attempt"));
        assertEquals(1L, count(jdbc, "b10_assessment_report"));
        assertEquals(1L, count(jdbc, "b25_assessment_item_rule"));
        assertEquals(0L, count(jdbc, "assessment_mistake"));
    }

    private static void assertSessionPin(Map<String, Object> body, Map<String, Object> stored, Instant startedAt) {
        assertPin(pin(body), stored, startedAt);
        assertRenderedInstant(body.get("startedAt"), startedAt);
    }

    private static void assertPin(Map<String, Object> pin, Map<String, Object> stored, Instant startedAt) {
        assertEquals(String.valueOf(stored.get("content_code")), pin.get("contentCode"));
        assertNumber(pin.get("contentVersionId"), stored.get("content_version_id"));
        assertNumber(pin.get("contentEpoch"), stored.get("content_epoch"));
        assertNumber(pin.get("snapshotId"), stored.get("snapshot_id"));
        assertEquals(String.valueOf(stored.get("snapshot_hash")), pin.get("snapshotHash"));
        assertEquals("PINNED", pin.get("pinStatus"));
        assertEquals(AttemptGuard.pinnedRuleVersion(CONTENT_CODE, CONTENT_VERSION), pin.get("ruleVersion"));
        if (!(pin.get("pinnedAt") instanceof String)) {
            throw new AssertionError("pinnedAt is not text");
        }
        assertEquals(startedAt.toString(), pin.get("pinnedAt"));
        assertTrue(pin.get("contentVersionId") instanceof Number);
        assertTrue(pin.get("contentEpoch") instanceof Number);
        assertTrue(pin.get("snapshotId") instanceof Number);
        assertFalse(pin.containsKey("alternativeContentVersionId"));
        assertFalse(pin.containsKey("alternativeContentCode"));
        assertFalse(pin.containsKey("alternativeReasonCode"));
    }

    private static void assertLocalPinRow(Map<String, Object> stored) {
        assertEquals(CONTENT_CODE, stored.get("content_code"));
        assertEquals(CONTENT_VERSION, ((Number) stored.get("content_version_id")).longValue());
        assertEquals(CONTENT_EPOCH, ((Number) stored.get("content_epoch")).longValue());
        assertEquals(SNAPSHOT_ID, ((Number) stored.get("snapshot_id")).longValue());
        assertEquals(SNAPSHOT_HASH, stored.get("snapshot_hash"));
        if (stored.get("alternative_content_version_id") != null) {
            throw new AssertionError("local grader session stored a substitute pin");
        }
    }

    private static void assertNumber(Object pinValue, Object storedValue) {
        if (!(pinValue instanceof Number actual) || !(storedValue instanceof Number expected)) {
            throw new AssertionError("pin numeric identity is not a number");
        }
        assertEquals(expected.longValue(), actual.longValue());
    }

    private static void assertRenderedInstant(Object rendered, Instant startedAt) {
        if (!(rendered instanceof String text) || text.isBlank()) {
            throw new AssertionError("rendered session start is missing");
        }
        Instant parsed;
        try {
            parsed = text.endsWith("Z")
                    ? Instant.parse(text)
                    : LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);
        } catch (DateTimeException ex) {
            throw new AssertionError("rendered session start is not a UTC instant");
        }
        assertEquals(startedAt, parsed);
    }

    private Instant readStartedAt(JdbcTemplate jdbc, String sessionId) {
        ClockReading reading = readClock(jdbc, """
                SELECT started_at,
                       DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s.%f'),
                       TIMESTAMPDIFF(MICROSECOND, '1970-01-01 00:00:00.000000', started_at)
                  FROM b10_assessment_session
                 WHERE session_id = ?
                """, sessionId);
        return absoluteInstant(reading);
    }

    private void assertFractionalConnector(JdbcTemplate jdbc) {
        ClockReading reading = readClock(jdbc, """
                SELECT CAST('2026-11-06 00:00:00.123456' AS DATETIME(6)),
                       DATE_FORMAT(CAST('2026-11-06 00:00:00.123456' AS DATETIME(6)), '%Y-%m-%d %H:%i:%s.%f'),
                       TIMESTAMPDIFF(MICROSECOND, '1970-01-01 00:00:00.000000',
                           CAST('2026-11-06 00:00:00.123456' AS DATETIME(6)))
                """);
        Instant instant = absoluteInstant(reading);
        assertEquals(FRACTIONAL_PROBE, instant);
        assertEquals(123_456_000, instant.getNano());
    }

    private static Instant absoluteInstant(ClockReading reading) {
        Instant absolute = Instant.EPOCH.plus(reading.epochUs(), ChronoUnit.MICROS);
        Instant driver = driverInstant(reading.raw());
        if (!absolute.equals(driver)) {
            throw new AssertionError("connector instant does not match UTC microseconds");
        }
        if (absolute.getNano() != Integer.parseInt(fraction(reading.wall())) * 1_000L) {
            throw new AssertionError("connector fractional precision does not match stored microseconds");
        }
        if (!WALL.format(absolute).equals(reading.wall())) {
            throw new AssertionError("stored wall clock is not the configured UTC instant");
        }
        return absolute;
    }

    private static Instant driverInstant(Object raw) {
        if (raw instanceof Timestamp timestamp) {
            if (timestamp.getNanos() % 1_000 != 0) {
                throw new AssertionError("connector fractional precision is not microseconds");
            }
            return timestamp.toInstant();
        }
        if (raw instanceof LocalDateTime localDateTime) {
            if (localDateTime.getNano() % 1_000 != 0) {
                throw new AssertionError("connector fractional precision is not microseconds");
            }
            return localDateTime.toInstant(ZoneOffset.UTC);
        }
        throw new AssertionError("connector value is not a fractional timestamp");
    }

    private static String fraction(String wall) {
        if (wall == null || !wall.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{6}")) {
            throw new AssertionError("fractional UTC wall clock is missing");
        }
        return wall.substring(wall.length() - 6);
    }

    private static ClockReading readClock(JdbcTemplate jdbc, String sql, Object... args) {
        ClockReading reading = jdbc.query(sql, rs -> {
            if (!rs.next()) {
                throw new AssertionError("UTC clock row is missing");
            }
            Object raw = rs.getObject(1);
            String wall = rs.getString(2);
            long epochUs = rs.getLong(3);
            boolean missingEpoch = rs.wasNull();
            if (rs.next()) {
                throw new AssertionError("UTC clock row is duplicated");
            }
            if (raw == null || wall == null || missingEpoch) {
                throw new AssertionError("UTC clock value is missing");
            }
            return new ClockReading(raw, wall, epochUs);
        }, args);
        if (reading == null) {
            throw new AssertionError("UTC clock row is missing");
        }
        return reading;
    }

    private static void assertFixedEndpoint(JdbcTemplate jdbc, String schema) {
        try {
            jdbc.execute((ConnectionCallback<Void>) connection -> {
                String reported = connection.getMetaData().getURL();
                String prefix = ENDPOINT + schema;
                if (reported == null || !(reported.equals(prefix) || reported.startsWith(prefix + "?"))
                        || reported.contains("@") || reported.contains("localhost")) {
                    throw new AssertionError("connection is not the fixed assessment MySQL endpoint");
                }
                if (!schema.equals(connection.getCatalog())) {
                    throw new AssertionError("connection catalog is not the dedicated schema");
                }
                return null;
            });
        } catch (DataAccessException ex) {
            throw new AssertionError("dedicated pin schema connection was rejected");
        }
        String database = jdbc.queryForObject("SELECT DATABASE()", String.class);
        if (!schema.equals(database)) {
            throw new AssertionError("connection database is not the dedicated schema");
        }
    }

    private static void assertUtcSession(JdbcTemplate jdbc) {
        String zone = jdbc.queryForObject("SELECT @@session.time_zone", String.class);
        if (!"UTC".equals(zone) && !"+00:00".equals(zone)) {
            throw new AssertionError("session time zone is not UTC");
        }
    }

    private static void assertEmpty(JdbcTemplate jdbc) {
        if (!jdbc.queryForList("SHOW FULL TABLES").isEmpty()) {
            throw new AssertionError("dedicated schema is not empty");
        }
    }

    private static void migrate(DataSource dataSource, String schema) {
        var result = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(false)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        if (!result.success || result.migrationsExecuted < 12) {
            throw new AssertionError("Flyway did not apply real migrations through V12");
        }
    }

    private static void assertMigratedThroughV12(JdbcTemplate jdbc) {
        List<String> versions = jdbc.query("""
                SELECT version FROM flyway_schema_history
                 WHERE success = 1 AND version IS NOT NULL
                 ORDER BY installed_rank
                """, (rs, rowNum) -> rs.getString(1));
        if (versions.size() < VERSIONS.size() || !versions.subList(0, VERSIONS.size()).equals(VERSIONS)) {
            throw new AssertionError("Flyway did not apply real migrations V1 through V12");
        }
        assertEquals(0L, countRows(jdbc, "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0"));
        String script = jdbc.queryForObject(
                "SELECT script FROM flyway_schema_history WHERE version = '12' AND success = 1", String.class);
        if (!"V12__persist_bank_owner_snapshot_ref.sql".equals(script)) {
            throw new AssertionError("Flyway V12 script is not the owner snapshot migration");
        }
        List<Map<String, Object>> column = jdbc.queryForList(
                "SHOW COLUMNS FROM b10_assessment_session LIKE 'owner_snapshot_ref'");
        if (column.size() != 1) {
            throw new AssertionError("Flyway V12 owner snapshot column is missing");
        }
    }

    private static void insertLocalGraderItem(JdbcTemplate jdbc) {
        assertEquals(0L, count(jdbc, "b25_assessment_item_rule"));
        jdbc.update("""
                INSERT INTO b25_assessment_item_rule
                    (item_id, content_code, content_version_id, prompt, options_json, dimension,
                     difficulty, answer_rule_json, active)
                VALUES (?, ?, ?, ?, ?, 'VOCABULARY', 1, ?, TRUE)
                """, ITEM_ID, CONTENT_CODE, CONTENT_VERSION, "local-pin",
                "[{\"key\":\"k\",\"text\":\"local\"}]", "{\"answer\":\"k\"}");
        assertEquals(1L, count(jdbc, "b25_assessment_item_rule"));
    }

    private Map<String, Object> storedReportPin(JdbcTemplate jdbc, String reportId, String sessionId,
            String attemptId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT session_id, attempt_id, pin_json
                  FROM b10_assessment_report
                 WHERE report_id = ?
                """, reportId);
        if (!sessionId.equals(String.valueOf(row.get("session_id")))
                || !attemptId.equals(String.valueOf(row.get("attempt_id")))) {
            throw new AssertionError("stored report does not match the new attempt");
        }
        return parsePin(row.get("pin_json"));
    }

    private Map<String, Object> parsePin(Object raw) {
        try {
            String json = raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(raw);
            Object parsed = mapper.readValue(json, Object.class);
            if (!(parsed instanceof Map<?, ?> map)) {
                throw new AssertionError("stored report pin is unreadable");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> pin = (Map<String, Object>) map;
            return pin;
        } catch (AssertionError failure) {
            throw failure;
        } catch (Exception ex) {
            throw new AssertionError("stored report pin is unreadable");
        }
    }

    private static Map<String, Object> sessionIdentity(JdbcTemplate jdbc, String sessionId) {
        return jdbc.queryForMap("""
                SELECT content_code, content_version_id, content_epoch, snapshot_id, snapshot_hash,
                       alternative_content_version_id
                  FROM b10_assessment_session
                 WHERE session_id = ?
                """, sessionId);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        Object value = envelope.get("data");
        if (!(value instanceof Map<?, ?> map)) {
            throw new AssertionError("assessment envelope is missing");
        }
        return (Map<String, Object>) map;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> pin(Map<String, Object> body) {
        Object value = body.get("pin");
        if (!(value instanceof Map<?, ?> map)) {
            throw new AssertionError("assessment pin is missing");
        }
        return (Map<String, Object>) map;
    }

    private static Object itemId(Map<String, Object> body) {
        Object items = body.get("items");
        if (!(items instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> item)) {
            throw new AssertionError("session item id is missing");
        }
        Object itemId = item.get("itemId");
        if (!(itemId instanceof Number) || ((Number) itemId).longValue() <= 0L) {
            throw new AssertionError("session item id is missing");
        }
        return itemId;
    }

    private static String id(Map<String, Object> body, String key, String prefix) {
        Object value = body.get(key);
        if (!(value instanceof String text) || !text.startsWith(prefix) || text.length() <= prefix.length()) {
            throw new AssertionError(key + " is missing");
        }
        return text;
    }

    private static long count(JdbcTemplate jdbc, String table) {
        if (!table.matches("[a-z0-9_]+")) {
            throw new AssertionError("table name is invalid");
        }
        return countRows(jdbc, "SELECT COUNT(*) FROM `" + table + "`");
    }

    private static long countRows(JdbcTemplate jdbc, String sql) {
        Long count = jdbc.queryForObject(sql, Long.class);
        return count == null ? 0L : count;
    }

    private static <T> T owner(TransactionTemplate transactions, java.util.function.Supplier<T> work) {
        T value = transactions.execute(status -> {
            if (!TransactionSynchronizationManager.isActualTransactionActive() || !status.isNewTransaction()) {
                throw new IllegalStateException("owner transaction is not active");
            }
            return work.get();
        });
        if (value == null) {
            throw new AssertionError("owner transaction returned no result");
        }
        return value;
    }

    private static JwtAuthenticationToken syntheticPrincipal() {
        Jwt jwt = Jwt.withTokenValue("synthetic-in-process")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-11-06T00:00:00Z"))
                .expiresAt(Instant.parse("2026-11-06T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write", "assessment.session.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private static String url(String schema) {
        return ENDPOINT + schema
                + "?useUnicode=true"
                + "&characterEncoding=utf8"
                + "&useSSL=false"
                + "&serverTimezone=UTC"
                + "&connectionTimeZone=UTC"
                + "&forceConnectionTimeZoneToSession=true"
                + "&preserveInstants=true"
                + "&sendFractionalSeconds=true"
                + "&connectTimeout=5000"
                + "&socketTimeout=30000";
    }

    private static String dedicatedSchema(String value) {
        if (value.length() > 64 || !value.matches("asm_pin_[a-f0-9]+")) {
            throw new AssertionError("ASSESSMENT_PIN_TEST_SCHEMA is not a dedicated asm_pin schema");
        }
        return value;
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            value = System.getProperty(name);
        }
        if (value == null || value.isBlank()) {
            throw new AssertionError(name + " is required");
        }
        return value;
    }

    private record ClockReading(Object raw, String wall, long epochUs) {
    }
}
