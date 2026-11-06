package com.englishflow.learning.adapter.http;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieManager;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Loopback proof for the closed assessment attempt-binding read. Tokens in this fixture are fake. */
class HttpAssessmentAttemptBindingPortTest {
    private static final String ATTEMPT = "aatm_attempt_binding_01";
    private static final String EVENT = "6f1c2a44-8b1e-4c3a-9d2e-0a1b2c3d4e5f";
    private static final String PRINCIPAL = "prn_learner_binding_01";
    private static final String ITEM = "aitm_item_binding_01";
    private static final String LOGICAL = "li_logical_item_01";
    private static final long VERSION = 25001L;
    private static final long EPOCH = 0L;
    private static final String SNAPSHOT = "snap_owner_binding_01";
    private static final String HASH = "ABcd".repeat(16);
    private static final String PINNED_AT = "2026-09-23T00:00:00Z";
    private static final String TOKEN = "workload-token-value";
    private static final String TOKEN_2 = "workload-token-second";
    private static final String LEARNER_JWT = "learner-access-token";
    private static final String ANSWER = "secret-option-value";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Set<String> REQUEST_KEYS = Set.of(
            "eventId", "learnerPrincipalId", "itemAssessmentId", "logicalItemId",
            "contentVersionId", "contentEpoch", "snapshotId", "snapshotHash");
    private static final List<String> SECRETS = List.of(
            TOKEN, TOKEN_2, LEARNER_JWT, ANSWER, "rawQuality", "X-Injected", "super-secret");

    @Test
    void postUsesTheClosedTupleAndIgnoresTheLearnerJwt() throws Exception {
        assertEquals(0, HttpAssessmentAttemptBindingPort.class.getInterfaces().length);
        assertEquals(0, HttpAssessmentAttemptBindingPort.class.getAnnotations().length);
        HttpAssessmentAttemptBindingPort capped = new HttpAssessmentAttemptBindingPort(
                "https://assessment.internal", () -> TOKEN, Duration.ofSeconds(30));
        assertEquals(HttpAssessmentAttemptBindingPort.REQUEST_TIMEOUT_BOUND, capped.requestTimeout());
        assertTrue(capped.redirectsDisabled());
        HttpAssessmentAttemptBindingPort kept = new HttpAssessmentAttemptBindingPort(
                "https://assessment.internal/", () -> TOKEN, Duration.ofMillis(750));
        assertEquals(Duration.ofMillis(750), kept.requestTimeout());
        assertTrue(kept.redirectsDisabled());

        learnerJwt();
        try (Harness harness = new Harness()) {
            AtomicInteger issued = new AtomicInteger();
            Supplier<String> tokens = () -> issued.incrementAndGet() == 1 ? TOKEN : TOKEN_2;
            HttpAssessmentAttemptBindingPort port = port(harness, tokens, Duration.ofSeconds(2));
            harness.respond((exchange, call) -> send(exchange, 200, receipt("CURRENT", PINNED_AT)));

            HttpAssessmentAttemptBindingPort.Receipt current = port.match(sample());
            assertEquals(expected("CURRENT", Instant.parse(PINNED_AT)), current);
            assertEquals(PINNED_AT, current.pinnedAt().toString());
            assertFalse(current.toString().contains(TOKEN));
            assertFalse(current.toString().contains(LEARNER_JWT));
            assertFalse(current.toString().contains(ANSWER));

            Call posted = harness.calls().get(0);
            assertEquals("POST", posted.method());
            assertEquals("/internal/v1/assessment/attempts/" + ATTEMPT + "/binding", posted.path());
            assertNull(posted.query());
            assertEquals("127.0.0.1:" + harness.port(), posted.host());
            assertEquals("Bearer " + TOKEN, posted.authorization());
            assertFalse(posted.authorization().contains(LEARNER_JWT));
            assertEquals("application/json", posted.accept());
            assertTrue(posted.contentType().toLowerCase(Locale.ROOT).startsWith("application/json"));
            assertFalse(posted.forbiddenHeader());
            assertFalse(posted.headerBlob().contains(LEARNER_JWT));
            assertClosedBody(posted.body(), TOKEN);

            harness.respond((exchange, call) -> send(exchange, 200, receipt("HISTORICAL", PINNED_AT),
                    "application/json; charset=utf-8"));
            HttpAssessmentAttemptBindingPort.Receipt historical = port.match(sample());
            assertEquals(HttpAssessmentAttemptBindingPort.Reporting.HISTORICAL, historical.reporting());
            assertEquals(Instant.parse(PINNED_AT), historical.pinnedAt());
            assertEquals("Bearer " + TOKEN_2, harness.calls().get(1).authorization());
            assertEquals(2, issued.get());
            assertEquals(2, harness.calls().size());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void malformedReceiptsAndLocalTuplesFailClosed() throws Exception {
        learnerJwt();
        try (Harness harness = new Harness()) {
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofSeconds(2));
            int baseline = harness.calls().size();
            assertInvalid(() -> port.match(null));
            assertInvalid(() -> port.match(new HttpAssessmentAttemptBindingPort.Match(
                    "attempt", EVENT, PRINCIPAL, ITEM, LOGICAL, VERSION, EPOCH, SNAPSHOT, HASH)));
            assertInvalid(() -> port.match(new HttpAssessmentAttemptBindingPort.Match(
                    ATTEMPT, EVENT, PRINCIPAL, ITEM, LOGICAL, 0L, EPOCH, SNAPSHOT, HASH)));
            assertInvalid(() -> port.match(new HttpAssessmentAttemptBindingPort.Match(
                    ATTEMPT, EVENT, PRINCIPAL, ITEM, LOGICAL, VERSION, -1L, SNAPSHOT, HASH)));
            HttpAssessmentAttemptBindingPort missing = port(harness, () -> " ", Duration.ofSeconds(2));
            HttpAssessmentAttemptBindingPort.Refusal blank = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> missing.match(sample()));
            assertEquals("assessment attempt binding workload token is missing", blank.getMessage());
            assertQuiet(blank);
            HttpAssessmentAttemptBindingPort injected = port(harness, () -> "bad\r\nX-Injected: 1", Duration.ofSeconds(2));
            assertQuiet(assertThrows(HttpAssessmentAttemptBindingPort.Refusal.class, () -> injected.match(sample())));
            HttpAssessmentAttemptBindingPort exploding = port(harness, () -> {
                throw new IllegalStateException(TOKEN + " " + ANSWER);
            }, Duration.ofSeconds(2));
            assertQuiet(assertThrows(HttpAssessmentAttemptBindingPort.Refusal.class, () -> exploding.match(sample())));
            assertEquals(baseline, harness.calls().size());

            assertMalformed(harness, port, receipt("CURRENT", "2026-09-23T00:00:00.000Z"));
            assertMalformed(harness, port, receipt("CURRENT", "2026-09-23T08:00:00+08:00"));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(HASH, HASH.toLowerCase(Locale.ROOT)));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(
                    "\"owner\":\"assessment-service\"", "\"owner\":\"content-service\""));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(
                    "\"tenantId\":\"platform\"", "\"tenantId\":\"caller\""));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(
                    "\"pinSource\":\"b10_assessment_session.started_at\"", "\"pinSource\":\"Instant.now\""));
            assertMalformed(harness, port, receipt("LATER", PINNED_AT));
            String extra = receipt("CURRENT", PINNED_AT).replace(
                    "\"owner\":\"assessment-service\"}",
                    "\"owner\":\"assessment-service\",\"outcome\":\"FULL\",\"answer\":\"" + ANSWER + "\"}");
            assertMalformed(harness, port, extra);
            assertMalformed(harness, port, "{\"data\":" + receipt("CURRENT", PINNED_AT) + ",\"data\":{}}");
            harness.respond((exchange, call) -> send(exchange, 200, receipt("CURRENT", PINNED_AT) + " \t\r\n"));
            assertEquals(expected("CURRENT", Instant.parse(PINNED_AT)), port.match(sample()));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + "0");
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(
                    "\"contentVersionId\":" + VERSION, "\"contentVersionId\":\"" + VERSION + "\""));
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT).replace(SNAPSHOT, "snap_assessment_25001"));
            assertMalformed(harness, port, "not-json");
            harness.respond((exchange, call) -> send(exchange, 200, receipt("CURRENT", PINNED_AT), "text/plain"));
            assertInvalid(() -> port.match(sample()));
            harness.respond((exchange, call) -> send(exchange, 200, receipt("CURRENT", PINNED_AT), null));
            assertInvalid(() -> port.match(sample()));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void authDenialAndAbsenceDropTheBody() throws Exception {
        learnerJwt();
        try (Harness harness = new Harness()) {
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofSeconds(2));
            harness.respond((exchange, call) -> send(exchange, 401, secretBody()));
            HttpAssessmentAttemptBindingPort.Refusal denied = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.DENIED, denied.kind());
            assertNull(denied.outcome());
            assertFalse(denied.retryable());
            assertQuiet(denied);
            assertEquals("Bearer " + TOKEN, harness.calls().get(0).authorization());
            assertFalse(harness.calls().get(0).forbiddenHeader());

            harness.respond((exchange, call) -> send(exchange, 403, secretBody()));
            HttpAssessmentAttemptBindingPort.Refusal forbidden = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.DENIED, forbidden.kind());
            assertFalse(forbidden.retryable());
            assertQuiet(forbidden);

            harness.respond((exchange, call) -> send(exchange, 404, secretBody()));
            HttpAssessmentAttemptBindingPort.Refusal absent = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.ABSENT, absent.kind());
            assertFalse(absent.retryable());
            assertQuiet(absent);
            assertEquals(3, harness.calls().size());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void closedConflictsStayMachineCodedAnd503DoesNotRetry() throws Exception {
        learnerJwt();
        try (Harness harness = new Harness()) {
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofSeconds(2));
            for (HttpAssessmentAttemptBindingPort.Outcome outcome : HttpAssessmentAttemptBindingPort.Outcome.values()) {
                int before = harness.calls().size();
                harness.respond((exchange, call) -> send(exchange, 409,
                        "{\"code\":\"" + outcome.name() + "\",\"message\":\"" + outcome.name() + "\"}"));
                HttpAssessmentAttemptBindingPort.Refusal conflict = assertThrows(
                        HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
                assertEquals(HttpAssessmentAttemptBindingPort.Kind.CONFLICT, conflict.kind());
                assertEquals(outcome, conflict.outcome());
                assertFalse(conflict.retryable());
                assertQuiet(conflict);
                assertEquals(before + 1, harness.calls().size());
                assertClosedBody(harness.calls().get(harness.calls().size() - 1).body(), TOKEN);
            }
            harness.respond((exchange, call) -> send(exchange, 409,
                    "{\"code\":\"SCORE_BUCKET\",\"answer\":\"" + ANSWER + "\"}"));
            assertInvalid(() -> port.match(sample()));
            harness.respond((exchange, call) -> send(exchange, 409,
                    "{\"code\":\"PIN_MISMATCH\",\"message\":\"FALLBACK_PIN\"}"));
            assertInvalid(() -> port.match(sample()));

            int beforeUnavailable = harness.calls().size();
            harness.respond((exchange, call) -> send(exchange, 503, secretBody()));
            HttpAssessmentAttemptBindingPort.Refusal unavailable = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.TRANSIENT, unavailable.kind());
            assertTrue(unavailable.retryable());
            assertQuiet(unavailable);
            assertEquals(beforeUnavailable + 1, harness.calls().size());

            harness.respond((exchange, call) -> send(exchange, 500, secretBody()));
            HttpAssessmentAttemptBindingPort.Refusal other = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.INVALID, other.kind());
            assertFalse(other.retryable());
            assertQuiet(other);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void boundedTimeoutDoesNotRetry() throws Exception {
        learnerJwt();
        try (Harness harness = new Harness()) {
            harness.delay(Duration.ofSeconds(4));
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofMillis(750));
            long started = System.nanoTime();
            HttpAssessmentAttemptBindingPort.Refusal timedOut = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            assertTrue(harness.awaitReceived(), "request was not observed before the timeout");
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.TRANSIENT, timedOut.kind());
            assertTrue(timedOut.retryable());
            assertQuiet(timedOut);
            assertTrue(elapsedMs < 3000L, "timeout was not bounded: " + elapsedMs);
            assertEquals(1, harness.calls().size());
            Call posted = harness.calls().get(0);
            assertEquals("POST", posted.method());
            assertEquals("/internal/v1/assessment/attempts/" + ATTEMPT + "/binding", posted.path());
            assertFalse(posted.forbiddenHeader());
            assertEquals("Bearer " + TOKEN, posted.authorization());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void responseDeadlineBoundsBodyAndRejectsExtraTokens() throws Exception {
        learnerJwt();
        CountDownLatch headersSent = new CountDownLatch(1);
        CountDownLatch releaseBody = new CountDownLatch(1);
        AtomicBoolean bodyWritten = new AtomicBoolean();
        try (Harness harness = new Harness()) {
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofSeconds(2));
            harness.respond((exchange, call) -> send(exchange, 200, " " + receipt("CURRENT", PINNED_AT) + " \t\r\n"));
            assertEquals(expected("CURRENT", Instant.parse(PINNED_AT)), port.match(sample()));
            harness.respond((exchange, call) -> send(exchange, 200, receipt("CURRENT", PINNED_AT) + " "));
            assertEquals(expected("CURRENT", Instant.parse(PINNED_AT)), port.match(sample()));

            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + "0");
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + " {}");
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + "\n[]");
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + " true");
            assertMalformed(harness, port, receipt("CURRENT", PINNED_AT) + " \n0");
            assertMalformed(harness, port, "{\"data\":" + receipt("CURRENT", PINNED_AT) + ",\"data\":{}}");

            byte[] oversized = new byte[9000];
            java.util.Arrays.fill(oversized, (byte) 'Q');
            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, oversized.length);
                exchange.getResponseBody().write(oversized);
                exchange.close();
            });
            HttpAssessmentAttemptBindingPort.Refusal huge = assertInvalid(() -> port.match(sample()));
            assertEquals("assessment attempt binding payload is invalid", huge.getMessage());
            assertFalse(huge.getMessage().contains("Q"));
            assertEquals(0, huge.getSuppressed().length);

            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, 0);
                try {
                    exchange.getResponseBody().write(oversized);
                    exchange.getResponseBody().flush();
                } finally {
                    exchange.close();
                }
            });
            HttpAssessmentAttemptBindingPort.Refusal chunked = assertInvalid(() -> port.match(sample()));
            assertEquals("assessment attempt binding payload is invalid", chunked.getMessage());
            assertFalse(chunked.getMessage().contains("Q"));
            assertEquals(0, chunked.getSuppressed().length);

            byte[] payload = receipt("CURRENT", PINNED_AT).getBytes(StandardCharsets.UTF_8);
            HttpAssessmentAttemptBindingPort tight = port(harness, () -> TOKEN, Duration.ofMillis(500));
            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, payload.length);
                exchange.getResponseBody().flush();
                headersSent.countDown();
                try {
                    releaseBody.await(5, TimeUnit.SECONDS);
                    bodyWritten.set(true);
                    exchange.getResponseBody().write(payload);
                    exchange.getResponseBody().flush();
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                } catch (IOException ignored) {
                    // The deadline already cancelled the exchange.
                } finally {
                    exchange.close();
                }
            });
            HttpAssessmentAttemptBindingPort.Refusal timed = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> tight.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.TRANSIENT, timed.kind());
            assertTrue(timed.retryable());
            assertEquals("assessment attempt binding transport failed", timed.getMessage());
            assertQuiet(timed);
            assertFalse(timed.getMessage().contains(ATTEMPT));
            assertFalse(timed.getMessage().contains(PINNED_AT));
            assertEquals(0, timed.getSuppressed().length);
            assertEquals(0L, headersSent.getCount());
            assertFalse(bodyWritten.get());
        } finally {
            releaseBody.countDown();
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void redirectsOversizedBodiesAndBadOriginsDoNotForward() throws Exception {
        IllegalArgumentException userInfo = assertThrows(IllegalArgumentException.class, () ->
                new HttpAssessmentAttemptBindingPort("http://user:super-secret@127.0.0.1:9",
                        () -> TOKEN, Duration.ofSeconds(2)));
        assertFalse(userInfo.getMessage().contains("super-secret"));
        assertFalse(userInfo.getMessage().contains("user"));
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9/internal", () -> TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9?next=1", () -> TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9#frag", () -> TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "file:///tmp/assessment", () -> TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                " ", () -> TOKEN, Duration.ofSeconds(2)));
        HttpClient forwarding = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.ALWAYS).build();
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9", () -> TOKEN, Duration.ofSeconds(2), forwarding));
        HttpClient cookies = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .cookieHandler(new CookieManager())
                .build();
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9", () -> TOKEN, Duration.ofSeconds(2), cookies));
        HttpClient proxy = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .proxy(ProxySelector.of(new InetSocketAddress("127.0.0.1", 9)))
                .build();
        assertThrows(IllegalArgumentException.class, () -> new HttpAssessmentAttemptBindingPort(
                "http://127.0.0.1:9", () -> TOKEN, Duration.ofSeconds(2), proxy));
        HttpClient passwords = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .authenticator(new Authenticator() {
                    @Override
                    protected PasswordAuthentication getPasswordAuthentication() {
                        return new PasswordAuthentication("user", "super-secret".toCharArray());
                    }
                })
                .build();
        IllegalArgumentException authenticator = assertThrows(IllegalArgumentException.class,
                () -> new HttpAssessmentAttemptBindingPort(
                        "http://127.0.0.1:9", () -> TOKEN, Duration.ofSeconds(2), passwords));
        assertFalse(authenticator.getMessage().contains("super-secret"));

        learnerJwt();
        try (Harness harness = new Harness()) {
            HttpAssessmentAttemptBindingPort port = port(harness, () -> TOKEN, Duration.ofSeconds(2));
            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Location", harness.base() + "/forwarded");
                send(exchange, 302, secretBody());
            });
            HttpAssessmentAttemptBindingPort.Refusal redirected = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.INVALID, redirected.kind());
            assertEquals("assessment attempt binding redirect was refused", redirected.getMessage());
            assertFalse(redirected.retryable());
            assertQuiet(redirected);
            assertEquals(1, harness.calls().size());
            assertEquals("/internal/v1/assessment/attempts/" + ATTEMPT + "/binding", harness.calls().get(0).path());

            byte[] oversized = new byte[9000];
            java.util.Arrays.fill(oversized, (byte) 'a');
            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, oversized.length);
                exchange.getResponseBody().write(oversized);
                exchange.close();
            });
            HttpAssessmentAttemptBindingPort.Refusal huge = assertThrows(
                    HttpAssessmentAttemptBindingPort.Refusal.class, () -> port.match(sample()));
            assertEquals(HttpAssessmentAttemptBindingPort.Kind.INVALID, huge.kind());
            assertFalse(huge.retryable());
            assertFalse(huge.getMessage().contains("aaa"));
            assertEquals(2, harness.calls().size());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static HttpAssessmentAttemptBindingPort.Match sample() {
        return new HttpAssessmentAttemptBindingPort.Match(
                ATTEMPT, EVENT, PRINCIPAL, ITEM, LOGICAL, VERSION, EPOCH, SNAPSHOT, HASH);
    }

    private static HttpAssessmentAttemptBindingPort.Receipt expected(String reporting, Instant pinnedAt) {
        return new HttpAssessmentAttemptBindingPort.Receipt(
                ATTEMPT, ITEM, LOGICAL, PRINCIPAL, "platform", VERSION, EPOCH, SNAPSHOT, HASH, pinnedAt,
                "b10_assessment_session.started_at",
                HttpAssessmentAttemptBindingPort.Reporting.valueOf(reporting),
                "assessment-service");
    }

    private static String receipt(String reporting, String pinnedAt) {
        return "{\"data\":{\"attemptId\":\"" + ATTEMPT
                + "\",\"itemAssessmentId\":\"" + ITEM
                + "\",\"logicalItemId\":\"" + LOGICAL
                + "\",\"learnerPrincipalId\":\"" + PRINCIPAL
                + "\",\"tenantId\":\"platform\",\"contentVersionId\":" + VERSION
                + ",\"contentEpoch\":" + EPOCH
                + ",\"snapshotId\":\"" + SNAPSHOT
                + "\",\"snapshotHash\":\"" + HASH
                + "\",\"pinnedAt\":\"" + pinnedAt
                + "\",\"pinSource\":\"b10_assessment_session.started_at\",\"reporting\":\"" + reporting
                + "\",\"owner\":\"assessment-service\"}}";
    }

    private static String secretBody() {
        return "{\"answer\":\"" + ANSWER + "\",\"rawQuality\":0.2,\"authorization\":\"Bearer " + TOKEN
                + "\",\"learnerJwt\":\"" + LEARNER_JWT + "\",\"outcome\":\"FULL\"}";
    }

    private static void assertClosedBody(String body, String token) throws Exception {
        assertFalse(body.contains(" "));
        assertFalse(body.contains("\n"));
        assertFalse(body.contains(token));
        assertFalse(body.contains(LEARNER_JWT));
        assertFalse(body.contains(ANSWER));
        assertFalse(body.contains("pinnedAt"));
        assertFalse(body.contains("pinSource"));
        assertFalse(body.contains("tenantId"));
        assertFalse(body.contains("contentCode"));
        assertFalse(body.contains("outcome"));
        assertFalse(body.contains("rawQuality"));
        assertFalse(body.contains("answer"));
        assertFalse(body.contains("eventName"));
        JsonNode posted = JSON.readTree(body);
        assertEquals(REQUEST_KEYS, names(posted));
        assertEquals(EVENT, posted.get("eventId").asText());
        assertEquals(PRINCIPAL, posted.get("learnerPrincipalId").asText());
        assertEquals(ITEM, posted.get("itemAssessmentId").asText());
        assertEquals(LOGICAL, posted.get("logicalItemId").asText());
        assertEquals(VERSION, posted.get("contentVersionId").longValue());
        assertEquals(EPOCH, posted.get("contentEpoch").longValue());
        assertEquals(SNAPSHOT, posted.get("snapshotId").asText());
        assertEquals(HASH, posted.get("snapshotHash").asText());
        int event = body.indexOf("\"eventId\"");
        int principal = body.indexOf("\"learnerPrincipalId\"");
        int item = body.indexOf("\"itemAssessmentId\"");
        int logical = body.indexOf("\"logicalItemId\"");
        int version = body.indexOf("\"contentVersionId\"");
        int epoch = body.indexOf("\"contentEpoch\"");
        int snapshot = body.indexOf("\"snapshotId\"");
        int hash = body.indexOf("\"snapshotHash\"");
        assertTrue(event >= 0 && event < principal && principal < item && item < logical
                && logical < version && version < epoch && epoch < snapshot && snapshot < hash);
    }

    private static Set<String> names(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) names.add(entry.getKey());
        return names;
    }

    private HttpAssessmentAttemptBindingPort.Refusal assertInvalid(
            Callable<HttpAssessmentAttemptBindingPort.Receipt> call) {
        HttpAssessmentAttemptBindingPort.Refusal refusal = assertThrows(
                HttpAssessmentAttemptBindingPort.Refusal.class, () -> call.call());
        assertEquals(HttpAssessmentAttemptBindingPort.Kind.INVALID, refusal.kind());
        assertFalse(refusal.retryable());
        assertQuiet(refusal);
        return refusal;
    }

    private void assertMalformed(Harness harness, HttpAssessmentAttemptBindingPort port, String body) {
        harness.respond((exchange, call) -> send(exchange, 200, body));
        assertInvalid(() -> port.match(sample()));
    }

    private static void assertQuiet(HttpAssessmentAttemptBindingPort.Refusal refusal) {
        assertNull(refusal.getCause());
        String text = String.valueOf(refusal.getMessage());
        for (String secret : SECRETS) assertFalse(text.contains(secret), secret);
        assertFalse(text.contains("\n"));
        assertFalse(text.contains("\r"));
    }

    private static void learnerJwt() {
        Jwt jwt = Jwt.withTokenValue(LEARNER_JWT).header("alg", "RS256")
                .subject(PRINCIPAL)
                .issuedAt(Instant.parse(PINNED_AT))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("token_type", "access")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, Set.of(), PRINCIPAL));
    }

    private HttpAssessmentAttemptBindingPort port(Harness harness, Supplier<String> token, Duration timeout) {
        HttpClient http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(1))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new HttpAssessmentAttemptBindingPort(harness.base(), token, timeout, http);
    }

    private void send(HttpExchange exchange, int status, String body) throws IOException {
        send(exchange, status, body, "application/json");
    }

    private void send(HttpExchange exchange, int status, String body, String contentType) throws IOException {
        if (contentType != null) exchange.getResponseHeaders().set("Content-Type", contentType);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private final class Harness implements AutoCloseable {
        private final HttpServer server;
        private final List<Call> calls = Collections.synchronizedList(new ArrayList<>());
        private final CountDownLatch received = new CountDownLatch(1);
        private volatile long delayMs;
        private volatile Responder responder = (exchange, call) -> send(exchange, 500, secretBody());

        private Harness() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", this::handle);
            server.start();
        }

        private String base() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        private int port() {
            return server.getAddress().getPort();
        }

        private void respond(Responder responder) {
            this.responder = responder;
        }

        private void delay(Duration delay) {
            this.delayMs = delay.toMillis();
        }

        private boolean awaitReceived() throws InterruptedException {
            return received.await(2, TimeUnit.SECONDS);
        }

        private List<Call> calls() {
            synchronized (calls) {
                return List.copyOf(calls);
            }
        }

        private void handle(HttpExchange exchange) throws IOException {
            Call call = Call.capture(exchange);
            calls.add(call);
            received.countDown();
            if (delayMs > 0) {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            responder.respond(exchange, call);
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }

    @FunctionalInterface
    private interface Responder {
        void respond(HttpExchange exchange, Call call) throws IOException;
    }

    private record Call(String method, String path, String query, String host, String authorization,
                        String contentType, String accept, String body, boolean forbiddenHeader,
                        String headerBlob) {
        private static Call capture(HttpExchange exchange) throws IOException {
            boolean forbidden = false;
            StringBuilder blob = new StringBuilder();
            for (Map.Entry<String, List<String>> header : exchange.getRequestHeaders().entrySet()) {
                String name = header.getKey() == null ? "" : header.getKey().toLowerCase(Locale.ROOT);
                blob.append(name).append(':');
                if (header.getValue() != null) blob.append(String.join(",", header.getValue()));
                blob.append('\n');
                if (name.equals("x-role") || name.equals("x-b5-role") || name.equals("cookie")
                        || name.equals("idempotency-key") || name.equals("x-forwarded-for")
                        || name.equals("x-forwarded-host") || name.equals("x-forwarded-proto")
                        || name.equals("x-injected") || name.equals("x-tenant-id") || name.equals("x-owner")) {
                    forbidden = true;
                }
            }
            return new Call(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                    exchange.getRequestURI().getRawQuery(),
                    exchange.getRequestHeaders().getFirst("Host"),
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    exchange.getRequestHeaders().getFirst("Content-Type"),
                    exchange.getRequestHeaders().getFirst("Accept"),
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
                    forbidden, blob.toString());
        }
    }
}
