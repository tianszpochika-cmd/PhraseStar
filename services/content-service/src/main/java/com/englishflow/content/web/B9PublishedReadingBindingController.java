package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcPublishedReadingBindings;
import com.englishflow.content.adapter.jdbc.JdbcPublishedReadingBindings.Command;
import com.englishflow.content.adapter.jdbc.JdbcPublishedReadingBindings.Failure;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Owner-internal bind of the current published reading version.
 * Callers submit identity and CAS only. The dedicated envelope stays here so
 * the shared content error writer cannot drop errorCode.
 */
@RestController
@RequestMapping("/internal/v1/content/admin")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public class B9PublishedReadingBindingController {

    private static final String API_VERSION = "v1";
    private static final String SCHEMA_VERSION = "1.0.0";
    private static final String PLATFORM = "platform";
    private static final Pattern REQUEST_ID = Pattern.compile("[A-Za-z][A-Za-z0-9._-]{7,127}");
    private static final Pattern TRACE_ID = Pattern.compile("[a-f0-9]{32}");
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9._:-]{16,128}$");
    private static final Pattern CONTENT_CODE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$");
    private static final Pattern HASH = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Set<String> REQUEST_FIELDS = Set.of(
            "contentCode", "contentVersionId", "expectedHash", "expectedStateVersion");
    private static final BigInteger MIN_VERSION = BigInteger.ONE;
    private static final BigInteger MAX_VERSION = BigInteger.valueOf(Long.MAX_VALUE);

    private final JdbcPublishedReadingBindings bindings;
    private final VerifiedContentPrincipalFactory principals;
    private final Clock clock;

    public B9PublishedReadingBindingController(
            JdbcPublishedReadingBindings bindings,
            VerifiedContentPrincipalFactory principals,
            Clock clock) {
        this.bindings = Objects.requireNonNull(bindings, "bindings are required");
        this.principals = Objects.requireNonNull(principals, "principals are required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @PostMapping(path = "/reading-bindings", consumes = "application/json", produces = "application/json")
    public ResponseEntity<Map<String, Object>> bindB9PublishedReading(
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpHeaders headers,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> meta = meta(headers);
        try {
            ContentActor actor = principal(authentication);
            Map<String, Object> receipt = bindings.bind(command(actor.subjectId(), idempotencyKey, body));
            Map<String, Object> success = new LinkedHashMap<>();
            success.put("data", receipt);
            success.put("meta", meta);
            return respond(200, success, meta);
        } catch (Failure failure) {
            return respond(failure.status(), errorBody(failure, meta), meta);
        }
    }

    private ContentActor principal(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken) || !authentication.isAuthenticated()) {
            throw Failure.unauthorized();
        }
        ContentActor actor;
        try {
            actor = principals.from(authentication);
        } catch (ContentOperationException exception) {
            if ("CONTENT_AUTHORITIES_REQUIRED".equals(exception.code())) {
                throw Failure.permission();
            }
            throw Failure.unauthorized();
        }
        if (!PLATFORM.equals(actor.tenantId())) {
            throw Failure.unauthorized();
        }
        // A content-publisher role does not authorize this operation.
        if (!actor.hasPermission("content:publish")) {
            throw Failure.permission();
        }
        return actor;
    }

    private static Command command(String subject, String idempotencyKey, Map<String, Object> body) {
        if (idempotencyKey == null || !IDEMPOTENCY_KEY.matcher(idempotencyKey).matches()
                || body == null || !REQUEST_FIELDS.equals(body.keySet())) {
            throw Failure.validation();
        }
        Long contentVersionId = exactJsonLong(body.get("contentVersionId"));
        Long expectedStateVersion = exactJsonLong(body.get("expectedStateVersion"));
        if (!(body.get("contentCode") instanceof String contentCode)
                || !CONTENT_CODE.matcher(contentCode).matches()
                || contentVersionId == null
                || !(body.get("expectedHash") instanceof String expectedHash)
                || !HASH.matcher(expectedHash).matches()
                || expectedStateVersion == null) {
            throw Failure.validation();
        }
        return new Command(subject, idempotencyKey, contentCode, contentVersionId, expectedHash, expectedStateVersion);
    }

    private static Long exactJsonLong(Object raw) {
        if (raw == null || raw instanceof String || raw instanceof Double
                || raw instanceof Float || raw instanceof BigDecimal) {
            return null;
        }
        BigInteger value;
        if (raw instanceof BigInteger big) {
            value = big;
        } else if (raw instanceof Integer || raw instanceof Long || raw instanceof Short || raw instanceof Byte) {
            value = BigInteger.valueOf(((Number) raw).longValue());
        } else {
            return null;
        }
        if (value.compareTo(MIN_VERSION) < 0 || value.compareTo(MAX_VERSION) > 0) {
            return null;
        }
        return value.longValue();
    }

    private Map<String, Object> meta(HttpHeaders headers) {
        String requestId = headers == null ? null : headers.getFirst("X-Request-Id");
        String traceId = headers == null ? null : headers.getFirst("X-Trace-Id");
        if (requestId == null || !REQUEST_ID.matcher(requestId).matches()) {
            requestId = "local-" + UUID.randomUUID().toString().replace("-", "");
        }
        if (traceId == null || !TRACE_ID.matcher(traceId).matches()) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", requestId);
        meta.put("traceId", traceId);
        meta.put("apiVersion", API_VERSION);
        meta.put("schemaVersion", SCHEMA_VERSION);
        meta.put("serverTime", clock.instant().toString());
        return meta;
    }

    private static Map<String, Object> errorBody(Failure failure, Map<String, Object> meta) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("errorCode", failure.errorCode());
        error.put("message", failure.getMessage());
        error.put("retryable", failure.retryable());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("meta", meta);
        return body;
    }

    private static ResponseEntity<Map<String, Object>> respond(
            int status, Map<String, Object> body, Map<String, Object> meta) {
        return ResponseEntity.status(status)
                .header("X-Request-Id", String.valueOf(meta.get("requestId")))
                .header("X-Trace-Id", String.valueOf(meta.get("traceId")))
                .header("X-API-Version", API_VERSION)
                .body(body);
    }
}
