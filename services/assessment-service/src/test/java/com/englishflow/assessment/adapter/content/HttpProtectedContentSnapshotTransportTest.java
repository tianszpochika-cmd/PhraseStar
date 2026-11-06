package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.port.ContentSnapshotPort;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.lang.reflect.RecordComponent;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Loopback proof for the protected snapshot transport. The token and IAM secret are fakes. */
class HttpProtectedContentSnapshotTransportTest {
    private static final long VERSION = 1001L;
    private static final String CODE = "reading.unit.one";
    private static final String SNAPSHOT_ID = "snap_reading_1001";
    private static final String HASH = "ab".repeat(32);
    private static final String VERSION_DIGEST = "0123456789abcdef".repeat(4);
    private static final String DIGEST_9 = "cd".repeat(32);
    private static final String DIGEST_2 = "ef".repeat(32);
    private static final String STEM = "段落 correctOption answerRule readingRuleSeal";
    private static final String LABEL = "answerKey in the label";
    private static final String TOKEN = "svc-token-value";
    private static final int MAX_BODY_BYTES = 2_097_152;
    private static final String PUBLISHED = "2026-04-01T08:00:00Z";
    private static final String GENERATED = "2026-04-02T09:30:00Z";
    private static final String[] SECRETS = {
            "beta-secret-option", "correctOption", "readingRuleSeal", "learner-jwt-body",
            "test-secret", "workload-token", TOKEN, "X-Injected", "leak-location"
    };

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void fetchAndScoreUseThePinnedSnapshot() throws Exception {
        assertFalse(ContentSnapshotPort.class.isAssignableFrom(HttpProtectedContentSnapshotTransport.class));
        assertFalse(PlacementRuleScorePort.class.isAssignableFrom(HttpProtectedContentSnapshotTransport.class));
        assertEquals(List.of("contentVersionId", "contentCode", "contentEpoch", "snapshotId",
                        "snapshotHash", "publishedAt"),
                names(HttpProtectedContentSnapshotTransport.Pin.class));
        assertThrows(NoSuchMethodException.class,
                () -> HttpProtectedContentSnapshotTransport.Pin.class.getMethod("startedAt"));
        for (RecordComponent component : HttpProtectedContentSnapshotTransport.Decision.class.getRecordComponents()) {
            String name = component.getName().toLowerCase(Locale.ROOT);
            assertFalse(name.contains("select"));
            assertFalse(name.contains("started"));
            assertFalse(name.contains("correct"));
        }

        try (Harness harness = new Harness()) {
            harness.snapshot(goodSnapshot());
            HttpProtectedContentSnapshotTransport transport = injected(harness.base() + "/", () -> TOKEN);
            HttpProtectedContentSnapshotTransport.Snapshot snapshot = transport.fetch(VERSION, CODE);

            Call get = harness.calls.get(0);
            assertEquals("GET", get.method());
            assertEquals("/internal/v1/content/assessment-snapshots/1001", get.path());
            assertNull(get.query());
            assertEquals("", get.body());
            assertEquals("Bearer " + TOKEN, get.authorization());
            assertEquals("application/json", get.accept());
            assertNull(get.contentType());
            assertFalse(get.forbiddenHeader());
            assertFalse(get.path().contains("placement"));
            assertFalse(get.path().contains(CODE));
            assertEquals(0, harness.iamCalls.get());

            HttpProtectedContentSnapshotTransport.Pin pin = snapshot.pin();
            assertEquals(VERSION, pin.contentVersionId());
            assertEquals(CODE, pin.contentCode());
            assertEquals(4L, pin.contentEpoch());
            assertEquals(SNAPSHOT_ID, pin.snapshotId());
            assertEquals(HASH, pin.snapshotHash());
            assertEquals(Instant.parse(PUBLISHED), pin.publishedAt());
            assertFalse(pin.publishedAt().equals(Instant.parse(GENERATED)));
            assertEquals(2, snapshot.items().size());
            HttpProtectedContentSnapshotTransport.Item first = snapshot.items().get(0);
            HttpProtectedContentSnapshotTransport.Item second = snapshot.items().get(1);
            assertEquals(9L, first.itemId());
            assertEquals(0, first.displayOrder());
            assertEquals(STEM, first.stem());
            assertEquals(LABEL, first.options().get(0).label());
            assertEquals(List.of("beta", "alpha"),
                    List.of(first.options().get(0).optionId(), first.options().get(1).optionId()));
            assertEquals(DIGEST_9, first.ruleDigest());
            assertEquals(2L, second.itemId());
            assertEquals(1, second.displayOrder());
            assertEquals(DIGEST_2, second.ruleDigest());
            assertThrows(UnsupportedOperationException.class, () -> snapshot.items().clear());
            assertThrows(UnsupportedOperationException.class, () -> first.options().clear());

            HttpProtectedContentSnapshotTransport.Decision full = transport.score(snapshot, first.itemId(), "beta");
            HttpProtectedContentSnapshotTransport.Decision zero = transport.score(snapshot, first.itemId(), "alpha");
            HttpProtectedContentSnapshotTransport.Decision other = transport.score(snapshot, second.itemId(), "aye");
            assertEquals(HttpProtectedContentSnapshotTransport.Outcome.FULL, full.outcome());
            assertEquals(HttpProtectedContentSnapshotTransport.Outcome.ZERO, zero.outcome());
            assertEquals(HttpProtectedContentSnapshotTransport.Outcome.ZERO, other.outcome());
            assertEquals(9L, full.itemId());
            assertEquals(pin.snapshotId(), full.snapshotId());
            assertEquals(DIGEST_9, full.ruleDigest());
            assertEquals(DIGEST_2, other.ruleDigest());
            assertFalse(full.toString().contains("beta"));
            assertFalse(zero.toString().contains("alpha"));
            assertFalse(other.toString().contains(TOKEN));

            Call posted = harness.calls.get(1);
            Call secondPost = harness.calls.get(2);
            Call thirdPost = harness.calls.get(3);
            assertClosedScore(posted, 9L, "beta", DIGEST_9);
            assertClosedScore(secondPost, 9L, "alpha", DIGEST_9);
            assertClosedScore(thirdPost, 2L, "aye", DIGEST_2);
            assertFalse(thirdPost.body().contains(DIGEST_9));
            assertEquals(4, harness.calls.size());

            int posts = harness.calls.size();
            HttpProtectedContentSnapshotTransport.Refusal missing = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.score(snapshot, 99L, "beta"));
            HttpProtectedContentSnapshotTransport.Refusal padded = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.score(snapshot, 9L, "beta "));
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.INVALID, missing.kind());
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.INVALID, padded.kind());
            assertFalse(missing.retryable());
            assertEquals(posts, harness.calls.size());
            assertQuiet(padded);
        }
    }

    @Test
    void deniedResponsesInvalidateTheWorkloadToken() throws Exception {
        try (Harness harness = new Harness()) {
            AtomicInteger status = new AtomicInteger(401);
            harness.respond((exchange, call) -> send(exchange, status.get(), secretBody()));
            IamServiceTokenSupplier supplier = new IamServiceTokenSupplier(mapper, HttpClient.newHttpClient(),
                    harness.base(), "assessment-service", "test-secret",
                    Clock.fixed(Instant.parse("2026-11-06T00:00:00Z"), ZoneOffset.UTC));
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), supplier);

            HttpProtectedContentSnapshotTransport.Refusal denied = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.DENIED, denied.kind());
            assertFalse(denied.retryable());
            assertQuiet(denied);
            assertEquals(1, harness.calls.size());
            assertEquals("Bearer workload-token", harness.calls.get(0).authorization());
            assertFalse(harness.calls.get(0).body().contains("test-secret"));
            assertFalse(harness.calls.get(0).authorization().contains("test-secret"));
            assertEquals(1, harness.iamCalls.get());
            assertTrue(harness.iamBodies.get(0).contains("test-secret"));

            assertEquals("workload-token", supplier.get());
            assertEquals(2, harness.iamCalls.get());

            status.set(403);
            HttpProtectedContentSnapshotTransport.Refusal forbidden = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.DENIED, forbidden.kind());
            assertQuiet(forbidden);
            assertEquals(2, harness.calls.size());
            assertEquals("Bearer workload-token", harness.calls.get(1).authorization());
            assertEquals(2, harness.iamCalls.get());
            supplier.get();
            assertEquals(3, harness.iamCalls.get());
        }
    }

    @Test
    void transientAndTerminalStatusesAreClassifiedOnce() throws Exception {
        try (Harness harness = new Harness()) {
            AtomicInteger status = new AtomicInteger();
            AtomicReference<String> type = new AtomicReference<>("application/json");
            harness.respond((exchange, call) -> send(exchange, status.get(), secretBody(), type.get()));
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN);
            assertStatus(harness, transport, status, 503, HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, true);
            assertStatus(harness, transport, status, 500, HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, true);
            assertStatus(harness, transport, status, 429, HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, true);
            assertStatus(harness, transport, status, 408, HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, true);
            assertStatus(harness, transport, status, 400, HttpProtectedContentSnapshotTransport.Kind.INVALID, false);
            assertStatus(harness, transport, status, 404, HttpProtectedContentSnapshotTransport.Kind.NOT_FOUND, false);
            assertStatus(harness, transport, status, 409, HttpProtectedContentSnapshotTransport.Kind.CONFLICT, false);
            assertStatus(harness, transport, status, 410, HttpProtectedContentSnapshotTransport.Kind.UNAVAILABLE, false);
            type.set(null);
            assertStatus(harness, transport, status, 404, HttpProtectedContentSnapshotTransport.Kind.NOT_FOUND, false);
        }
    }

    @Test
    void malformedPinsInjectionsAndRedirectsFailClosed() throws Exception {
        IllegalArgumentException userInfo = assertThrows(IllegalArgumentException.class, () ->
                new HttpProtectedContentSnapshotTransport(mapper, "http://user:super-secret@127.0.0.1:9",
                        TOKEN, Duration.ofSeconds(2)));
        assertFalse(userInfo.getMessage().contains("super-secret"));
        assertThrows(IllegalArgumentException.class, () -> new HttpProtectedContentSnapshotTransport(
                mapper, "http://127.0.0.1:9/internal", TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpProtectedContentSnapshotTransport(
                mapper, "http://127.0.0.1:9?next=1", TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpProtectedContentSnapshotTransport(
                mapper, "http://127.0.0.1:9#frag", TOKEN, Duration.ofSeconds(2)));
        assertThrows(IllegalArgumentException.class, () -> new HttpProtectedContentSnapshotTransport(
                mapper, "file:///tmp/content", TOKEN, Duration.ofSeconds(2)));
        IllegalArgumentException blank = assertThrows(IllegalArgumentException.class, () ->
                new HttpProtectedContentSnapshotTransport(mapper, " ", TOKEN, Duration.ofSeconds(2)));
        assertEquals("protected content base url is required", blank.getMessage());
        assertNotNull(new HttpProtectedContentSnapshotTransport(
                mapper, "https://content.internal", TOKEN, Duration.ofSeconds(2)));
        IllegalArgumentException header = assertThrows(IllegalArgumentException.class, () ->
                new HttpProtectedContentSnapshotTransport(mapper, "http://127.0.0.1:9",
                        "bad\r\nX-Injected: 1", Duration.ofSeconds(2)));
        assertFalse(header.getMessage().contains("X-Injected"));
        assertFalse(header.getMessage().contains("\n"));

        String good = goodSnapshot();
        try (Harness harness = new Harness()) {
            AtomicReference<String> payload = new AtomicReference<>(good);
            AtomicInteger status = new AtomicInteger(200);
            AtomicReference<String> type = new AtomicReference<>("application/json");
            harness.respond((exchange, call) -> {
                if ("POST".equals(call.method())) send(exchange, status.get(), payload.get(), type.get());
                else send(exchange, status.get(), payload.get(), type.get());
            });
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN);
            int baseline = harness.calls.size();
            assertKind(assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                    () -> transport.fetch(0, CODE)), HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertKind(assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                    () -> transport.fetch(VERSION, "Reading.Unit")), HttpProtectedContentSnapshotTransport.Kind.INVALID);
            HttpProtectedContentSnapshotTransport bare = injected(harness.base(), () -> "");
            HttpProtectedContentSnapshotTransport.Refusal missing = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> bare.fetch(VERSION, CODE));
            assertEquals("protected content snapshot service token is missing", missing.getMessage());
            HttpProtectedContentSnapshotTransport injectedToken = injected(harness.base(), () -> "bad\r\nX-Injected: 1");
            assertQuiet(assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                    () -> injectedToken.fetch(VERSION, CODE)));
            assertEquals(baseline, harness.calls.size());

            assertPayload(harness, transport, payload, good.replace("\"itemId\":9", "\"itemId\":9.0"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"itemId\":9", "\"itemId\":\"9\""),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"contentVersionId\":1001", "\"contentVersionId\":1001e0"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"displayOrder\":0", "\"displayOrder\":0.0"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"itemId\":2", "\"itemId\":9007199254740992"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload,
                    good.replace("\"pinStatus\":\"PINNED\"", "\"pinStatus\":\"PINNED\",\"pinStatus\":\"PINNED\""),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good + "{\"itemId\":1}",
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload,
                    good.replace("\"pinStatus\":\"PINNED\"", "\"pinStatus\":\"PINNED\",\"fallbackVersionId\":2"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload,
                    good.replace("\"generatedAt\"", "\"startedAt\":\"2026-04-01T00:00:00Z\",\"generatedAt\""),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload,
                    good.replace("\"stem\":\"" + STEM + "\"",
                            "\"stem\":\"" + STEM + "\",\"correctOption\":\"beta-secret-option\""),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"itemId\":2", "\"itemId\":9"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertPayload(harness, transport, payload, good.replace("\"pinStatus\":\"PINNED\"", "\"pinStatus\":\"RECOVERED\""),
                    HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            assertPayload(harness, transport, payload,
                    good.replace("\"recoveryReasonCode\":\"NONE\"", "\"recoveryReasonCode\":\"CONTENT_UNPUBLISHED\""),
                    HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            assertPayload(harness, transport, payload,
                    good.replace("\"contentCode\":\"" + CODE + "\"", "\"contentCode\":\"reading.unit.two\""),
                    HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            assertPayload(harness, transport, payload,
                    good.replace("\"contentVersionId\":1001", "\"contentVersionId\":1002"),
                    HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            type.set("text/plain");
            assertPayload(harness, transport, payload, good, HttpProtectedContentSnapshotTransport.Kind.INVALID);
            type.set("application/json");

            payload.set(good);
            HttpProtectedContentSnapshotTransport.Snapshot snapshot = transport.fetch(VERSION, CODE);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9, "full"), HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9, "HALF"), HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9, "FULL").replace("}", ",\"correctOption\":\"beta-secret-option\"}"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    "{\"data\":" + scoreBody(9, DIGEST_9, "FULL") + "}",
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9, "FULL").replace("\"itemId\":9", "\"itemId\":9.0"),
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9, "FULL") + "{\"x\":1}",
                    HttpProtectedContentSnapshotTransport.Kind.INVALID);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_9.toUpperCase(Locale.ROOT), "FULL"),
                    HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(9, DIGEST_2, "FULL"), HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    scoreBody(2, DIGEST_9, "FULL"), HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
            status.set(409);
            assertScorePayload(harness, transport, snapshot, payload, status,
                    secretBody(), HttpProtectedContentSnapshotTransport.Kind.CONFLICT);
        }

        try (Harness harness = new Harness()) {
            harness.respond((exchange, call) -> {
                exchange.getResponseHeaders().set("Location", "http://127.0.0.1:1/leak-location");
                exchange.sendResponseHeaders(302, -1);
                exchange.close();
            });
            HttpProtectedContentSnapshotTransport transport = new HttpProtectedContentSnapshotTransport(
                    mapper, harness.base(), TOKEN, Duration.ofSeconds(2));
            HttpProtectedContentSnapshotTransport.Refusal redirect = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.INVALID, redirect.kind());
            assertFalse(redirect.retryable());
            assertQuiet(redirect);
            assertEquals(1, harness.calls.size());
            assertEquals("/internal/v1/content/assessment-snapshots/1001", harness.calls.get(0).path());
        }
    }

    @Test
    void declaredChunkedAndDelayedBodiesStayInsideTheCap() throws Exception {
        String payload = goodSnapshot();
        try (Harness harness = new Harness()) {
            harness.respond((exchange, call) -> {
                byte[] body = payload.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, 0);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN);
            HttpProtectedContentSnapshotTransport.Snapshot snapshot = transport.fetch(VERSION, CODE);
            assertEquals(VERSION, snapshot.pin().contentVersionId());
            assertEquals(1, harness.calls.size());
        }

        try (Harness harness = new Harness()) {
            CountDownLatch release = new CountDownLatch(1);
            harness.respond((exchange, call) -> holdOpen(exchange, 200, MAX_BODY_BYTES + 1L, release));
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN, Duration.ofSeconds(5));
            long started = System.nanoTime();
            HttpProtectedContentSnapshotTransport.Refusal refusal;
            try {
                refusal = assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                        () -> transport.fetch(VERSION, CODE));
            } finally {
                release.countDown();
            }
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.INVALID, refusal.kind());
            assertFalse(refusal.retryable());
            assertEquals("protected content snapshot payload is invalid", refusal.getMessage());
            assertQuiet(refusal);
            assertTrue(System.nanoTime() - started < Duration.ofSeconds(2).toNanos());
            assertEquals(1, harness.calls.size());
            assertEquals("Bearer " + TOKEN, harness.calls.get(0).authorization());
            assertEquals("GET", harness.calls.get(0).method());
        }

        try (Harness harness = new Harness()) {
            AtomicLong written = new AtomicLong();
            long target = (long) MAX_BODY_BYTES + 16L * 1024L * 1024L;
            CountDownLatch serverDone = new CountDownLatch(1);
            harness.respond((exchange, call) -> {
                byte[] chunk = new byte[8192];
                try {
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, 0);
                    java.io.OutputStream out = exchange.getResponseBody();
                    while (written.get() < target) {
                        out.write(chunk);
                        out.flush();
                        written.addAndGet(chunk.length);
                    }
                } catch (java.io.IOException closed) {
                    // The client closed the capped stream.
                } finally {
                    exchange.close();
                    serverDone.countDown();
                }
            });
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN);
            HttpProtectedContentSnapshotTransport.Refusal refusal = assertThrows(
                    HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
            assertTrue(serverDone.await(8, TimeUnit.SECONDS));
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.INVALID, refusal.kind());
            assertFalse(refusal.retryable());
            assertEquals("protected content snapshot payload is invalid", refusal.getMessage());
            assertQuiet(refusal);
            assertTrue(written.get() >= MAX_BODY_BYTES);
            assertTrue(written.get() < target);
            assertEquals(1, harness.calls.size());
        }

        try (Harness harness = new Harness()) {
            CountDownLatch release = new CountDownLatch(1);
            harness.respond((exchange, call) -> {
                byte[] body = payload.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().flush();
                try {
                    if (!release.await(8, TimeUnit.SECONDS)) {
                        exchange.getResponseBody().write(body);
                    }
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                } catch (java.io.IOException closed) {
                    // The deadline closed the stalled body.
                } finally {
                    exchange.close();
                }
            });
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), () -> TOKEN, Duration.ofSeconds(1));
            long started = System.nanoTime();
            HttpProtectedContentSnapshotTransport.Refusal refusal;
            try {
                refusal = assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                        () -> transport.fetch(VERSION, CODE));
            } finally {
                release.countDown();
            }
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.TRANSIENT, refusal.kind());
            assertTrue(refusal.retryable());
            assertEquals("protected content snapshot transport failed", refusal.getMessage());
            assertQuiet(refusal);
            assertTrue(System.nanoTime() - started < Duration.ofSeconds(4).toNanos());
            assertEquals(1, harness.calls.size());
            assertEquals("Bearer " + TOKEN, harness.calls.get(0).authorization());
        }

        try (Harness harness = new Harness()) {
            CountDownLatch release = new CountDownLatch(1);
            harness.respond((exchange, call) -> holdOpen(exchange, 401, MAX_BODY_BYTES + 1L, release));
            IamServiceTokenSupplier supplier = new IamServiceTokenSupplier(mapper, HttpClient.newHttpClient(),
                    harness.base(), "assessment-service", "test-secret",
                    Clock.fixed(Instant.parse("2026-11-06T00:00:00Z"), ZoneOffset.UTC));
            HttpProtectedContentSnapshotTransport transport = injected(harness.base(), supplier, Duration.ofSeconds(5));
            long started = System.nanoTime();
            HttpProtectedContentSnapshotTransport.Refusal refusal;
            try {
                refusal = assertThrows(HttpProtectedContentSnapshotTransport.Refusal.class,
                        () -> transport.fetch(VERSION, CODE));
            } finally {
                release.countDown();
            }
            assertTrue(System.nanoTime() - started < Duration.ofSeconds(2).toNanos());
            assertEquals(HttpProtectedContentSnapshotTransport.Kind.DENIED, refusal.kind());
            assertFalse(refusal.retryable());
            assertEquals("protected content snapshot was denied", refusal.getMessage());
            assertQuiet(refusal);
            assertEquals(1, harness.calls.size());
            assertEquals("Bearer workload-token", harness.calls.get(0).authorization());
            assertEquals(1, harness.iamCalls.get());
            assertEquals("workload-token", supplier.get());
            assertEquals(2, harness.iamCalls.get());
        }
    }

    private static void holdOpen(com.sun.net.httpserver.HttpExchange exchange, int status, long length,
                                 CountDownLatch release) throws java.io.IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, length);
        exchange.getResponseBody().flush();
        try {
            if (!release.await(8, TimeUnit.SECONDS)) return;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } finally {
            exchange.close();
        }
    }

    private void assertStatus(Harness harness, HttpProtectedContentSnapshotTransport transport,
                              AtomicInteger status, int code, HttpProtectedContentSnapshotTransport.Kind kind,
                              boolean retryable) {
        status.set(code);
        int before = harness.calls.size();
        HttpProtectedContentSnapshotTransport.Refusal refusal = assertThrows(
                HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
        assertEquals(kind, refusal.kind());
        assertEquals(retryable, refusal.retryable());
        assertQuiet(refusal);
        assertEquals(before + 1, harness.calls.size());
    }

    private void assertPayload(Harness harness, HttpProtectedContentSnapshotTransport transport,
                               AtomicReference<String> payload, String json,
                               HttpProtectedContentSnapshotTransport.Kind kind) {
        payload.set(json);
        int before = harness.calls.size();
        HttpProtectedContentSnapshotTransport.Refusal refusal = assertThrows(
                HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.fetch(VERSION, CODE));
        assertKind(refusal, kind);
        assertEquals(before + 1, harness.calls.size());
        assertEquals("GET", harness.calls.get(harness.calls.size() - 1).method());
    }

    private void assertScorePayload(Harness harness, HttpProtectedContentSnapshotTransport transport,
                                    HttpProtectedContentSnapshotTransport.Snapshot snapshot,
                                    AtomicReference<String> payload, AtomicInteger status, String json,
                                    HttpProtectedContentSnapshotTransport.Kind kind) {
        payload.set(json);
        int before = harness.calls.size();
        HttpProtectedContentSnapshotTransport.Refusal refusal = assertThrows(
                HttpProtectedContentSnapshotTransport.Refusal.class, () -> transport.score(snapshot, 9L, "beta"));
        assertKind(refusal, kind);
        assertEquals(before + 1, harness.calls.size());
        Call call = harness.calls.get(harness.calls.size() - 1);
        assertEquals("POST", call.method());
        assertEquals("/internal/v1/content/assessment-snapshots/1001/score", call.path());
        if (status.get() == 200) assertClosedScore(call, 9L, "beta", DIGEST_9);
        status.set(200);
    }

    private static void assertKind(HttpProtectedContentSnapshotTransport.Refusal refusal,
                                   HttpProtectedContentSnapshotTransport.Kind kind) {
        assertEquals(kind, refusal.kind());
        assertFalse(refusal.retryable());
        assertQuiet(refusal);
    }

    private static void assertQuiet(HttpProtectedContentSnapshotTransport.Refusal refusal) {
        assertNull(refusal.getCause());
        for (String secret : SECRETS) assertFalse(refusal.getMessage().contains(secret));
        assertFalse(refusal.getMessage().contains("\n"));
        assertFalse(refusal.getMessage().contains("{"));
    }

    private static void assertClosedScore(Call call, long itemId, String selected, String digest) {
        assertEquals("POST", call.method());
        assertEquals("/internal/v1/content/assessment-snapshots/1001/score", call.path());
        assertNull(call.query());
        assertEquals("Bearer " + TOKEN, call.authorization());
        assertEquals("application/json", call.accept());
        assertEquals("application/json", call.contentType());
        assertFalse(call.forbiddenHeader());
        String body = call.body();
        int contentCode = body.indexOf("\"contentCode\"");
        int item = body.indexOf("\"itemId\"");
        int option = body.indexOf("\"selectedOptionId\"");
        int snapshot = body.indexOf("\"snapshotId\"");
        int hash = body.indexOf("\"snapshotHash\"");
        int rule = body.indexOf("\"ruleDigest\"");
        assertTrue(contentCode >= 0 && contentCode < item && item < option && option < snapshot
                && snapshot < hash && hash < rule);
        assertEquals(contentCode, body.lastIndexOf("\"contentCode\""));
        assertEquals(item, body.lastIndexOf("\"itemId\""));
        assertTrue(body.contains("\"contentCode\":\"" + CODE + "\""));
        assertTrue(body.contains("\"itemId\":" + itemId));
        assertTrue(body.contains("\"selectedOptionId\":\"" + selected + "\""));
        assertTrue(body.contains("\"snapshotId\":\"" + SNAPSHOT_ID + "\""));
        assertTrue(body.contains("\"snapshotHash\":\"" + HASH + "\""));
        assertTrue(body.contains("\"ruleDigest\":\"" + digest + "\""));
        assertFalse(body.contains("contentVersionId"));
        assertFalse(body.contains("correctOption"));
        assertFalse(body.contains("startedAt"));
        assertFalse(body.contains("placement"));
        assertFalse(body.contains(TOKEN));
        assertFalse(body.contains("Bearer"));
        assertFalse(body.contains("role"));
    }

    private HttpProtectedContentSnapshotTransport injected(String base, java.util.function.Supplier<String> token) {
        return injected(base, token, Duration.ofSeconds(2));
    }

    private HttpProtectedContentSnapshotTransport injected(String base, java.util.function.Supplier<String> token,
                                                          Duration timeout) {
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new HttpProtectedContentSnapshotTransport(mapper, base, token, timeout, http);
    }

    private String goodSnapshot() {
        return "{\"data\":{\"pin\":{\"contentCode\":\"" + CODE + "\",\"contentVersionId\":1001,\"contentEpoch\":4,"
                + "\"snapshotId\":\"" + SNAPSHOT_ID + "\",\"snapshotHash\":\"" + HASH + "\","
                + "\"pinStatus\":\"PINNED\",\"pinnedAt\":\"" + PUBLISHED + "\",\"recoveryReasonCode\":\"NONE\"},"
                + "\"snapshotVersion\":3,\"answerRuleSetVersion\":\"" + VERSION_DIGEST + "\",\"items\":["
                + item(9, 0, STEM, DIGEST_9, "beta", LABEL, "alpha", "R-alpha") + ","
                + item(2, 1, "First", DIGEST_2, "aye", "L-aye", "bee", "R-bee")
                + "],\"generatedAt\":\"" + GENERATED + "\"}}";
    }

    private static String item(long id, int order, String stem, String digest, String left, String leftLabel,
                               String right, String rightLabel) {
        return "{\"itemId\":" + id + ",\"itemCode\":\"item." + id + "\",\"itemType\":\"READING\",\"stem\":\""
                + stem + "\",\"options\":[{\"optionId\":\"" + left + "\",\"label\":\"" + leftLabel
                + "\"},{\"optionId\":\"" + right + "\",\"label\":\"" + rightLabel + "\"}],\"displayOrder\":"
                + order + ",\"ruleContract\":{\"ruleRef\":\"rule:reading." + id + "\",\"answerRuleVersion\":\""
                + VERSION_DIGEST + "\",\"ruleDigest\":\"" + digest
                + "\",\"evaluationMode\":\"DETERMINISTIC\",\"sealed\":true}}";
    }

    private static String scoreBody(long itemId, String digest, String outcome) {
        return "{\"itemId\":" + itemId + ",\"snapshotId\":\"" + SNAPSHOT_ID + "\",\"ruleDigest\":\""
                + digest + "\",\"outcome\":\"" + outcome + "\"}";
    }

    private static String secretBody() {
        return "{\"correctOption\":\"beta-secret-option\",\"selectedOptionId\":\"beta\","
                + "\"accessToken\":\"workload-token\",\"clientSecret\":\"test-secret\","
                + "\"learnerJwt\":\"learner-jwt-body\",\"readingRuleSeal\":\"seal-value\"}";
    }

    private static List<String> names(Class<?> type) {
        List<String> names = new ArrayList<>();
        for (RecordComponent component : type.getRecordComponents()) names.add(component.getName());
        return names;
    }

    private void send(HttpExchange exchange, int status, String body) throws java.io.IOException {
        send(exchange, status, body, "application/json");
    }

    private void send(HttpExchange exchange, int status, String body, String contentType) throws java.io.IOException {
        if (contentType != null) exchange.getResponseHeaders().set("Content-Type", contentType);
        if (body == null) {
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
            return;
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private final class Harness implements AutoCloseable {
        private final HttpServer server;
        private final List<Call> calls = new ArrayList<>();
        private final List<String> iamBodies = new ArrayList<>();
        private final AtomicInteger iamCalls = new AtomicInteger();
        private Responder responder = (exchange, call) -> send(exchange, 500, secretBody());

        private Harness() throws java.io.IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/internal/v1/iam/service-token", exchange -> {
                iamCalls.incrementAndGet();
                iamBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                send(exchange, 200, "{\"accessToken\":\"workload-token\",\"expiresIn\":300}");
            });
            server.createContext("/internal/v1/content/assessment-snapshots", this::content);
            server.start();
        }

        private String base() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        private void snapshot(String json) {
            respond((exchange, call) -> {
                if ("POST".equals(call.method())) {
                    String outcome = call.body().contains("\"itemId\":2") ? "ZERO"
                            : call.body().contains("\"selectedOptionId\":\"beta\"") ? "FULL" : "ZERO";
                    long itemId = call.body().contains("\"itemId\":2") ? 2L : 9L;
                    String digest = itemId == 2L ? DIGEST_2 : DIGEST_9;
                    if (!call.body().contains("\"ruleDigest\":\"" + digest + "\"")
                            || !call.body().contains("\"snapshotHash\":\"" + HASH + "\"")
                            || !call.body().contains("\"contentCode\":\"" + CODE + "\"")) {
                        send(exchange, 409, secretBody());
                        return;
                    }
                    send(exchange, 200, scoreBody(itemId, digest, outcome));
                } else {
                    send(exchange, 200, json);
                }
            });
        }

        private void respond(Responder responder) {
            this.responder = responder;
        }

        private void content(HttpExchange exchange) throws java.io.IOException {
            Call call = Call.capture(exchange);
            calls.add(call);
            responder.respond(exchange, call);
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }

    @FunctionalInterface
    private interface Responder {
        void respond(HttpExchange exchange, Call call) throws java.io.IOException;
    }

    private record Call(String method, String path, String query, String authorization, String contentType,
                        String accept, String body, boolean forbiddenHeader) {
        private static Call capture(HttpExchange exchange) throws java.io.IOException {
            boolean forbidden = false;
            for (String name : exchange.getRequestHeaders().keySet()) {
                if (name != null && (name.equalsIgnoreCase("x-role")
                        || name.equalsIgnoreCase("x-b5-role")
                        || name.equalsIgnoreCase("cookie"))) {
                    forbidden = true;
                }
            }
            return new Call(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                    exchange.getRequestURI().getRawQuery(),
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    exchange.getRequestHeaders().getFirst("Content-Type"),
                    exchange.getRequestHeaders().getFirst("Accept"),
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
                    forbidden);
        }
    }
}
