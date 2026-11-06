package com.englishflow.learning.adapter.http;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Learning-side read of {@code matchB10AssessmentAttemptBinding}.
 *
 * <p>One POST to {@code /internal/v1/assessment/attempts/{attemptId}/binding} on a fixed
 * assessment origin. The workload token comes only from the injected provider. This type
 * does not read {@link BearerTokens}, does not register a listener, and does not retry.
 * A 503 or a transport timeout, including a body that misses the deadline, is {@link Kind#TRANSIENT}.
 * {@code pinnedAt} is accepted only as {@link Instant#toString()} of the owner session start.
 */
public final class HttpAssessmentAttemptBindingPort {
    /** Closed classification. Only {@link Kind#TRANSIENT} is retryable, and this client does not retry. */
    public enum Kind {
        DENIED,
        ABSENT,
        CONFLICT,
        TRANSIENT,
        INVALID
    }

    /** Owner 409 machine codes. Any other conflict body fails closed. */
    public enum Outcome {
        PIN_SUBSTITUTED,
        ITEM_IDENTITY_ABSENT,
        EVIDENCE_REUSED,
        PIN_MISMATCH,
        FALLBACK_PIN,
        REPORT_PIN_ABSENT
    }

    /** Report receipt class. The receipt itself is not returned. */
    public enum Reporting {
        CURRENT,
        HISTORICAL
    }

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    static final Duration REQUEST_TIMEOUT_BOUND = Duration.ofSeconds(5);
    private static final int MAX_BODY_BYTES = 8192;
    private static final int MAX_REQUEST_CHARS = 4096;
    private static final String TENANT = "platform";
    private static final String OWNER = "assessment-service";
    private static final String PIN_SOURCE = "b10_assessment_session.started_at";
    private static final String FALLBACK_SNAPSHOT_PREFIX = "snap_assessment_";
    private static final Pattern EVENT_ID = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern PRINCIPAL_ID = Pattern.compile(
            "^(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
    private static final Pattern ITEM_ID = Pattern.compile("^aitm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern LOGICAL_ID = Pattern.compile("^li_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern ATTEMPT_ID = Pattern.compile("^aatm_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SNAPSHOT_ID = Pattern.compile("^snap_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9._~+/=-]{1,4096}$");
    private static final Set<String> REQUEST_KEYS = Set.of(
            "eventId", "learnerPrincipalId", "itemAssessmentId", "logicalItemId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash");
    private static final Set<String> ENVELOPE_KEYS = Set.of("data");
    private static final Set<String> DATA_KEYS = Set.of(
            "attemptId", "itemAssessmentId", "logicalItemId", "learnerPrincipalId", "tenantId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash", "pinnedAt",
            "pinSource", "reporting", "owner");
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "answer", "answers", "outcome", "score", "quality", "rawquality", "objectiveoutcome",
            "guesssignal", "scorebucket", "contentcode", "correctoption", "correctanswer",
            "answerrule", "rule", "rules", "mistake", "mistakes", "mastery", "repair",
            "authorization", "bearer", "token", "password", "jwt", "clientsecret", "accesstoken",
            "selectedoption", "rawanswer", "payload", "dedupekey", "eventname", "raw");
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .build();

    private final HttpClient http;
    private final String origin;
    private final Supplier<String> workloadToken;
    private final Duration timeout;

    public HttpAssessmentAttemptBindingPort(String assessmentBaseUrl, Supplier<String> workloadToken,
                                            Duration timeout) {
        this(assessmentBaseUrl, workloadToken, timeout, defaultClient());
    }

    /**
     * Injected client for the loopback fixture. Redirects, cookies, authenticators, and proxies
     * are rejected. The per-request timeout is positive, at most 5s, and covers headers and body.
     */
    public HttpAssessmentAttemptBindingPort(String assessmentBaseUrl, Supplier<String> workloadToken,
                                            Duration timeout, HttpClient http) {
        if (http == null || workloadToken == null) {
            throw new IllegalArgumentException("assessment binding transport is incomplete");
        }
        if (http.followRedirects() != HttpClient.Redirect.NEVER
                || http.cookieHandler().isPresent()
                || http.authenticator().isPresent()
                || http.proxy().isPresent()) {
            throw new IllegalArgumentException("assessment binding transport does not forward calls");
        }
        this.http = http;
        this.origin = trustedOrigin(assessmentBaseUrl);
        this.workloadToken = workloadToken;
        Duration requested = timeout == null || timeout.isNegative() || timeout.isZero()
                ? REQUEST_TIMEOUT_BOUND : timeout;
        this.timeout = requested.compareTo(REQUEST_TIMEOUT_BOUND) > 0 ? REQUEST_TIMEOUT_BOUND : requested;
    }

    /** POST the closed tuple and return only the closed owner receipt. */
    public Receipt match(Match request) {
        if (!valid(request)) throw invalidRequest();
        String token = workloadToken();
        String json = requestJson(request);
        HttpResponse<Loaded> response = send(endpoint(request.attemptId()), token, json);
        return classify(request, response);
    }

    Duration requestTimeout() {
        return timeout;
    }

    boolean redirectsDisabled() {
        return http.followRedirects() == HttpClient.Redirect.NEVER
                && http.cookieHandler().isEmpty()
                && http.authenticator().isEmpty()
                && http.proxy().isEmpty();
    }

    private Receipt classify(Match request, HttpResponse<Loaded> response) {
        int status = response.statusCode();
        Loaded loaded = response.body();
        if (loaded == null) {
            return finish(request, status, response.headers(), new byte[0]);
        }
        if (status == 401 || status == 403) throw denied();
        if (status == 404) throw absent();
        if (status == 503) throw transientFailure();
        if (status >= 300 && status < 400) throw redirectRefused();
        if (status != 200 && status != 409) throw invalidPayload();
        if (loaded.oversized() || !bounded(response.headers()) || !jsonMedia(response.headers())) {
            throw invalidPayload();
        }
        return finish(request, status, response.headers(), loaded.bytes());
    }

    private Receipt finish(Match request, int status, HttpHeaders headers, byte[] body) {
        if (status == 401 || status == 403) throw denied();
        if (status == 404) throw absent();
        if (status == 503) throw transientFailure();
        if (status >= 300 && status < 400) throw redirectRefused();
        if (status == 409) {
            if (!jsonMedia(headers)) throw invalidPayload();
            throw conflict(body);
        }
        if (status != 200 || !jsonMedia(headers)) throw invalidPayload();
        return receipt(request, body);
    }

    private HttpResponse<Loaded> send(URI uri, String token, String json) {
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
        } catch (IllegalArgumentException failed) {
            throw invalidToken();
        }
        LimitedBody body = new LimitedBody();
        CompletableFuture<HttpResponse<Loaded>> pending = null;
        try {
            pending = http.sendAsync(request, body::forResponse);
            return pending.get(timeout.toNanos(), TimeUnit.NANOSECONDS);
        } catch (TimeoutException timedOut) {
            boolean tooBig = body.overLimit();
            cancelExchange(pending, body);
            if (tooBig) throw invalidPayload();
            throw transientFailure();
        } catch (InterruptedException interrupted) {
            cancelExchange(pending, body);
            Thread.currentThread().interrupt();
            throw transientFailure();
        } catch (ExecutionException failed) {
            boolean tooBig = body.overLimit();
            cancelExchange(pending, body);
            if (failed.getCause() instanceof InterruptedException) {
                Thread.currentThread().interrupt();
                throw transientFailure();
            }
            if (tooBig) throw invalidPayload();
            throw transientFailure();
        } catch (CancellationException cancelled) {
            boolean tooBig = body.overLimit();
            cancelExchange(pending, body);
            if (tooBig) throw invalidPayload();
            throw transientFailure();
        } catch (RuntimeException failed) {
            boolean tooBig = body.overLimit();
            cancelExchange(pending, body);
            if (tooBig) throw invalidPayload();
            throw transientFailure();
        }
    }

    /** Stops the exchange. The refusal stays a fixed sentence with no body, cause, or credential. */
    private static void cancelExchange(CompletableFuture<?> pending, LimitedBody body) {
        if (body != null) body.cancel();
        if (pending != null) pending.cancel(true);
    }

    private Receipt receipt(Match request, byte[] body) {
        JsonNode root = object(tree(utf8(body)));
        rejectSensitive(root);
        if (!names(root).equals(ENVELOPE_KEYS)) throw invalidPayload();
        JsonNode data = object(root.get("data"));
        rejectSensitive(data);
        if (!names(data).equals(DATA_KEYS)) throw invalidPayload();
        String attemptId = required(data.get("attemptId"), ATTEMPT_ID);
        String itemId = required(data.get("itemAssessmentId"), ITEM_ID);
        String logicalId = required(data.get("logicalItemId"), LOGICAL_ID);
        String principalId = required(data.get("learnerPrincipalId"), PRINCIPAL_ID);
        String tenantId = required(data.get("tenantId"), Pattern.compile("^platform$"));
        String snapshotId = required(data.get("snapshotId"), SNAPSHOT_ID);
        String snapshotHash = required(data.get("snapshotHash"), SHA256);
        Long version = exactLong(data.get("contentVersionId"), 1L, Long.MAX_VALUE);
        Long epoch = exactLong(data.get("contentEpoch"), 0L, Long.MAX_VALUE);
        Instant pinnedAt = canonicalPinnedAt(data.get("pinnedAt"));
        String pinSource = required(data.get("pinSource"), Pattern.compile("^b10_assessment_session\\.started_at$"));
        String owner = required(data.get("owner"), Pattern.compile("^assessment-service$"));
        Reporting reporting = reporting(data.get("reporting"));
        if (version == null || epoch == null
                || snapshotId.startsWith(FALLBACK_SNAPSHOT_PREFIX)
                || !request.attemptId().equals(attemptId)
                || !request.itemAssessmentId().equals(itemId)
                || !request.logicalItemId().equals(logicalId)
                || !request.learnerPrincipalId().equals(principalId)
                || request.contentVersionId() != version.longValue()
                || request.contentEpoch() != epoch.longValue()
                || !request.snapshotId().equals(snapshotId)
                || !request.snapshotHash().equals(snapshotHash)
                || !TENANT.equals(tenantId)
                || !PIN_SOURCE.equals(pinSource)
                || !OWNER.equals(owner)) {
            throw invalidPayload();
        }
        return new Receipt(attemptId, itemId, logicalId, principalId, tenantId, version, epoch,
                snapshotId, snapshotHash, pinnedAt, pinSource, reporting, owner);
    }

    private Refusal conflict(byte[] body) {
        JsonNode root = object(tree(utf8(body)));
        rejectSensitive(root);
        Set<String> keys = names(root);
        if (!(keys.equals(Set.of("code")) || keys.equals(Set.of("code", "message")))) throw invalidPayload();
        Outcome outcome = outcome(text(root.get("code")));
        if (outcome == null) throw invalidPayload();
        if (keys.contains("message")) {
            String message = text(root.get("message"));
            if (message == null || message.isBlank() || message.length() > 160 || controls(message)) {
                throw invalidPayload();
            }
            Outcome echoed = outcome(message);
            if (echoed != null && echoed != outcome) throw invalidPayload();
        }
        return conflicted(outcome);
    }

    private String requestJson(Match match) {
        String json = "{\"eventId\":\"" + match.eventId()
                + "\",\"learnerPrincipalId\":\"" + match.learnerPrincipalId()
                + "\",\"itemAssessmentId\":\"" + match.itemAssessmentId()
                + "\",\"logicalItemId\":\"" + match.logicalItemId()
                + "\",\"contentVersionId\":" + Long.toString(match.contentVersionId())
                + ",\"contentEpoch\":" + Long.toString(match.contentEpoch())
                + ",\"snapshotId\":\"" + match.snapshotId()
                + "\",\"snapshotHash\":\"" + match.snapshotHash()
                + "\"}";
        if (json.length() > MAX_REQUEST_CHARS) throw invalidRequest();
        JsonNode node = object(tree(json));
        Long version = exactLong(node.get("contentVersionId"), 1L, Long.MAX_VALUE);
        Long epoch = exactLong(node.get("contentEpoch"), 0L, Long.MAX_VALUE);
        if (!names(node).equals(REQUEST_KEYS)
                || version == null || epoch == null
                || version.longValue() != match.contentVersionId()
                || epoch.longValue() != match.contentEpoch()
                || !match.eventId().equals(text(node.get("eventId")))
                || !match.learnerPrincipalId().equals(text(node.get("learnerPrincipalId")))
                || !match.itemAssessmentId().equals(text(node.get("itemAssessmentId")))
                || !match.logicalItemId().equals(text(node.get("logicalItemId")))
                || !match.snapshotId().equals(text(node.get("snapshotId")))
                || !match.snapshotHash().equals(text(node.get("snapshotHash")))) {
            throw invalidRequest();
        }
        return json;
    }

    private String workloadToken() {
        final String token;
        try {
            token = workloadToken.get();
        } catch (RuntimeException failed) {
            throw missingToken();
        }
        if (token == null || token.isBlank()) throw missingToken();
        if (!TOKEN.matcher(token).matches()) throw invalidToken();
        return token;
    }

    private URI endpoint(String attemptId) {
        try {
            return URI.create(origin + "/internal/v1/assessment/attempts/" + attemptId + "/binding");
        } catch (IllegalArgumentException failed) {
            throw invalidRequest();
        }
    }

    private static boolean valid(Match request) {
        if (request == null) return false;
        return textMatches(request.attemptId(), ATTEMPT_ID)
                && textMatches(request.eventId(), EVENT_ID)
                && textMatches(request.learnerPrincipalId(), PRINCIPAL_ID)
                && textMatches(request.itemAssessmentId(), ITEM_ID)
                && textMatches(request.logicalItemId(), LOGICAL_ID)
                && request.contentVersionId() >= 1L
                && request.contentEpoch() >= 0L
                && textMatches(request.snapshotId(), SNAPSHOT_ID)
                && textMatches(request.snapshotHash(), SHA256);
    }

    private static boolean textMatches(String value, Pattern pattern) {
        return value != null && pattern.matcher(value).matches();
    }

    private static Reporting reporting(JsonNode node) {
        String value = text(node);
        if ("CURRENT".equals(value)) return Reporting.CURRENT;
        if ("HISTORICAL".equals(value)) return Reporting.HISTORICAL;
        throw invalidPayload();
    }

    private static Outcome outcome(String code) {
        if (code == null) return null;
        return switch (code) {
            case "PIN_SUBSTITUTED" -> Outcome.PIN_SUBSTITUTED;
            case "ITEM_IDENTITY_ABSENT" -> Outcome.ITEM_IDENTITY_ABSENT;
            case "EVIDENCE_REUSED" -> Outcome.EVIDENCE_REUSED;
            case "PIN_MISMATCH" -> Outcome.PIN_MISMATCH;
            case "FALLBACK_PIN" -> Outcome.FALLBACK_PIN;
            case "REPORT_PIN_ABSENT" -> Outcome.REPORT_PIN_ABSENT;
            default -> null;
        };
    }

    private static Instant canonicalPinnedAt(JsonNode node) {
        String text = text(node);
        if (text == null || text.length() < 20 || text.length() > 30) throw invalidPayload();
        final Instant instant;
        try {
            instant = Instant.parse(text);
        } catch (DateTimeException failed) {
            throw invalidPayload();
        }
        if (!text.equals(instant.toString())) throw invalidPayload();
        return instant;
    }

    private static JsonNode tree(String body) {
        try {
            return JSON.readTree(body);
        } catch (RuntimeException failed) {
            return null;
        }
    }

    private static JsonNode object(JsonNode node) {
        if (node == null || !node.isObject()) throw invalidPayload();
        return node;
    }

    private static Set<String> names(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            if (!(entry.getKey() instanceof String key) || !names.add(key)) throw invalidPayload();
        }
        return names;
    }

    private static String required(JsonNode node, Pattern pattern) {
        String value = text(node);
        if (value == null || !pattern.matcher(value).matches()) throw invalidPayload();
        return value;
    }

    private static String text(JsonNode node) {
        if (node == null || !node.isTextual()) return null;
        return node.asText();
    }

    /** Int64 field. Floats, strings, and values outside {@code long} are not convertible. */
    private static Long exactLong(JsonNode node, long min, long max) {
        if (node == null || node.isNull() || !node.isIntegralNumber() || !node.canConvertToLong()) return null;
        final long value;
        try {
            value = node.longValue();
        } catch (RuntimeException failed) {
            return null;
        }
        if (value < min || value > max) return null;
        return Long.valueOf(value);
    }

    private static void rejectSensitive(JsonNode node) {
        if (node == null || node.isValueNode() || node.isNull()) return;
        if (node.isArray()) {
            for (JsonNode child : node) rejectSensitive(child);
            return;
        }
        if (!node.isObject()) throw invalidPayload();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            if (SENSITIVE_KEYS.contains(normalize(entry.getKey()))) throw invalidPayload();
            rejectSensitive(entry.getValue());
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

    private static boolean controls(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c <= 0x1f || c == 0x7f) return true;
        }
        return false;
    }

    /** Numeric Content-Length above the cap. Absent or malformed lengths stay on {@link #bounded}. */
    private static boolean exceedsDeclaredBody(HttpHeaders headers) {
        Long length = declaredLength(headers);
        return length != null && length.longValue() > MAX_BODY_BYTES;
    }

    private static Long declaredLength(HttpHeaders headers) {
        List<String> values = headers.allValues("content-length");
        if (values.size() != 1) return null;
        String raw = values.get(0);
        if (raw == null) return null;
        String text = raw.trim();
        if (text.isEmpty() || text.length() > 18) return null;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c < '0' || c > '9') return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException failed) {
            return null;
        }
    }

    private static boolean bounded(HttpHeaders headers) {
        List<String> values = headers.allValues("content-length");
        if (values.isEmpty()) return true;
        Long length = declaredLength(headers);
        return length != null && length.longValue() <= MAX_BODY_BYTES;
    }

    private static boolean jsonMedia(HttpHeaders headers) {
        List<String> types = headers.allValues("content-type");
        if (types.size() != 1) return false;
        String header = types.get(0);
        if (header == null || header.length() > 128 || controls(header)) return false;
        String[] parts = header.split(";");
        if (!"application/json".equalsIgnoreCase(parts[0].trim())) return false;
        for (int i = 1; i < parts.length; i++) {
            String param = parts[i].trim();
            int eq = param.indexOf('=');
            if (eq < 1) return false;
            String name = param.substring(0, eq).trim();
            String value = param.substring(eq + 1).trim();
            if (value.length() >= 2 && value.charAt(0) == '"' && value.charAt(value.length() - 1) == '"') {
                value = value.substring(1, value.length() - 1);
            }
            if (!"charset".equalsIgnoreCase(name) || !"utf-8".equalsIgnoreCase(value)) return false;
        }
        return true;
    }

    private static String utf8(byte[] body) {
        try {
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(body)).toString();
        } catch (CharacterCodingException failed) {
            throw invalidPayload();
        }
    }

    private static String trustedOrigin(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("assessment binding base url is required");
        }
        String candidate = raw;
        while (candidate.endsWith("/")) candidate = candidate.substring(0, candidate.length() - 1);
        if (candidate.isEmpty()) throw new IllegalArgumentException("assessment binding base url is invalid");
        for (int i = 0; i < candidate.length(); i++) {
            char c = candidate.charAt(i);
            if (c <= 0x20 || c >= 0x7f || c == '\\' || c == '@') {
                throw new IllegalArgumentException("assessment binding base url is invalid");
            }
        }
        final URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException failed) {
            throw new IllegalArgumentException("assessment binding base url is invalid");
        }
        String scheme = uri.getScheme();
        String path = uri.getPath();
        if ((!"http".equals(scheme) && !"https".equals(scheme))
                || uri.getUserInfo() != null
                || uri.getHost() == null
                || uri.getHost().isBlank()
                || uri.getQuery() != null
                || uri.getFragment() != null
                || uri.getPort() == 0
                || (path != null && !path.isEmpty())) {
            throw new IllegalArgumentException("assessment binding base url is invalid");
        }
        return candidate;
    }

    private static HttpClient defaultClient() {
        return HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    private static Refusal denied() {
        return new Refusal(Kind.DENIED, null, "assessment attempt binding was denied");
    }

    private static Refusal absent() {
        return new Refusal(Kind.ABSENT, null, "assessment attempt binding is absent");
    }

    private static Refusal conflicted(Outcome outcome) {
        return new Refusal(Kind.CONFLICT, outcome, "assessment attempt binding conflicted");
    }

    private static Refusal transientFailure() {
        return new Refusal(Kind.TRANSIENT, null, "assessment attempt binding transport failed");
    }

    private static Refusal redirectRefused() {
        return new Refusal(Kind.INVALID, null, "assessment attempt binding redirect was refused");
    }

    private static Refusal invalidPayload() {
        return new Refusal(Kind.INVALID, null, "assessment attempt binding payload is invalid");
    }

    private static Refusal invalidRequest() {
        return new Refusal(Kind.INVALID, null, "assessment attempt binding request is invalid");
    }

    private static Refusal missingToken() {
        return new Refusal(Kind.INVALID, null, "assessment attempt binding workload token is missing");
    }

    private static Refusal invalidToken() {
        return new Refusal(Kind.INVALID, null, "assessment attempt binding workload token is invalid");
    }

    /** Closed request tuple copied from the admitted event. Unknown fields have no setter. */
    public record Match(String attemptId, String eventId, String learnerPrincipalId, String itemAssessmentId,
                        String logicalItemId, long contentVersionId, long contentEpoch, String snapshotId,
                        String snapshotHash) {
    }

    /** Closed owner receipt. {@code pinnedAt} is the canonical session-start instant. */
    public record Receipt(String attemptId, String itemAssessmentId, String logicalItemId,
                          String learnerPrincipalId, String tenantId, long contentVersionId, long contentEpoch,
                          String snapshotId, String snapshotHash, Instant pinnedAt, String pinSource,
                          Reporting reporting, String owner) {
    }

    public static final class Refusal extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final Kind kind;
        private final Outcome outcome;

        private Refusal(Kind kind, Outcome outcome, String message) {
            super(message);
            this.kind = kind;
            this.outcome = outcome;
        }

        public Kind kind() {
            return kind;
        }

        /** Machine 409 code, or null when the status is not a closed conflict. */
        public Outcome outcome() {
            return outcome;
        }

        public boolean retryable() {
            return kind == Kind.TRANSIENT;
        }
    }

    /** Body bytes kept only up to the cap. Oversized exchanges retain no payload. */
    private static final class Loaded {
        private static final byte[] EMPTY = new byte[0];
        private static final Loaded OVERSIZE = new Loaded(EMPTY, true);
        private final byte[] bytes;
        private final boolean oversized;

        private Loaded(byte[] bytes, boolean oversized) {
            this.bytes = bytes;
            this.oversized = oversized;
        }

        private byte[] bytes() {
            return bytes;
        }

        private boolean oversized() {
            return oversized;
        }
    }

    /**
     * Stays incomplete until the body ends, so the deadline covers more than the status line.
     * The byte array is allocated only after the next chunk is known to fit.
     */
    private static final class LimitedBody implements HttpResponse.BodySubscriber<Loaded> {
        private final CompletableFuture<Loaded> done = new CompletableFuture<>();
        private final Object lock = new Object();
        private byte[] data;
        private int seen;
        private Flow.Subscription subscription;
        private boolean finished;
        private boolean declaredOversize;
        private volatile boolean overLimit;

        private boolean overLimit() {
            return overLimit;
        }

        private HttpResponse.BodySubscriber<Loaded> forResponse(HttpResponse.ResponseInfo info) {
            synchronized (lock) {
                declaredOversize = info != null && exceedsDeclaredBody(info.headers());
            }
            return this;
        }

        @Override
        public CompletionStage<Loaded> getBody() {
            return done;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            boolean oversize;
            boolean stop;
            synchronized (lock) {
                this.subscription = subscription;
                stop = finished;
                oversize = !finished && declaredOversize;
                if (oversize) {
                    finished = true;
                    overLimit = true;
                }
            }
            if (stop || oversize) {
                if (oversize) done.complete(Loaded.OVERSIZE);
                subscription.cancel();
                return;
            }
            subscription.request(1);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            Flow.Subscription sub = null;
            boolean over = false;
            synchronized (lock) {
                if (finished || buffers == null) return;
                for (ByteBuffer buffer : buffers) {
                    if (buffer == null) continue;
                    int remaining = buffer.remaining();
                    if (remaining == 0) continue;
                    if (remaining > MAX_BODY_BYTES - seen) {
                        finished = true;
                        overLimit = true;
                        data = null;
                        over = true;
                        break;
                    }
                    if (data == null) data = new byte[MAX_BODY_BYTES];
                    buffer.get(data, seen, remaining);
                    seen += remaining;
                }
                sub = subscription;
            }
            if (over) {
                done.complete(Loaded.OVERSIZE);
                if (sub != null) sub.cancel();
                return;
            }
            boolean again;
            synchronized (lock) {
                again = !finished;
            }
            if (again && sub != null) sub.request(1);
        }

        @Override
        public void onError(Throwable throwable) {
            boolean pending;
            synchronized (lock) {
                pending = !finished;
                finished = true;
            }
            if (pending) {
                done.completeExceptionally(throwable == null ? new IOException("closed") : throwable);
            }
        }

        @Override
        public void onComplete() {
            byte[] copy;
            synchronized (lock) {
                if (finished) return;
                finished = true;
                copy = data == null || seen == 0 ? Loaded.EMPTY : Arrays.copyOf(data, seen);
                data = null;
            }
            done.complete(new Loaded(copy, false));
        }

        private void cancel() {
            Flow.Subscription sub;
            boolean pending;
            synchronized (lock) {
                sub = subscription;
                pending = !finished;
                finished = true;
                data = null;
            }
            if (sub != null) sub.cancel();
            if (pending) done.completeExceptionally(new IOException("cancelled"));
        }
    }
}
