package com.englishflow.assessment.adapter.content;

import tools.jackson.databind.ObjectMapper;

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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Assessment-side transport for the G153/G159 protected content snapshot.
 *
 * <p>Practice seam, with no Spring registration and no production caller:
 * {@code Snapshot snapshot = transport.fetch(contentVersionId, contentCode);}
 * then {@code Decision decision = transport.score(snapshot, item.itemId(), selectedOptionId);}.
 * {@code contentVersionId} and {@code contentCode} are the server-owned practice pin.
 * {@code score} posts the closed body from that snapshot's item, snapshot id, snapshot hash,
 * and rule digest. The decision echoes that same item, snapshot id, and rule digest, with
 * outcome {@code FULL} or {@code ZERO}. The selected option is not returned.
 *
 * <p>{@code pin.publishedAt} is the owner publication time ({@code pin.pinnedAt} on the wire).
 * It is not an assessment session {@code startedAt}. Pass the existing
 * {@link IamServiceTokenSupplier} instance, not a wrapping lambda, so a 401 or 403 invalidates
 * it. A learner JWT is not a parameter and is not forwarded. This type is not a
 * {@code ContentSnapshotPort} and does not call the placement bank. It does not retry and
 * does not substitute another version.
 */
public final class HttpProtectedContentSnapshotTransport {
    /** Closed classification. Only {@link Kind#TRANSIENT} is retryable, and this client does not retry. */
    public enum Kind {
        DENIED,
        TRANSIENT,
        NOT_FOUND,
        CONFLICT,
        UNAVAILABLE,
        INVALID
    }

    public enum Outcome {
        FULL,
        ZERO
    }

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    static final Duration REQUEST_TIMEOUT_BOUND = Duration.ofSeconds(5);
    private static final int MAX_BODY_BYTES = 2_097_152;
    private static final long MAX_ITEM_ID = 9_007_199_254_740_991L;
    private static final String SNAPSHOT_PATH = "/internal/v1/content/assessment-snapshots/";
    private static final Pattern CONTENT_CODE = Pattern.compile("^[a-z][a-z0-9._:-]{1,127}$");
    private static final Pattern OPTION_ID = Pattern.compile("^[a-z][a-z0-9._:-]{0,63}$");
    private static final Pattern SNAPSHOT_ID = Pattern.compile("^snap_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern RULE_VERSION = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._:-]{1,95}$");
    private static final Pattern RULE_REF = Pattern.compile("^rule:[a-z][a-z0-9._:-]{2,127}$");
    private static final Pattern ITEM_CODE = Pattern.compile("^[a-z][a-z0-9._:-]{1,127}$");
    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9._~+/=-]{1,4096}$");
    private static final Set<String> ENVELOPE_KEYS = Set.of("data");
    private static final Set<String> SNAPSHOT_KEYS = Set.of(
            "pin", "snapshotVersion", "answerRuleSetVersion", "items", "generatedAt");
    private static final Set<String> PIN_KEYS = Set.of(
            "contentCode", "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash",
            "pinStatus", "pinnedAt", "recoveryReasonCode");
    private static final Set<String> ITEM_KEYS = Set.of(
            "itemId", "itemCode", "itemType", "stem", "options", "displayOrder", "ruleContract");
    private static final Set<String> OPTION_KEYS = Set.of("optionId", "label");
    private static final Set<String> RULE_KEYS = Set.of(
            "ruleRef", "answerRuleVersion", "ruleDigest", "evaluationMode", "sealed");
    private static final Set<String> SCORE_KEYS = Set.of("itemId", "snapshotId", "ruleDigest", "outcome");
    private static final Set<String> SCORE_REQUEST_KEYS = Set.of(
            "contentCode", "itemId", "selectedOptionId", "snapshotId", "snapshotHash", "ruleDigest");
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "correctanswer", "correctoptionkeys", "correctoptions", "answerkey", "answerkeyorder",
            "answerrule", "answerrules", "acceptedanswers", "acceptedtext", "requiredconcepts",
            "correctpairs", "scoringrule", "scoringrules", "hiddenrule", "hiddenrules", "scorekey",
            "secret", "rawanswer", "answerplaintext", "clientanswer", "score", "iscorrect",
            "clientscore", "clientiscorrect", "correctoption", "selectedoption", "selectedoptionid",
            "seal", "readingruleseal", "authorization", "bearer", "accesstoken", "clientsecret",
            "password", "jwt", "token");

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String origin;
    private final Supplier<String> serviceToken;
    private final Duration timeout;

    public HttpProtectedContentSnapshotTransport(ObjectMapper mapper, String contentBaseUrl, String serviceToken,
                                                 Duration timeout) {
        this(mapper, contentBaseUrl, fixedToken(serviceToken), timeout, defaultClient());
    }

    /** Same workload-token injection as {@link HttpPlacementRuleScorePort}. */
    public HttpProtectedContentSnapshotTransport(ObjectMapper mapper, String contentBaseUrl,
                                                 Supplier<String> serviceToken, Duration timeout) {
        this(mapper, contentBaseUrl, serviceToken, timeout, defaultClient());
    }

    /**
     * Injected client for the in-process test double. Production uses a client with a 2s connect
     * timeout and redirects disabled. The per-request timeout is at most 5s.
     */
    public HttpProtectedContentSnapshotTransport(ObjectMapper mapper, String contentBaseUrl,
                                                 Supplier<String> serviceToken, Duration timeout,
                                                 HttpClient http) {
        if (mapper == null || http == null) {
            throw new IllegalArgumentException("protected content transport is incomplete");
        }
        this.mapper = mapper;
        this.http = http;
        this.origin = trustedOrigin(contentBaseUrl);
        this.serviceToken = serviceToken == null ? () -> "" : serviceToken;
        Duration requested = timeout == null || timeout.isNegative() || timeout.isZero()
                ? REQUEST_TIMEOUT_BOUND : timeout;
        this.timeout = requested.compareTo(REQUEST_TIMEOUT_BOUND) > 0 ? REQUEST_TIMEOUT_BOUND : requested;
    }

    /** GET the owner snapshot and keep it only when the version and content code match. */
    public Snapshot fetch(long contentVersionId, String expectedContentCode) {
        if (contentVersionId < 1 || expectedContentCode == null
                || !CONTENT_CODE.matcher(expectedContentCode).matches()) {
            throw invalidRequest();
        }
        String token = workloadToken();
        HttpResponse<byte[]> response = exchange(request(endpoint(contentVersionId, false), token, null));
        Map<String, Object> root = jsonObject(response);
        exactKeys(root, ENVELOPE_KEYS);
        Map<String, Object> data = asMap(root.get("data"));
        exactKeys(data, SNAPSHOT_KEYS);
        Map<String, Object> pin = asMap(data.get("pin"));
        exactKeys(pin, PIN_KEYS);
        long version = rangedLong(pin.get("contentVersionId"), 1, Long.MAX_VALUE);
        String contentCode = text(pin.get("contentCode"), CONTENT_CODE);
        if (version != contentVersionId || !expectedContentCode.equals(contentCode)) throw conflict();
        if (!"PINNED".equals(pin.get("pinStatus")) || !"NONE".equals(pin.get("recoveryReasonCode"))) {
            throw conflict();
        }
        long contentEpoch = rangedLong(pin.get("contentEpoch"), 0, Long.MAX_VALUE);
        String snapshotId = text(pin.get("snapshotId"), SNAPSHOT_ID);
        String snapshotHash = text(pin.get("snapshotHash"), SHA256);
        Instant publishedAt = timestamp(pin.get("pinnedAt"));
        rangedLong(data.get("snapshotVersion"), 1, Long.MAX_VALUE);
        text(data.get("answerRuleSetVersion"), RULE_VERSION);
        timestamp(data.get("generatedAt"));
        List<Item> items = items(asList(data.get("items")));
        return new Snapshot(new Pin(version, contentCode, contentEpoch, snapshotId, snapshotHash, publishedAt), items);
    }

    /** POST the closed score for one item already present on {@code snapshot}. */
    public Decision score(Snapshot snapshot, long itemId, String selectedOptionId) {
        if (snapshot == null) throw invalidRequest();
        Item item = snapshot.item(itemId);
        if (item == null || selectedOptionId == null || !OPTION_ID.matcher(selectedOptionId).matches()) {
            throw invalidRequest();
        }
        String token = workloadToken();
        String json = scoreJson(snapshot.pin(), item, selectedOptionId);
        HttpResponse<byte[]> response = exchange(
                request(endpoint(snapshot.pin().contentVersionId(), true), token, json));
        Map<String, Object> body = jsonObject(response);
        exactKeys(body, SCORE_KEYS);
        long echoedItem = rangedLong(body.get("itemId"), 1, MAX_ITEM_ID);
        String echoedSnapshot = text(body.get("snapshotId"), SNAPSHOT_ID);
        String echoedRule = text(body.get("ruleDigest"), SHA256);
        if (echoedItem != item.itemId()
                || !item.ruleDigest().equals(echoedRule)
                || !snapshot.pin().snapshotId().equals(echoedSnapshot)) {
            throw conflict();
        }
        if (!(body.get("outcome") instanceof String outcomeText)) throw invalidPayload();
        Outcome outcome = switch (outcomeText) {
            case "FULL" -> Outcome.FULL;
            case "ZERO" -> Outcome.ZERO;
            default -> throw invalidPayload();
        };
        return new Decision(item.itemId(), snapshot.pin().snapshotId(), item.ruleDigest(), outcome);
    }

    private HttpResponse<byte[]> exchange(HttpRequest request) {
        AtomicInteger observedStatus = new AtomicInteger(Integer.MIN_VALUE);
        AtomicBoolean limited = new AtomicBoolean();
        CompletableFuture<Void> headerStop = new CompletableFuture<>();
        final CompletableFuture<HttpResponse<byte[]>> pending;
        try {
            pending = http.sendAsync(request, boundedBody(observedStatus, limited, headerStop));
        } catch (RuntimeException failed) {
            throw invalidRequest();
        }
        AtomicReference<HttpResponse<byte[]>> received = new AtomicReference<>();
        AtomicReference<Throwable> failed = new AtomicReference<>();
        CompletableFuture<Void> gate = new CompletableFuture<>();
        pending.whenComplete((response, error) -> {
            if (error != null) failed.compareAndSet(null, error);
            else received.compareAndSet(null, response);
            gate.complete(null);
        });
        // The header callback must return before this exchange is cancelled. Completing the
        // gate on the HttpClient thread would re-enter sendAsync from inside BodyHandler.apply.
        headerStop.whenCompleteAsync((ignored, error) -> gate.complete(null));
        try {
            gate.get(timeout.toNanos(), TimeUnit.NANOSECONDS);
        } catch (InterruptedException interrupted) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw transientFailure();
        } catch (TimeoutException timedOut) {
            pending.cancel(true);
            throw failureAfterHeaders(observedStatus.get(), limited.get());
        } catch (ExecutionException failedWait) {
            pending.cancel(true);
            throw failureAfterHeaders(observedStatus.get(), limited.get());
        } catch (RuntimeException failedWait) {
            pending.cancel(true);
            throw invalidRequest();
        }
        HttpResponse<byte[]> response = received.get();
        if (headerStop.isDone() || failed.get() != null || response == null) {
            pending.cancel(true);
            throw failureAfterHeaders(observedStatus.get(), limited.get());
        }
        int status = response.statusCode();
        if (status != 200) {
            if (status == 401 || status == 403) {
                if (serviceToken instanceof IamServiceTokenSupplier iam) iam.invalidate();
                throw denied();
            }
            throw statusFailure(status);
        }
        byte[] body = response.body();
        if (body != null && body.length > MAX_BODY_BYTES) throw invalidPayload();
        return response;
    }

    /**
     * Fixed length above the cap, and any status other than 200, is decided from the headers.
     * JDK 25 may not call {@code onSubscribe} until body bytes arrive, so this only completes
     * {@code headerStop}. The caller then cancels the exchange and does not read or drain.
     * An absent length, or a 200 length at or under the cap, keeps the bounded subscriber.
     */
    private static HttpResponse.BodyHandler<byte[]> boundedBody(AtomicInteger observedStatus, AtomicBoolean limited,
                                                                CompletableFuture<Void> headerStop) {
        return info -> {
            int status = info.statusCode();
            observedStatus.set(status);
            long declared = declaredLength(info.headers());
            if (declared > MAX_BODY_BYTES || status != 200) {
                if (declared > MAX_BODY_BYTES) limited.set(true);
                headerStop.complete(null);
                return rejectedBody();
            }
            long cap = declared < 0 ? MAX_BODY_BYTES : declared;
            HttpResponse.BodySubscriber<byte[]> downstream = HttpResponse.BodyHandlers
                    .limiting(HttpResponse.BodyHandlers.ofByteArray(), MAX_BODY_BYTES)
                    .apply(info);
            return new GuardSubscriber(downstream, cap, limited);
        };
    }

    private Refusal failureAfterHeaders(int status, boolean bodyLimited) {
        if (status == 401 || status == 403) {
            if (serviceToken instanceof IamServiceTokenSupplier iam) iam.invalidate();
            return denied();
        }
        if (status != Integer.MIN_VALUE && status != 200) return statusFailure(status);
        if (bodyLimited) return invalidPayload();
        return transientFailure();
    }

    /** {@code -1} when the length is absent. Anything that is not one decimal length is over the cap. */
    private static long declaredLength(HttpHeaders headers) {
        List<String> values = headers.allValues("Content-Length");
        if (values == null || values.isEmpty()) return -1L;
        if (values.size() != 1) return MAX_BODY_BYTES + 1L;
        String raw = values.get(0);
        if (raw != null) raw = raw.trim();
        if (raw == null || raw.isEmpty() || raw.length() > 10) return MAX_BODY_BYTES + 1L;
        long value = 0L;
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c < '0' || c > '9') return MAX_BODY_BYTES + 1L;
            value = value * 10L + (c - '0');
            if (value > MAX_BODY_BYTES) return MAX_BODY_BYTES + 1L;
        }
        return value;
    }

    private static HttpResponse.BodySubscriber<byte[]> rejectedBody() {
        CompletableFuture<byte[]> future = new CompletableFuture<>();
        future.completeExceptionally(new BodyLimitExceeded());
        return new HttpResponse.BodySubscriber<>() {
            @Override
            public CompletionStage<byte[]> getBody() {
                return future;
            }

            @Override
            public void onSubscribe(Flow.Subscription subscription) {
                subscription.cancel();
            }

            @Override
            public void onNext(List<ByteBuffer> item) {
            }

            @Override
            public void onError(Throwable throwable) {
            }

            @Override
            public void onComplete() {
            }
        };
    }

    private Map<String, Object> jsonObject(HttpResponse<byte[]> response) {
        if (!jsonMedia(response.headers())) throw invalidPayload();
        byte[] body = response.body() == null ? new byte[0] : response.body();
        if (body.length == 0 || body.length > MAX_BODY_BYTES) throw invalidPayload();
        Object parsed = StrictJson.read(utf8(body));
        rejectSensitiveKeys(parsed);
        return asMap(parsed);
    }

    private String scoreJson(Pin pin, Item item, String selectedOptionId) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("contentCode", pin.contentCode());
        fields.put("itemId", item.itemId());
        fields.put("selectedOptionId", selectedOptionId);
        fields.put("snapshotId", pin.snapshotId());
        fields.put("snapshotHash", pin.snapshotHash());
        fields.put("ruleDigest", item.ruleDigest());
        final String json;
        try {
            json = mapper.writeValueAsString(fields);
        } catch (RuntimeException failed) {
            throw invalidRequest();
        }
        if (json == null || json.length() > 4096) throw invalidRequest();
        Object parsed = StrictJson.read(json);
        if (!(parsed instanceof Map<?, ?> map) || !map.keySet().equals(SCORE_REQUEST_KEYS)) throw invalidRequest();
        long parsedItemId = requestItemId(map.get("itemId"));
        if (!pin.contentCode().equals(map.get("contentCode"))
                || parsedItemId != item.itemId()
                || !selectedOptionId.equals(map.get("selectedOptionId"))
                || !pin.snapshotId().equals(map.get("snapshotId"))
                || !pin.snapshotHash().equals(map.get("snapshotHash"))
                || !item.ruleDigest().equals(map.get("ruleDigest"))) {
            throw invalidRequest();
        }
        return json;
    }

    /** Closed request reparse. Floats, overflow, and non-canonical text never become a long. */
    private static long requestItemId(Object value) {
        try {
            return rangedLong(value, 1, MAX_ITEM_ID);
        } catch (Refusal refused) {
            throw invalidRequest();
        }
    }

    private String workloadToken() {
        final String token;
        try {
            token = serviceToken.get();
        } catch (RuntimeException failed) {
            throw missingToken();
        }
        if (token == null || token.isBlank()) throw missingToken();
        if (!TOKEN.matcher(token).matches()) throw invalidToken();
        return token;
    }

    private HttpRequest request(URI uri, String token, String json) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + token);
            if (json == null) return builder.GET().build();
            return builder.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
        } catch (IllegalArgumentException failed) {
            throw invalidToken();
        }
    }

    private URI endpoint(long contentVersionId, boolean score) {
        String path = SNAPSHOT_PATH + Long.toString(contentVersionId);
        if (score) path = path + "/score";
        if (path.contains("placement")) throw invalidRequest();
        try {
            return URI.create(origin + path);
        } catch (IllegalArgumentException failed) {
            throw invalidRequest();
        }
    }

    private static List<Item> items(List<Object> rawItems) {
        if (rawItems.size() > 1000) throw invalidPayload();
        List<Item> items = new ArrayList<>(rawItems.size());
        Set<Long> ids = new LinkedHashSet<>();
        for (Object raw : rawItems) {
            Map<String, Object> item = asMap(raw);
            exactKeys(item, ITEM_KEYS);
            long itemId = rangedLong(item.get("itemId"), 1, MAX_ITEM_ID);
            if (!ids.add(itemId)) throw invalidPayload();
            text(item.get("itemCode"), ITEM_CODE);
            if (!"READING".equals(item.get("itemType"))) throw invalidPayload();
            String stem = visible(item.get("stem"), 4096);
            int displayOrder = (int) rangedLong(item.get("displayOrder"), 0, 1000);
            List<Option> options = options(asList(item.get("options")));
            Map<String, Object> rule = asMap(item.get("ruleContract"));
            exactKeys(rule, RULE_KEYS);
            text(rule.get("ruleRef"), RULE_REF);
            text(rule.get("answerRuleVersion"), RULE_VERSION);
            String ruleDigest = text(rule.get("ruleDigest"), SHA256);
            if (!"DETERMINISTIC".equals(rule.get("evaluationMode")) || !Boolean.TRUE.equals(rule.get("sealed"))) {
                throw invalidPayload();
            }
            items.add(new Item(itemId, displayOrder, stem, options, ruleDigest));
        }
        return List.copyOf(items);
    }

    private static List<Option> options(List<Object> rawOptions) {
        if (rawOptions.size() < 2 || rawOptions.size() > 32) throw invalidPayload();
        List<Option> options = new ArrayList<>(rawOptions.size());
        Set<String> ids = new LinkedHashSet<>();
        for (Object raw : rawOptions) {
            Map<String, Object> option = asMap(raw);
            exactKeys(option, OPTION_KEYS);
            String optionId = text(option.get("optionId"), OPTION_ID);
            if (!ids.add(optionId)) throw invalidPayload();
            options.add(new Option(optionId, visible(option.get("label"), 512)));
        }
        return List.copyOf(options);
    }

    private static Refusal statusFailure(int status) {
        return switch (status) {
            case 400 -> invalidPayload();
            case 404 -> notFound();
            case 409 -> conflict();
            case 410 -> unavailable();
            case 408, 429 -> transientFailure();
            default -> status >= 500 && status <= 599 ? transientFailure() : invalidPayload();
        };
    }

    private static boolean jsonMedia(HttpHeaders headers) {
        List<String> types = headers.allValues("content-type");
        if (types.size() != 1) return false;
        String header = types.get(0);
        if (header == null || header.length() > 128) return false;
        for (int i = 0; i < header.length(); i++) {
            char c = header.charAt(i);
            if (c <= 0x1f || c == 0x7f) return false;
        }
        int semi = header.indexOf(';');
        String media = (semi < 0 ? header : header.substring(0, semi)).trim();
        return "application/json".equalsIgnoreCase(media);
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

    private static void rejectSensitiveKeys(Object value) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() instanceof String key && SENSITIVE_KEYS.contains(normalize(key))) {
                    throw invalidPayload();
                }
                rejectSensitiveKeys(entry.getValue());
            }
        } else if (value instanceof List<?> list) {
            for (Object item : list) rejectSensitiveKeys(item);
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

    private static Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) throw invalidPayload();
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!(entry.getKey() instanceof String key)) throw invalidPayload();
            copy.put(key, entry.getValue());
        }
        return copy;
    }

    private static List<Object> asList(Object value) {
        if (!(value instanceof List<?> list)) throw invalidPayload();
        return new ArrayList<>(list);
    }

    private static void exactKeys(Map<String, Object> map, Set<String> expected) {
        if (!map.keySet().equals(expected)) throw invalidPayload();
    }

    private static long rangedLong(Object value, long min, long max) {
        if (!(value instanceof Long number)) throw invalidPayload();
        long parsed = number.longValue();
        if (parsed < min || parsed > max) throw invalidPayload();
        return parsed;
    }

    private static String text(Object value, Pattern pattern) {
        if (!(value instanceof String text) || !pattern.matcher(text).matches()) throw invalidPayload();
        return text;
    }

    private static String visible(Object value, int maxCodePoints) {
        if (!(value instanceof String text) || text.isEmpty()
                || text.codePointCount(0, text.length()) > maxCodePoints
                || text.codePoints().allMatch(HttpProtectedContentSnapshotTransport::blank)) {
            throw invalidPayload();
        }
        return text;
    }

    private static boolean blank(int codePoint) {
        return Character.isWhitespace(codePoint) || codePoint == 0x00A0 || codePoint == 0xFEFF;
    }

    private static Instant timestamp(Object value) {
        if (!(value instanceof String text) || text.length() < 16 || text.length() > 40) throw invalidPayload();
        try {
            return OffsetDateTime.parse(text).toInstant();
        } catch (DateTimeException failed) {
            throw invalidPayload();
        }
    }

    private static String trustedOrigin(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("protected content base url is required");
        }
        String candidate = raw.endsWith("/") ? raw.substring(0, raw.length() - 1) : raw;
        for (int i = 0; i < candidate.length(); i++) {
            char c = candidate.charAt(i);
            if (c <= 0x20 || c >= 0x7f || c == '\\' || c == '@') {
                throw new IllegalArgumentException("protected content base url is invalid");
            }
        }
        final URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException failed) {
            throw new IllegalArgumentException("protected content base url is invalid");
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
            throw new IllegalArgumentException("protected content base url is invalid");
        }
        return candidate;
    }

    private static Supplier<String> fixedToken(String serviceToken) {
        if (serviceToken != null && !serviceToken.isBlank() && !TOKEN.matcher(serviceToken).matches()) {
            throw new IllegalArgumentException("protected content service token is invalid");
        }
        String fixed = serviceToken == null ? "" : serviceToken;
        return () -> fixed;
    }

    private static HttpClient defaultClient() {
        return HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    private static Refusal denied() {
        return new Refusal(Kind.DENIED, "protected content snapshot was denied");
    }

    private static Refusal transientFailure() {
        return new Refusal(Kind.TRANSIENT, "protected content snapshot transport failed");
    }

    private static Refusal notFound() {
        return new Refusal(Kind.NOT_FOUND, "protected content snapshot was not found");
    }

    private static Refusal conflict() {
        return new Refusal(Kind.CONFLICT, "protected content pin does not match");
    }

    private static Refusal unavailable() {
        return new Refusal(Kind.UNAVAILABLE, "protected content snapshot is unavailable");
    }

    private static Refusal invalidPayload() {
        return new Refusal(Kind.INVALID, "protected content snapshot payload is invalid");
    }

    private static Refusal invalidRequest() {
        return new Refusal(Kind.INVALID, "protected content snapshot request is invalid");
    }

    private static Refusal missingToken() {
        return new Refusal(Kind.INVALID, "protected content snapshot service token is missing");
    }

    private static Refusal invalidToken() {
        return new Refusal(Kind.INVALID, "protected content snapshot service token is invalid");
    }

    /** Canonical owner pin. {@code publishedAt} is the publication time, not a session start. */
    public record Pin(long contentVersionId, String contentCode, long contentEpoch, String snapshotId,
                      String snapshotHash, Instant publishedAt) {
    }

    public record Option(String optionId, String label) {
    }

    public record Item(long itemId, int displayOrder, String stem, List<Option> options, String ruleDigest) {
        public Item {
            options = List.copyOf(options);
        }
    }

    public record Decision(long itemId, String snapshotId, String ruleDigest, Outcome outcome) {
    }

    /** Snapshot instances come only from {@link #fetch(long, String)}. */
    public static final class Snapshot {
        private final Pin pin;
        private final List<Item> items;

        private Snapshot(Pin pin, List<Item> items) {
            this.pin = pin;
            this.items = items;
        }

        public Pin pin() {
            return pin;
        }

        public List<Item> items() {
            return items;
        }

        public Item item(long itemId) {
            for (Item candidate : items) {
                if (candidate.itemId() == itemId) return candidate;
            }
            return null;
        }
    }

    public static final class Refusal extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final Kind kind;

        public Refusal(Kind kind, String message) {
            super(message);
            this.kind = kind;
        }

        public Kind kind() {
            return kind;
        }

        public boolean retryable() {
            return kind == Kind.TRANSIENT;
        }
    }

    /** Fixed tag for a body that is outside the cap. The refusal does not keep this or the bytes. */
    private static final class BodyLimitExceeded extends RuntimeException {
        private static final long serialVersionUID = 1L;

        private BodyLimitExceeded() {
            super("protected content body limit");
        }
    }

    /**
     * Forwards at most {@code capacity} bytes to the JDK limiting subscriber and records the tag
     * before that subscriber can retain a larger buffer.
     */
    private static final class GuardSubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> future = new CompletableFuture<>();
        private final AtomicBoolean limited;
        private final long capacity;
        private HttpResponse.BodySubscriber<byte[]> downstream;
        private volatile Flow.Subscription subscription;
        private long received;
        private volatile boolean stopped;

        private GuardSubscriber(HttpResponse.BodySubscriber<byte[]> downstream, long capacity,
                                AtomicBoolean limited) {
            this.downstream = downstream;
            this.capacity = capacity;
            this.limited = limited;
            downstream.getBody().whenComplete((body, error) -> {
                if (error != null) future.completeExceptionally(error);
                else future.complete(body);
            });
        }

        @Override
        public CompletionStage<byte[]> getBody() {
            return future;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            HttpResponse.BodySubscriber<byte[]> inner = downstream;
            if (inner == null) {
                subscription.cancel();
                return;
            }
            inner.onSubscribe(new Flow.Subscription() {
                @Override
                public void request(long n) {
                    if (!stopped && n > 0) subscription.request(n);
                }

                @Override
                public void cancel() {
                    stopped = true;
                    subscription.cancel();
                }
            });
        }

        @Override
        public void onNext(List<ByteBuffer> item) {
            if (stopped || item == null) return;
            long size = 0L;
            for (ByteBuffer buffer : item) {
                if (buffer == null) {
                    fail();
                    return;
                }
                long next = size + buffer.remaining();
                if (next < size) {
                    fail();
                    return;
                }
                size = next;
            }
            if (received > capacity || size > capacity - received) {
                fail();
                return;
            }
            received += size;
            HttpResponse.BodySubscriber<byte[]> inner = downstream;
            if (inner == null) {
                fail();
                return;
            }
            inner.onNext(item);
        }

        @Override
        public void onError(Throwable throwable) {
            if (stopped) return;
            stopped = true;
            HttpResponse.BodySubscriber<byte[]> inner = downstream;
            downstream = null;
            if (inner != null) inner.onError(throwable);
            future.completeExceptionally(throwable == null ? new IOException("protected content body closed") : throwable);
        }

        @Override
        public void onComplete() {
            if (stopped) return;
            stopped = true;
            HttpResponse.BodySubscriber<byte[]> inner = downstream;
            downstream = null;
            if (inner != null) inner.onComplete();
        }

        private void fail() {
            if (stopped) return;
            stopped = true;
            limited.set(true);
            BodyLimitExceeded error = new BodyLimitExceeded();
            future.completeExceptionally(error);
            Flow.Subscription active = subscription;
            if (active != null) active.cancel();
            HttpResponse.BodySubscriber<byte[]> inner = downstream;
            downstream = null;
            if (inner != null) inner.onError(error);
        }
    }

    /**
     * One JSON value. Duplicate keys, a second value, and non-canonical numbers are refused.
     * Number text must be {@code 0} or {@code [1-9][0-9]*}. String values stay text, so visible
     * prose is not treated as a key.
     */
    private static final class StrictJson {
        private static final int MAX_CHARS = 2_000_000;
        private static final int MAX_DEPTH = 16;
        private static final int MAX_KEYS = 32;
        private static final int MAX_ARRAY = 1000;
        private static final int MAX_STRING = 8192;
        private static final int MAX_NODES = 100_000;

        private final String text;
        private int pos;
        private int nodes;

        private StrictJson(String text) {
            this.text = text;
        }

        static Object read(String raw) {
            if (raw == null || raw.isEmpty() || raw.length() > MAX_CHARS) fail();
            StrictJson parser = new StrictJson(raw);
            Object value = parser.value(0);
            parser.skipWs();
            if (parser.pos != parser.text.length()) fail();
            return value;
        }

        private Object value(int depth) {
            if (depth > MAX_DEPTH || ++nodes > MAX_NODES) fail();
            skipWs();
            if (pos >= text.length()) fail();
            char c = text.charAt(pos);
            if (c == '{') return object(depth);
            if (c == '[') return array(depth);
            if (c == '"') return string();
            if (c == 't') {
                literal("true");
                return Boolean.TRUE;
            }
            if (c == 'f') {
                literal("false");
                return Boolean.FALSE;
            }
            if (c >= '0' && c <= '9') return number();
            fail();
            return null;
        }

        private Map<String, Object> object(int depth) {
            expect('{');
            Map<String, Object> map = new LinkedHashMap<>();
            skipWs();
            if (consume('}')) return map;
            while (true) {
                if (map.size() >= MAX_KEYS) fail();
                skipWs();
                String key = string();
                if (key.isEmpty() || key.length() > 64 || map.containsKey(key)) fail();
                skipWs();
                expect(':');
                map.put(key, value(depth + 1));
                skipWs();
                if (consume('}')) return map;
                expect(',');
                skipWs();
                if (pos < text.length() && text.charAt(pos) == '}') fail();
            }
        }

        private List<Object> array(int depth) {
            expect('[');
            List<Object> list = new ArrayList<>();
            skipWs();
            if (consume(']')) return list;
            while (true) {
                if (list.size() >= MAX_ARRAY) fail();
                list.add(value(depth + 1));
                skipWs();
                if (consume(']')) return list;
                expect(',');
                skipWs();
                if (pos < text.length() && text.charAt(pos) == ']') fail();
            }
        }

        private String string() {
            expect('"');
            StringBuilder out = new StringBuilder();
            while (pos < text.length()) {
                char c = text.charAt(pos++);
                if (c == '"') {
                    if (out.length() > MAX_STRING) fail();
                    return out.toString();
                }
                if (c == '\\') {
                    if (pos >= text.length()) fail();
                    char escaped = text.charAt(pos++);
                    switch (escaped) {
                        case '"', '\\', '/' -> out.append(escaped);
                        case 'b' -> out.append('\b');
                        case 'f' -> out.append('\f');
                        case 'n' -> out.append('\n');
                        case 'r' -> out.append('\r');
                        case 't' -> out.append('\t');
                        case 'u' -> out.append(unicode());
                        default -> fail();
                    }
                } else if (c < 0x20) {
                    fail();
                } else {
                    out.append(c);
                }
                if (out.length() > MAX_STRING) fail();
            }
            fail();
            return "";
        }

        private char unicode() {
            if (pos + 4 > text.length()) fail();
            int value = 0;
            for (int i = 0; i < 4; i++) {
                int digit = Character.digit(text.charAt(pos++), 16);
                if (digit < 0) fail();
                value = (value << 4) + digit;
            }
            return (char) value;
        }

        private Long number() {
            int start = pos;
            char first = text.charAt(pos);
            if (first == '0') {
                pos++;
            } else if (first >= '1' && first <= '9') {
                while (pos < text.length()) {
                    char c = text.charAt(pos);
                    if (c < '0' || c > '9') break;
                    pos++;
                }
            } else {
                fail();
            }
            if (pos < text.length()) {
                char next = text.charAt(pos);
                if ((next >= '0' && next <= '9') || next == '.' || next == 'e' || next == 'E'
                        || next == '+' || next == '-') {
                    fail();
                }
            }
            String literal = text.substring(start, pos);
            if (literal.length() > 19) fail();
            try {
                return Long.parseLong(literal);
            } catch (NumberFormatException failed) {
                fail();
                return 0L;
            }
        }

        private void literal(String expected) {
            if (!text.startsWith(expected, pos)) fail();
            pos += expected.length();
            if (pos < text.length() && Character.isLetterOrDigit(text.charAt(pos))) fail();
        }

        private void skipWs() {
            while (pos < text.length()) {
                char c = text.charAt(pos);
                if (c != ' ' && c != '\n' && c != '\r' && c != '\t') return;
                pos++;
            }
        }

        private void expect(char c) {
            if (!consume(c)) fail();
        }

        private boolean consume(char c) {
            if (pos < text.length() && text.charAt(pos) == c) {
                pos++;
                return true;
            }
            return false;
        }

        private static <T> T fail() {
            throw invalidPayload();
        }
    }
}
