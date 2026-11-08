package com.englishflow.learning.web;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.Advised;
import org.springframework.aop.support.AopUtils;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in proof for one disposable MySQL. Normal test runs skip this class.
 * Enable with {@code -Dlearning.report-share.jdbc.integration=true} and
 * {@code LEARNING_FLYWAY_TEST_ADMIN_URL}, {@code LEARNING_FLYWAY_TEST_ADMIN_USER},
 * and {@code LEARNING_FLYWAY_TEST_ADMIN_PASSWORD}. There is no default database.
 *
 * <p>Revoke proof: a Spring CGLIB proxy applies {@code @Transactional} on
 * {@link B25LearningJdbcController#revokeReportShare}. Two calls use two
 * connections. An outer {@code TransactionTemplate} is not used.
 *
 * <p>Issue proof: the same proxy and the full Flyway chain, including V15.
 * The test holder gap-locks one absent idempotency key. Production issue does
 * not. Both proxied issues wait on that lock, then return the one stored row.
 */
@EnabledIfSystemProperty(named = "learning.report-share.jdbc.integration", matches = "true")
class ReportShareRevokeJdbcTest {

    static final String PROOF_SCOPE = "Spring CGLIB proxy; B25LearningJdbcController.revokeReportShare @Transactional; two JDBC connections";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String WAITING_LOCKS = """
            SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID)
              FROM performance_schema.data_lock_waits w
              JOIN performance_schema.data_locks requested
                ON requested.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
             WHERE requested.OBJECT_SCHEMA = ?
               AND requested.OBJECT_NAME = 'b25_learning_report_share'
               AND requested.LOCK_STATUS = 'WAITING'
               AND requested.LOCK_MODE LIKE 'X%'
            """;

    @Test
    void simultaneousForUpdateRevokePersistsOneMicrosecondTimestamp() throws Exception {
        String adminUrl = required("LEARNING_FLYWAY_TEST_ADMIN_URL");
        String adminUser = required("LEARNING_FLYWAY_TEST_ADMIN_USER");
        String adminPassword = required("LEARNING_FLYWAY_TEST_ADMIN_PASSWORD");
        String jdbcUrl = withUtc(adminUrl);
        String schema = "learning_report_share_jdbc_" + hex(8);
        assertTrue(schema.matches("learning_report_share_jdbc_[0-9a-f]{16}"));
        String ref = hex(16);
        String owner = "synthetic-owner-" + hex(8);
        String otherOwner = "synthetic-other-" + hex(8);
        assertTrue(ref.matches("[0-9a-f]{32}"));
        assertNotEquals(owner, otherOwner);

        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        ExecutorService pool = Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "report-share-revoke-jdbc");
            thread.setDaemon(true);
            return thread;
        });
        try {
            execute(jdbcUrl, adminUser, adminPassword, "CREATE DATABASE " + schema
                    + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            DriverManagerDataSource adminDataSource = new DriverManagerDataSource(jdbcUrl, adminUser, adminPassword);
            assertTrue(Flyway.configure()
                    .dataSource(adminDataSource)
                    .schemas(schema)
                    .createSchemas(false)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate()
                    .success);

            FixtureDataSource fixture = new FixtureDataSource(jdbcUrl, adminUser, adminPassword, schema);
            context.registerBean("dataSource", DataSource.class, () -> fixture);
            context.register(ReportShareRevokeProxyConfiguration.class);
            context.refresh();
            B25LearningJdbcController controller = context.getBean(B25LearningJdbcController.class);
            assertTrue(AopUtils.isCglibProxy(controller), PROOF_SCOPE);
            assertTrue(controller instanceof Advised, PROOF_SCOPE);
            assertTrue(Arrays.stream(((Advised) controller).getAdvisors())
                    .anyMatch(advisor -> advisor.getAdvice() instanceof TransactionInterceptor), PROOF_SCOPE);

            JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
            Number precision = jdbc.queryForObject("""
                    SELECT DATETIME_PRECISION
                      FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'b25_learning_report_share'
                       AND COLUMN_NAME = 'revoked_at'
                    """, Number.class, schema);
            assertEquals(6, precision.intValue());
            jdbc.update("""
                    INSERT INTO b25_learning_report_share
                        (share_ref, tenant_id, principal_id, report_type, snapshot_json, expires_at)
                    VALUES (?, 'platform', ?, 'DAILY', ?, ?)
                    """, ref, owner, "{\"availability\":\"EMPTY\",\"copy\":\"synthetic share\"}",
                    Timestamp.from(Instant.now().plus(Duration.ofDays(7)).truncatedTo(ChronoUnit.MICROS)));
            assertEquals(1, rowCount(jdbc));
            assertEquals("ascii_bin", jdbc.queryForObject("""
                    SELECT COLLATION_NAME
                      FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'b25_learning_report_share'
                       AND COLUMN_NAME = 'revoke_idempotency_key'
                    """, String.class, schema));

            CountDownLatch started = new CountDownLatch(2);
            Future<Map<String, Object>> left = null;
            Future<Map<String, Object>> right = null;
            String revokeKey = "revoke-share-key-" + hex(4);
            try (Connection holder = openHolder(jdbcUrl, adminUser, adminPassword, schema)) {
                lockShare(holder, ref, owner);
                left = pool.submit(() -> revoke(controller, owner, ref, revokeKey, started));
                right = pool.submit(() -> revoke(controller, owner, ref, revokeKey, started));
                assertTrue(started.await(3, TimeUnit.SECONDS), "both revoke calls must start");
                awaitTwoExclusiveRowLockWaits(jdbcUrl, adminUser, adminPassword, schema);
                holder.commit();
            }
            Map<String, Object> first = left.get(5, TimeUnit.SECONDS);
            Map<String, Object> second = right.get(5, TimeUnit.SECONDS);
            assertEquals(first, second);
            assertEquals(Set.of("ref", "status", "revokedAt"), first.keySet());
            assertEquals(ref, first.get("ref"));
            assertEquals("REVOKED", first.get("status"));

            String wall = jdbc.queryForObject("""
                    SELECT DATE_FORMAT(revoked_at, '%Y-%m-%d %H:%i:%s.%f')
                      FROM b25_learning_report_share
                     WHERE share_ref = ?
                    """, String.class, ref);
            assertTrue(wall.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{6}"), wall);
            Instant persisted = LocalDateTime.parse(wall.replace(' ', 'T')).toInstant(ZoneOffset.UTC);
            assertEquals(persisted.truncatedTo(ChronoUnit.MICROS), persisted);
            assertEquals(Integer.parseInt(wall.substring(wall.length() - 6)), persisted.getNano() / 1_000);
            assertEquals(persisted.toString(), first.get("revokedAt"));
            assertEquals(persisted.toString(), second.get("revokedAt"));

            ResponseStatusException hidden = assertThrows(ResponseStatusException.class,
                    () -> controller.revokeReportShare(authentication(otherOwner), ref, "other-revoke-key1"));
            assertEquals(HttpStatus.NOT_FOUND, hidden.getStatusCode());
            assertEquals("share not found", hidden.getReason());
            assertEquals(wall, storedWall(jdbc, ref));
            assertEquals(1, rowCount(jdbc));
            assertEquals(Map.of("status", "REVOKED"), controller.readReportShare(ref));
        } finally {
            pool.shutdownNow();
            try {
                pool.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
            context.close();
            execute(jdbcUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS " + schema);
        }
    }

    @Test
    void simultaneousIssueOfANewKeyReplaysThePersistedShare() throws Exception {
        String adminUrl = required("LEARNING_FLYWAY_TEST_ADMIN_URL");
        String adminUser = required("LEARNING_FLYWAY_TEST_ADMIN_USER");
        String adminPassword = required("LEARNING_FLYWAY_TEST_ADMIN_PASSWORD");
        String jdbcUrl = withUtc(adminUrl);
        assertFalse(jdbcUrl.contains("useAffectedRows=true"), "default Connector/J must report found rows");
        String schema = "learning_report_share_jdbc_" + hex(8);
        assertTrue(schema.matches("learning_report_share_jdbc_[0-9a-f]{16}"));
        String owner = "synthetic-owner-" + hex(8);
        String otherOwner = "synthetic-other-" + hex(8);
        String key = "race-share-key-" + hex(4);
        assertNotEquals(owner, otherOwner);

        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        ExecutorService pool = Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "report-share-issue-jdbc");
            thread.setDaemon(true);
            return thread;
        });
        try {
            execute(jdbcUrl, adminUser, adminPassword, "CREATE DATABASE " + schema
                    + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            DriverManagerDataSource adminDataSource = new DriverManagerDataSource(jdbcUrl, adminUser, adminPassword);
            assertTrue(Flyway.configure()
                    .dataSource(adminDataSource)
                    .schemas(schema)
                    .createSchemas(false)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate()
                    .success);

            FixtureDataSource fixture = new FixtureDataSource(jdbcUrl, adminUser, adminPassword, schema);
            context.registerBean("dataSource", DataSource.class, () -> fixture);
            context.register(ReportShareRevokeProxyConfiguration.class);
            context.refresh();
            B25LearningJdbcController controller = context.getBean(B25LearningJdbcController.class);
            assertTrue(AopUtils.isCglibProxy(controller));
            assertTrue(controller instanceof Advised);
            assertTrue(Arrays.stream(((Advised) controller).getAdvisors())
                    .anyMatch(advisor -> advisor.getAdvice() instanceof TransactionInterceptor));

            JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
            assertEquals("ascii_bin", jdbc.queryForObject("""
                    SELECT COLLATION_NAME
                      FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'b25_learning_report_share'
                       AND COLUMN_NAME = 'idempotency_key'
                    """, String.class, schema));
            Number idemIndex = jdbc.queryForObject("""
                    SELECT COUNT(*)
                      FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'b25_learning_report_share'
                       AND INDEX_NAME = 'uq_b25_learning_report_share_idem'
                       AND NON_UNIQUE = 0
                    """, Number.class, schema);
            assertEquals(3, idemIndex.intValue());

            CountDownLatch started = new CountDownLatch(2);
            Future<Map<String, Object>> left = null;
            Future<Map<String, Object>> right = null;
            try (Connection holder = openHolder(jdbcUrl, adminUser, adminPassword, schema)) {
                lockMissingKey(holder, owner, key);
                left = pool.submit(() -> issue(controller, owner, "DAILY", "2026-10-14", key, started));
                right = pool.submit(() -> issue(controller, owner, "DAILY", "2026-10-14", key, started));
                assertTrue(started.await(3, TimeUnit.SECONDS), "both issue calls must start");
                awaitTwoExclusiveRowLockWaits(jdbcUrl, adminUser, adminPassword, schema);
                holder.commit();
            }
            Map<String, Object> first = left.get(8, TimeUnit.SECONDS);
            Map<String, Object> second = right.get(8, TimeUnit.SECONDS);
            assertEquals(first, second);
            assertEquals(Set.of("ref", "expiresAt", "publicPath", "status"), first.keySet());
            assertEquals("ACTIVE", first.get("status"));
            String ref = String.valueOf(first.get("ref"));
            assertTrue(ref.matches("[0-9a-f]{32}"));
            assertEquals("/api/v1/public/learning/report-shares/" + ref, first.get("publicPath"));
            assertEquals(1, rowCount(jdbc));

            String[] winner = persistedShare(jdbc, owner, key);
            assertEquals(ref, winner[0]);
            assertEquals("DAILY|EXPLICIT|2026-10-14", winner[1]);
            assertTrue(winner[2].matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{6}"), winner[2]);
            Instant persisted = LocalDateTime.parse(winner[2].replace(' ', 'T')).toInstant(ZoneOffset.UTC);
            assertEquals(persisted.toString(), first.get("expiresAt"));
            assertEquals(persisted.toString(), second.get("expiresAt"));
            assertTrue(winner[3].contains("NEVER_STUDIED"));
            assertTrue(winner[3].contains("2026-10-14"));
            assertFalse(winner[3].contains(owner));

            Map<String, Object> view = controller.readReportShare(ref);
            assertEquals("ACTIVE", view.get("status"));
            assertEquals("NEVER_STUDIED", view.get("availability"));
            assertEquals("2026-10-14", view.get("periodStart"));
            assertFalse(view.containsKey("subject"));
            assertFalse(view.containsKey("token"));
            assertFalse(String.valueOf(view).contains(owner));

            String loser = hex(16);
            assertNotEquals(ref, loser);
            int affected = jdbc.update("""
                    INSERT INTO b25_learning_report_share
                        (share_ref, tenant_id, principal_id, report_type, snapshot_json, expires_at,
                         idempotency_key, request_binding)
                    VALUES (?, 'platform', ?, 'DAILY', ?, ?, ?, 'DAILY|EXPLICIT|2026-10-14')
                    ON DUPLICATE KEY UPDATE idempotency_key = idempotency_key
                    """, loser, owner, "{\"availability\":\"REPLACED\"}",
                    Timestamp.from(Instant.parse("2030-01-01T00:00:00Z")), key);
            assertEquals(1, affected);
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));

            Map<String, Object> replay = controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", key);
            assertEquals(first, replay);
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));

            ResponseStatusException weekly = assertThrows(ResponseStatusException.class,
                    () -> controller.issueReportShare(authentication(owner), "WEEKLY", "2026-10-14", key));
            assertEquals(HttpStatus.CONFLICT, weekly.getStatusCode());
            assertEquals("idempotency key was used for a different report share", weekly.getReason());
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));
            ResponseStatusException otherDay = assertThrows(ResponseStatusException.class,
                    () -> controller.issueReportShare(authentication(owner), "DAILY", "2026-10-12", key));
            assertEquals(HttpStatus.CONFLICT, otherDay.getStatusCode());
            assertEquals("idempotency key was used for a different report share", otherDay.getReason());
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));

            Map<String, Object> other = controller.issueReportShare(authentication(otherOwner), "DAILY", "2026-10-14", key);
            assertNotEquals(ref, other.get("ref"));
            assertEquals("ACTIVE", other.get("status"));
            assertEquals(String.valueOf(other.get("ref")), persistedShare(jdbc, otherOwner, key)[0]);
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));

            String lower = "case-share-key-" + hex(4);
            String upper = lower.toUpperCase(Locale.ROOT);
            assertNotEquals(lower, upper);
            Map<String, Object> lowerBody = controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", lower);
            Map<String, Object> upperBody = controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", upper);
            assertNotEquals(lowerBody.get("ref"), upperBody.get("ref"));
            assertEquals(String.valueOf(lowerBody.get("ref")), persistedShare(jdbc, owner, lower)[0]);
            assertEquals(String.valueOf(upperBody.get("ref")), persistedShare(jdbc, owner, upper)[0]);

            ResponseStatusException headerless = assertThrows(ResponseStatusException.class,
                    () -> controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", null));
            ResponseStatusException whitespace = assertThrows(ResponseStatusException.class,
                    () -> controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", "   "));
            assertEquals(HttpStatus.BAD_REQUEST, headerless.getStatusCode());
            assertEquals("Idempotency-Key is required", headerless.getReason());
            assertEquals(HttpStatus.BAD_REQUEST, whitespace.getStatusCode());
            assertEquals("Idempotency-Key is required", whitespace.getReason());
            Number nullKeys = jdbc.queryForObject("""
                    SELECT COUNT(*)
                      FROM b25_learning_report_share
                     WHERE principal_id = ? AND idempotency_key IS NULL
                    """, Number.class, owner);
            assertEquals(0, nullKeys.intValue());
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));
            assertEquals(4, rowCount(jdbc));

            Map<String, Object> revoked = controller.revokeReportShare(authentication(owner), ref, "revoke-share-key-" + hex(4));
            assertEquals(ref, revoked.get("ref"));
            assertEquals("REVOKED", revoked.get("status"));
            Map<String, Object> afterRevoke = controller.issueReportShare(authentication(owner), "DAILY", "2026-10-14", key);
            assertEquals(first, afterRevoke);
            assertEquals("ACTIVE", afterRevoke.get("status"));
            assertEquals(Map.of("status", "REVOKED"), controller.readReportShare(ref));
            assertArrayEquals(winner, persistedShare(jdbc, owner, key));
            Timestamp revokedAt = jdbc.queryForObject("""
                    SELECT revoked_at FROM b25_learning_report_share WHERE share_ref = ?
                    """, Timestamp.class, ref);
            assertEquals(revokedAt.toInstant().toString(), revoked.get("revokedAt"));
            assertEquals(4, rowCount(jdbc));
        } finally {
            pool.shutdownNow();
            try {
                pool.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
            context.close();
            execute(jdbcUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS " + schema);
        }
    }

    private static Map<String, Object> revoke(B25LearningJdbcController controller, String owner, String ref,
            String key, CountDownLatch started) {
        started.countDown();
        return controller.revokeReportShare(authentication(owner), ref, key);
    }

    private static Map<String, Object> issue(B25LearningJdbcController controller, String owner, String reportType,
            String date, String key, CountDownLatch started) {
        started.countDown();
        return controller.issueReportShare(authentication(owner), reportType, date, key);
    }

    private static void awaitTwoExclusiveRowLockWaits(String url, String user, String password, String schema)
            throws Exception {
        int observed = 0;
        for (int poll = 0; poll < 150; poll++) {
            observed = waitingExclusiveLocks(url, user, password, schema);
            if (observed == 2) {
                return;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("expected 2 simultaneous FOR UPDATE row-lock waits, observed " + observed);
    }

    private static int waitingExclusiveLocks(String url, String user, String password, String schema) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             PreparedStatement statement = connection.prepareStatement(WAITING_LOCKS)) {
            statement.setString(1, schema);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private static Connection openHolder(String url, String user, String password, String schema) throws SQLException {
        Connection connection = DriverManager.getConnection(url, user, password);
        try {
            connection.setAutoCommit(false);
            connection.setCatalog(schema);
            try (Statement statement = connection.createStatement()) {
                statement.execute("SET time_zone = '+00:00'");
            }
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }

    private static void lockShare(Connection connection, String ref, String owner) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT revoked_at
                  FROM b25_learning_report_share
                 WHERE share_ref = ? AND tenant_id = 'platform' AND principal_id = ?
                 FOR UPDATE
                """)) {
            statement.setString(1, ref);
            statement.setString(2, owner);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new AssertionError("seeded share row is missing");
                }
                if (result.getTimestamp(1) != null) {
                    throw new AssertionError("seeded share row is already revoked");
                }
            }
        }
    }

    /** Test gate only. Production issue does not lock a key before its insert. */
    private static void lockMissingKey(Connection connection, String owner, String key) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT idempotency_key
                  FROM b25_learning_report_share
                 WHERE tenant_id = 'platform' AND principal_id = ? AND idempotency_key = ?
                 FOR UPDATE
                """)) {
            statement.setString(1, owner);
            statement.setString(2, key);
            try (ResultSet result = statement.executeQuery()) {
                if (result.next()) {
                    throw new AssertionError("new idempotency key already has a row");
                }
            }
        }
    }

    private static String[] persistedShare(JdbcTemplate jdbc, String owner, String key) {
        List<String[]> rows = jdbc.query("""
                SELECT share_ref, request_binding,
                       DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s.%f'),
                       CAST(snapshot_json AS CHAR)
                  FROM b25_learning_report_share
                 WHERE tenant_id = 'platform' AND principal_id = ? AND idempotency_key = ?
                """, (rs, rowNum) -> new String[] {
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)
                }, owner, key);
        if (rows.size() != 1) {
            throw new AssertionError("expected one persisted share, observed " + rows.size());
        }
        return rows.get(0);
    }

    private static String storedWall(JdbcTemplate jdbc, String ref) {
        return jdbc.queryForObject("""
                SELECT DATE_FORMAT(revoked_at, '%Y-%m-%d %H:%i:%s.%f')
                  FROM b25_learning_report_share
                 WHERE share_ref = ?
                """, String.class, ref);
    }

    private static int rowCount(JdbcTemplate jdbc) {
        Number count = jdbc.queryForObject("SELECT COUNT(*) FROM b25_learning_report_share", Number.class);
        return count.intValue();
    }

    private static JwtAuthenticationToken authentication(String subject) {
        Instant now = Instant.parse("2026-11-05T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("synthetic-token")
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
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private static String withUtc(String url) {
        if (url.contains("connectionTimeZone=") || url.contains("serverTimezone=")) {
            return url;
        }
        return url + (url.contains("?") ? "&" : "?") + "connectionTimeZone=UTC&preserveInstants=true";
    }

    private static String hex(int bytes) {
        byte[] buffer = new byte[bytes];
        SECURE_RANDOM.nextBytes(buffer);
        return HexFormat.of().formatHex(buffer);
    }

    private static void execute(String url, String user, String password, String sql) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
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

    private static final class FixtureDataSource extends DriverManagerDataSource {
        private final String schema;

        private FixtureDataSource(String url, String user, String password, String schema) {
            super(url, user, password);
            this.schema = schema;
        }

        @Override
        public Connection getConnection() throws SQLException {
            return prepare(super.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            return prepare(super.getConnection(username, password));
        }

        private Connection prepare(Connection connection) throws SQLException {
            try {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("SET time_zone = '+00:00'");
                    statement.execute("SET innodb_lock_wait_timeout = 8");
                }
                connection.setCatalog(schema);
                return connection;
            } catch (SQLException exception) {
                connection.close();
                throw exception;
            }
        }
    }

    @Configuration
    @EnableTransactionManagement(proxyTargetClass = true)
    public static class ReportShareRevokeProxyConfiguration {
        @Bean
        public PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }

        @Bean
        public JdbcTemplate jdbcTemplate(DataSource dataSource) {
            return new JdbcTemplate(dataSource);
        }

        @Bean
        public B25LearningJdbcController b25LearningJdbcController(JdbcTemplate jdbcTemplate) {
            return new B25LearningJdbcController(jdbcTemplate);
        }
    }
}
