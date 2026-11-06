package com.englishflow.learning.adapter.http;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Opt-in wire read of the actual {@link HttpAssessmentAttemptBindingPort} against fixed
 * Assessment {@code 127.0.0.1:18091}.
 *
 * <p>Root supplies one IAM-issued learning-service workload token and the one normal
 * G264-style attempt tuple, in the process environment or in an owner-only file under
 * {@code /tmp/grok-mobile-learning-attempt-binding-real-java-probe-281}. This class does
 * not mint a token, read a password, open Kafka, write a row, start a process, or choose
 * another origin. {@code 503} and a non-learning caller stay off this class: the port has
 * no distinct fact for them. See REPORT.md.
 */
@EnabledIfSystemProperty(named = "learning.binding.actual.http", matches = "true")
class LearningAssessmentBindingActualHttpTest {

    static final String ORIGIN = "http://127.0.0.1:18091";
    private static final Path ROOT = Path.of("/tmp/grok-mobile-learning-attempt-binding-real-java-probe-281");
    private static final int MAX_SUPPLY_BYTES = 4096;
    private static final String SERVICE = "learning-service";
    private static final String PERMISSION = "assessment:attempt-binding:read";
    private static final String ISSUER = "http://127.0.0.1:18087";
    private static final String AUDIENCE = "yuxuexing-api";
    private static final String PIN_SOURCE = "b10_assessment_session.started_at";
    private static final String OWNER = "assessment-service";
    private static final String FALLBACK_SNAPSHOT_PREFIX = "snap_assessment_";

    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9._~+/=-]{1,4096}$");
    private static final Pattern EVENT_ID = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern PRINCIPAL_ID = Pattern.compile(
            "^(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
    private static final Pattern ITEM_ID = Pattern.compile("^aitm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern LOGICAL_ID = Pattern.compile("^li_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern ATTEMPT_ID = Pattern.compile("^aatm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SNAPSHOT_ID = Pattern.compile("^snap_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern MYSQL_STARTED = Pattern.compile(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}$");
    private static final Set<String> TUPLE_KEYS = Set.of(
            "attemptId", "eventId", "learnerPrincipalId", "itemAssessmentId", "logicalItemId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash", "pinnedAt");
    private static final Set<String> SECRET_KEYS = Set.of(
            "password", "clientsecret", "accesstoken", "refreshtoken", "authorization", "bearer", "jwt");
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .build();

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    void currentReadIsCurrentAtTheSuppliedSnapshotAndTime() {
        Supplied supplied = supplied();
        HttpAssessmentAttemptBindingPort.Receipt receipt = port(supplied.token()).match(supplied.match());
        assertEquals(HttpAssessmentAttemptBindingPort.Reporting.CURRENT, receipt.reporting());
        assertEquals("platform", receipt.tenantId());
        assertEquals(PIN_SOURCE, receipt.pinSource());
        assertEquals(OWNER, receipt.owner());
        if (receipt.contentVersionId() != supplied.contentVersionId()
                || receipt.contentEpoch() != supplied.contentEpoch()
                || !receipt.snapshotId().equals(supplied.snapshotId())
                || !receipt.snapshotHash().equals(supplied.snapshotHash())
                || !receipt.pinnedAt().equals(supplied.pinnedAt())
                || !receipt.attemptId().equals(supplied.attemptId())
                || !receipt.itemAssessmentId().equals(supplied.itemAssessmentId())
                || !receipt.logicalItemId().equals(supplied.logicalItemId())
                || !receipt.learnerPrincipalId().equals(supplied.learnerPrincipalId())) {
            throw new AssertionError("wire read differed from the supplied pin");
        }
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    void crossOwnerIsAbsent() {
        Supplied supplied = supplied();
        String other = otherPrincipal(supplied.learnerPrincipalId());
        HttpAssessmentAttemptBindingPort.Refusal refusal = assertThrows(
                HttpAssessmentAttemptBindingPort.Refusal.class,
                () -> port(supplied.token()).match(supplied.matchPrincipal(other)));
        assertEquals(HttpAssessmentAttemptBindingPort.Kind.ABSENT, refusal.kind());
        assertNull(refusal.outcome());
        assertFalse(refusal.retryable());
        assertEquals("assessment attempt binding is absent", refusal.getMessage());
        closed(refusal);
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    void wrongPinIsPinMismatch() {
        Supplied supplied = supplied();
        String hash = otherHash(supplied.snapshotHash());
        HttpAssessmentAttemptBindingPort.Refusal refusal = assertThrows(
                HttpAssessmentAttemptBindingPort.Refusal.class,
                () -> port(supplied.token()).match(supplied.matchHash(hash)));
        assertEquals(HttpAssessmentAttemptBindingPort.Kind.CONFLICT, refusal.kind());
        assertEquals(HttpAssessmentAttemptBindingPort.Outcome.PIN_MISMATCH, refusal.outcome());
        assertFalse(refusal.retryable());
        assertEquals("assessment attempt binding conflicted", refusal.getMessage());
        closed(refusal);
    }

    private static HttpAssessmentAttemptBindingPort port(String token) {
        return new HttpAssessmentAttemptBindingPort(
                ORIGIN, () -> token, HttpAssessmentAttemptBindingPort.REQUEST_TIMEOUT_BOUND);
    }

    private static Supplied supplied() {
        return new Supplied(workloadToken(), tuple());
    }

    private static String workloadToken() {
        String env = System.getenv("LEARNING_BINDING_WORKLOAD_TOKEN");
        String path = System.getenv("LEARNING_BINDING_WORKLOAD_TOKEN_FILE");
        if (env != null && path != null) {
            throw precondition("learning workload token supply conflict");
        }
        final String raw;
        if (env != null) {
            if (env.isBlank()) throw precondition("learning workload token is absent");
            raw = env;
        } else if (path != null) {
            if (path.isBlank()) throw precondition("learning workload token is absent");
            raw = readBounded(path);
        } else {
            throw precondition("learning workload token is absent");
        }
        String token = oneLine(raw);
        if (!TOKEN.matcher(token).matches()) throw precondition("learning workload token is invalid");
        requireLearningWorkload(token);
        return token;
    }

    /** Claim shape only. The signature stays on Assessment; this method does not call IAM. */
    private static void requireLearningWorkload(String token) {
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isEmpty() || parts[1].isEmpty() || parts[2].isEmpty()) {
            throw precondition("learning workload token is not a jwt");
        }
        JsonNode header = jwtPart(parts[0]);
        JsonNode payload = jwtPart(parts[1]);
        if (header == null || payload == null) throw precondition("learning workload token is not a jwt");
        rejectSecrets(header);
        rejectSecrets(payload);
        if (!"RS256".equals(text(header.get("alg"))) || !"JWT".equals(text(header.get("typ")))) {
            throw precondition("learning workload token algorithm");
        }
        if (!SERVICE.equals(text(payload.get("sub")))
                || !SERVICE.equals(text(payload.get("service_id")))
                || !SERVICE.equals(text(payload.get("client_id")))
                || !"service".equals(text(payload.get("token_type")))
                || !"platform".equals(text(payload.get("tenant_id")))
                || !ISSUER.equals(text(payload.get("iss")))
                || !PERMISSION.equals(text(payload.get("scope")))) {
            throw precondition("learning workload token claims");
        }
        if (!audienceHas(payload.get("aud"), AUDIENCE)) {
            throw precondition("learning workload token audience");
        }
        JsonNode roles = payload.get("roles");
        JsonNode permissions = payload.get("permissions");
        if (roles == null || !roles.isArray() || roles.size() != 0
                || permissions == null || !permissions.isArray() || permissions.size() != 1
                || !PERMISSION.equals(text(permissions.get(0)))) {
            throw precondition("learning workload token permission");
        }
        if (present(payload.get("refresh_token")) || present(payload.get("session_id"))
                || present(payload.get("owner_id"))) {
            throw precondition("learning workload token claims");
        }
    }

    private static Attempt tuple() {
        String env = System.getenv("LEARNING_BINDING_TUPLE_JSON");
        String path = System.getenv("LEARNING_BINDING_TUPLE_FILE");
        if (env != null && path != null) throw precondition("attempt tuple supply conflict");
        final String raw;
        if (env != null) {
            if (env.isBlank()) throw precondition("attempt tuple is absent");
            if (env.length() > MAX_SUPPLY_BYTES) throw precondition("attempt tuple is closed");
            raw = env;
        } else if (path != null) {
            if (path.isBlank()) throw precondition("attempt tuple is absent");
            raw = readBounded(path);
        } else {
            throw precondition("attempt tuple is absent");
        }
        String body = raw.endsWith("\n") ? raw.substring(0, raw.length() - 1) : raw;
        if (body.indexOf('\0') >= 0) throw precondition("attempt tuple is closed");
        JsonNode root = object(tree(body));
        rejectSecrets(root);
        if (!names(root).equals(TUPLE_KEYS)) throw precondition("attempt tuple is closed");
        String attemptId = required(root.get("attemptId"), ATTEMPT_ID, "attemptId");
        String eventId = required(root.get("eventId"), EVENT_ID, "eventId");
        String principal = required(root.get("learnerPrincipalId"), PRINCIPAL_ID, "learnerPrincipalId");
        String itemId = required(root.get("itemAssessmentId"), ITEM_ID, "itemAssessmentId");
        String logicalId = required(root.get("logicalItemId"), LOGICAL_ID, "logicalItemId");
        String snapshotId = required(root.get("snapshotId"), SNAPSHOT_ID, "snapshotId");
        String snapshotHash = required(root.get("snapshotHash"), SHA256, "snapshotHash");
        if (snapshotId.startsWith(FALLBACK_SNAPSHOT_PREFIX)) {
            throw precondition("attempt tuple snapshot is a fallback pin");
        }
        Long version = exactLong(root.get("contentVersionId"), 1L);
        Long epoch = exactLong(root.get("contentEpoch"), 0L);
        if (version == null || epoch == null) throw precondition("attempt tuple pin is closed");
        Instant pinnedAt = pinnedAt(text(root.get("pinnedAt")));
        return new Attempt(attemptId, eventId, principal, itemId, logicalId, version, epoch,
                snapshotId, snapshotHash, pinnedAt);
    }

    private static Instant pinnedAt(String text) {
        if (text == null || text.length() < 20 || text.length() > 40) {
            throw precondition("attempt tuple pinnedAt is closed");
        }
        try {
            if (MYSQL_STARTED.matcher(text).matches()) {
                return LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);
            }
            if (!text.endsWith("Z")) throw precondition("attempt tuple pinnedAt is closed");
            return Instant.parse(text);
        } catch (DateTimeException failed) {
            throw precondition("attempt tuple pinnedAt is closed");
        }
    }

    private static String otherPrincipal(String current) {
        String next = "";
        for (int guard = 0; guard < 4; guard++) {
            next = UUID.randomUUID().toString();
            if (!next.equalsIgnoreCase(current) && PRINCIPAL_ID.matcher(next).matches()) return next;
        }
        throw precondition("cross owner principal was not distinct");
    }

    private static String otherHash(String hash) {
        int last = Character.digit(hash.charAt(hash.length() - 1), 16);
        if (last < 0) throw precondition("attempt tuple snapshotHash is closed");
        String next = hash.substring(0, hash.length() - 1) + Character.forDigit(last ^ 1, 16);
        if (next.equalsIgnoreCase(hash) || !SHA256.matcher(next).matches()) {
            throw precondition("attempt tuple snapshotHash is closed");
        }
        return next;
    }

    private static String readBounded(String raw) {
        Path listed = Path.of(raw);
        if (!listed.isAbsolute()) throw precondition("supply path is not absolute");
        Path normal = listed.normalize();
        if (!normal.startsWith(ROOT)) throw precondition("supply path is outside the bounded directory");
        try {
            if (Files.isSymbolicLink(listed)) throw precondition("supply path is a symlink");
            Path real = listed.toRealPath();
            if (!real.normalize().startsWith(ROOT) || !Files.isRegularFile(real)) {
                throw precondition("supply path is outside the bounded directory");
            }
            ownerOnly(real);
            long size = Files.size(real);
            if (size < 1 || size > MAX_SUPPLY_BYTES) throw precondition("supply file is closed");
            return Files.readString(real, StandardCharsets.UTF_8);
        } catch (IOException failed) {
            throw precondition("supply file is closed");
        }
    }

    private static void ownerOnly(Path path) throws IOException {
        Set<java.nio.file.attribute.PosixFilePermission> perms = Files.getPosixFilePermissions(path);
        for (java.nio.file.attribute.PosixFilePermission permission : perms) {
            switch (permission) {
                case OWNER_READ, OWNER_WRITE -> {
                }
                default -> throw precondition("supply file is not owner-only");
            }
        }
    }

    private static String oneLine(String raw) {
        String text = raw;
        if (text.endsWith("\n")) text = text.substring(0, text.length() - 1);
        if (text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0 || text.indexOf('\0') >= 0) {
            throw precondition("learning workload token is invalid");
        }
        return text;
    }

    private static JsonNode jwtPart(String part) {
        try {
            int pad = (4 - part.length() % 4) % 4;
            byte[] decoded = Base64.getUrlDecoder().decode(part + "====".substring(0, pad));
            if (decoded.length < 2 || decoded.length > MAX_SUPPLY_BYTES) return null;
            return object(tree(new String(decoded, StandardCharsets.UTF_8)));
        } catch (RuntimeException failed) {
            return null;
        }
    }

    private static boolean audienceHas(JsonNode node, String audience) {
        if (node == null) return false;
        if (node.isTextual()) return audience.equals(node.asText());
        if (!node.isArray() || node.size() < 1 || node.size() > 4) return false;
        boolean found = false;
        for (JsonNode value : node) {
            if (!value.isTextual()) return false;
            if (audience.equals(value.asText())) found = true;
        }
        return found;
    }

    private static JsonNode tree(String body) {
        try {
            return JSON.readTree(body);
        } catch (RuntimeException failed) {
            throw precondition("supply json is closed");
        }
    }

    private static JsonNode object(JsonNode node) {
        if (node == null || !node.isObject()) throw precondition("supply json is closed");
        return node;
    }

    private static Set<String> names(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            if (!names.add(entry.getKey())) throw precondition("supply json is closed");
        }
        return names;
    }

    private static String required(JsonNode node, Pattern pattern, String field) {
        String value = text(node);
        if (value == null || !pattern.matcher(value).matches()) {
            throw precondition("attempt tuple field is closed: " + field);
        }
        return value;
    }

    private static String text(JsonNode node) {
        if (node == null || !node.isTextual()) return null;
        return node.asText();
    }

    private static boolean present(JsonNode node) {
        return node != null && !node.isNull() && !node.isMissingNode();
    }

    private static Long exactLong(JsonNode node, long min) {
        if (node == null || node.isNull() || !node.isIntegralNumber() || !node.canConvertToLong()) return null;
        final long value;
        try {
            value = node.longValue();
        } catch (RuntimeException failed) {
            return null;
        }
        if (value < min) return null;
        return Long.valueOf(value);
    }

    private static void rejectSecrets(JsonNode node) {
        if (node == null || node.isNull() || node.isValueNode()) return;
        if (node.isArray()) {
            if (node.size() > 8) throw precondition("supply json is open");
            for (JsonNode child : node) rejectSecrets(child);
            return;
        }
        if (!node.isObject() || node.size() > 32) throw precondition("supply json is open");
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            if (SECRET_KEYS.contains(normalize(entry.getKey()))) {
                throw precondition("supply json carries a secret field");
            }
            rejectSecrets(entry.getValue());
        }
    }

    private static String normalize(String key) {
        StringBuilder out = new StringBuilder(key.length());
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (c >= 'A' && c <= 'Z') out.append((char) (c + 32));
            else if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out.append(c);
        }
        return out.toString();
    }

    private static void closed(HttpAssessmentAttemptBindingPort.Refusal refusal) {
        String message = refusal.getMessage();
        if (message == null || message.length() > 80 || message.indexOf('\n') >= 0 || message.indexOf('\r') >= 0) {
            throw new AssertionError("refusal message is open");
        }
        if (refusal.getCause() != null) throw new AssertionError("refusal cause is open");
    }

    private static AssertionError precondition(String fact) {
        return new AssertionError("unsatisfied source precondition: " + fact);
    }

    private record Attempt(String attemptId, String eventId, String learnerPrincipalId, String itemAssessmentId,
                           String logicalItemId, long contentVersionId, long contentEpoch, String snapshotId,
                           String snapshotHash, Instant pinnedAt) {
        @Override
        public String toString() {
            return "Attempt";
        }
    }

    private record Supplied(String token, Attempt attempt) {
        @Override
        public String toString() {
            return "Supplied";
        }

        private HttpAssessmentAttemptBindingPort.Match match() {
            return matchPrincipal(attempt.learnerPrincipalId());
        }

        private HttpAssessmentAttemptBindingPort.Match matchPrincipal(String principal) {
            return new HttpAssessmentAttemptBindingPort.Match(
                    attempt.attemptId(), attempt.eventId(), principal, attempt.itemAssessmentId(),
                    attempt.logicalItemId(), attempt.contentVersionId(), attempt.contentEpoch(),
                    attempt.snapshotId(), attempt.snapshotHash());
        }

        private HttpAssessmentAttemptBindingPort.Match matchHash(String hash) {
            return new HttpAssessmentAttemptBindingPort.Match(
                    attempt.attemptId(), attempt.eventId(), attempt.learnerPrincipalId(),
                    attempt.itemAssessmentId(), attempt.logicalItemId(), attempt.contentVersionId(),
                    attempt.contentEpoch(), attempt.snapshotId(), hash);
        }

        private String attemptId() {
            return attempt.attemptId();
        }

        private String learnerPrincipalId() {
            return attempt.learnerPrincipalId();
        }

        private String itemAssessmentId() {
            return attempt.itemAssessmentId();
        }

        private String logicalItemId() {
            return attempt.logicalItemId();
        }

        private long contentVersionId() {
            return attempt.contentVersionId();
        }

        private long contentEpoch() {
            return attempt.contentEpoch();
        }

        private String snapshotId() {
            return attempt.snapshotId();
        }

        private String snapshotHash() {
            return attempt.snapshotHash();
        }

        private Instant pinnedAt() {
            return attempt.pinnedAt();
        }
    }
}
