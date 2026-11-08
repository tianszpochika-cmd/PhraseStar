package com.englishflow.learning.adapter.http;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;

import org.junit.jupiter.api.Test;

import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpAssessmentMistakeFeedTest {
    @Test
    void theFeedReadsTheAdmittedFactWithoutTheAnswer() {
        String body = """
                {"data":{"items":[{"itemId":266004,"scoreBucket":"ZERO","errorCategory":"UNCLASSIFIED",
                "contentCode":"p1.placement.v1","reasonTrace":[{"sourceAttemptId":"aatm_1","errorCategory":"UNCLASSIFIED"}],
                "answerHash":"hidden"}],"count":1}}
                """;
        List<Map<String, Object>> facts = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091")
                .parse(body);
        assertEquals(1, facts.size());
        assertEquals(266004, facts.getFirst().get("itemId"));
        assertEquals("ZERO", facts.getFirst().get("scoreBucket"));
        assertEquals("aatm_1", facts.getFirst().get("sourceAttemptId"));
        org.junit.jupiter.api.Assertions.assertFalse(facts.getFirst().containsKey("answerHash"));
    }

    @Test
    void theFeedReadsCanonicalCursorMetaAndLeavesCursorStateOutOfFacts() {
        String body = """
                {"data":{"items":[{"itemId":7,"scoreBucket":"ZERO","errorCategory":"UNCLASSIFIED",
                "contentCode":"p1.placement.v1","sourceAttemptId":"aatm_2"}],"count":1},
                "meta":{"hasMore":true,"pageSize":1,"nextCursor":"v1.mid.7xxxxxxxx"}}
                """;
        HttpAssessmentMistakeFeed feed = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091");
        HttpAssessmentMistakeFeed.Page page = feed.parsePage(body);
        assertEquals(1, page.facts().size());
        assertEquals(7, page.facts().getFirst().get("itemId"));
        assertEquals(true, page.hasMore());
        assertEquals("v1.mid.7xxxxxxxx", page.nextCursor());
        org.junit.jupiter.api.Assertions.assertFalse(page.facts().getFirst().containsKey("nextCursor"));
        org.junit.jupiter.api.Assertions.assertFalse(page.facts().getFirst().containsKey("hasMore"));
    }

    @Test
    void aCompleteHttpWalkReturnsEveryPageAndDoesNotWriteAPrefix() {
        AtomicInteger calls = new AtomicInteger();
        withServer((page, cursor) -> {
            calls.incrementAndGet();
            if (cursor == null) return ok(List.of(1, 2), "cursor-a", true);
            assertEquals("cursor-a", cursor);
            return ok(List.of(3), null, false);
        }, (feed, url) -> {
            List<Map<String, Object>> facts = feed.list("token");
            assertEquals(List.of("1", "2", "3"), ids(facts));
            assertEquals(2, calls.get());
        });
    }

    @Test
    void aMissingFirstPage401ThrowsAndDoesNotReturnEmptySuccess() {
        withServer((page, cursor) -> new Stub(401, "denied", 0), (feed, url) -> {
            AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                    () -> feed.list("token"));
            assertEquals(401, thrown.statusCode());
        });
    }

    @Test
    void aFirstPage403ThrowsAndDoesNotReturnEmptySuccess() {
        withServer((page, cursor) -> new Stub(403, "forbidden", 0), (feed, url) -> {
            AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                    () -> feed.list("token"));
            assertEquals(403, thrown.statusCode());
        });
    }

    @Test
    void aLaterPage401ThrowsAndDoesNotReturnThePrefix() {
        withServer((page, cursor) -> cursor == null ? ok(List.of(1, 2), "cursor-a", true) : new Stub(401, "denied", 0),
                (feed, url) -> {
                    AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                            () -> feed.list("token"));
                    assertEquals(401, thrown.statusCode());
                });
    }

    @Test
    void aLaterPage500ThrowsAndDoesNotReturnThePrefix() {
        withServer((page, cursor) -> cursor == null ? ok(List.of(1), "cursor-a", true) : new Stub(500, "broken", 0),
                (feed, url) -> {
                    AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                            () -> feed.list("token"));
                    assertEquals(500, thrown.statusCode());
                });
    }

    @Test
    void aMalformedLaterPageThrowsAndDoesNotEndTheBook() {
        withServer((page, cursor) -> cursor == null ? ok(List.of(1), "cursor-a", true) : new Stub(200, "{not-json", 0),
                (feed, url) -> {
                    AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                            () -> feed.list("token"));
                    assertEquals(502, thrown.statusCode());
                    assertTrue(thrown.getMessage().contains("JSON") || thrown.getMessage().contains("page"));
                });
    }

    @Test
    void aRepeatedCursorThrowsAndDoesNotLoopFacts() {
        AtomicInteger ids = new AtomicInteger();
        withServer((page, cursor) -> ok(List.of(ids.incrementAndGet()), "cursor-a", true), (feed, url) -> {
            AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                    () -> feed.list("token"));
            assertEquals(502, thrown.statusCode());
            assertTrue(thrown.getMessage().contains("repeated a cursor"));
        });
    }

    @Test
    void aPageBudgetWithHasMoreThrows() {
        AtomicInteger calls = new AtomicInteger();
        withServer(1, Duration.ofSeconds(2), (page, cursor) -> {
            int n = calls.incrementAndGet();
            return ok(List.of(n), "cursor-" + n, true);
        }, (feed, url) -> {
            AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                    () -> feed.list("token"));
            assertEquals(502, thrown.statusCode());
            assertTrue(thrown.getMessage().contains("page budget"));
            assertEquals(1, calls.get());
        });
    }

    @Test
    void aTimeoutThrowsAndDoesNotReturnAPrefix() {
        withServer(10_000, Duration.ofMillis(150), (page, cursor) -> new Stub(200, ok(List.of(1), null, false).body, 400),
                (feed, url) -> {
                    AssessmentMistakeFeedException thrown = assertThrows(AssessmentMistakeFeedException.class,
                            () -> feed.list("token"));
                    assertEquals(504, thrown.statusCode());
                });
    }

    @Test
    void parseFailureOnACompleteLookingEmptyObjectThrows() {
        HttpAssessmentMistakeFeed feed = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091");
        assertThrows(AssessmentMistakeFeedException.class, () -> feed.parsePage("{}"));
        assertThrows(AssessmentMistakeFeedException.class, () -> feed.parsePage("[]"));
        assertThrows(AssessmentMistakeFeedException.class, () -> feed.parsePage("{"));
    }

    private static List<String> ids(List<Map<String, Object>> facts) {
        List<String> ids = new ArrayList<>();
        for (Map<String, Object> fact : facts) ids.add(String.valueOf(fact.get("itemId")));
        return ids;
    }

    private static Stub ok(List<Integer> itemIds, String nextCursor, boolean hasMore) {
        StringBuilder items = new StringBuilder();
        for (int i = 0; i < itemIds.size(); i++) {
            if (i > 0) items.append(',');
            items.append("{\"itemId\":").append(itemIds.get(i)).append(",\"scoreBucket\":\"ZERO\"}");
        }
        String meta = hasMore
                ? "\"meta\":{\"hasMore\":true,\"pageSize\":100,\"nextCursor\":\"" + nextCursor + "\"}"
                : "\"meta\":{\"hasMore\":false,\"pageSize\":100,\"nextCursor\":null}";
        return new Stub(200, "{\"data\":{\"items\":[" + items + "],\"count\":" + itemIds.size() + "}," + meta + "}", 0);
    }

    private static void withServer(BiFunction<Integer, String, Stub> pages, FeedCheck check) {
        withServer(HttpAssessmentMistakeFeed.DEFAULT_MAX_PAGES, Duration.ofSeconds(2), pages, check);
    }

    private static void withServer(int maxPages, Duration timeout, BiFunction<Integer, String, Stub> pages,
            FeedCheck check) {
        HttpServer server = null;
        try {
            AtomicInteger page = new AtomicInteger();
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/internal/v1/assessment/mistakes", exchange -> {
                String query = exchange.getRequestURI().getRawQuery();
                String cursor = null;
                if (query != null) {
                    for (String part : query.split("&")) {
                        if (part.startsWith("cursor=")) {
                            cursor = java.net.URLDecoder.decode(part.substring(7), StandardCharsets.UTF_8);
                        }
                    }
                }
                Stub stub = pages.apply(page.getAndIncrement(), cursor);
                if (stub.delayMs > 0) {
                    try {
                        Thread.sleep(stub.delayMs);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                    }
                }
                byte[] bytes = stub.body.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(stub.status, bytes.length);
                exchange.getResponseBody().write(bytes);
                exchange.close();
            });
            server.start();
            String url = "http://127.0.0.1:" + server.getAddress().getPort();
            HttpAssessmentMistakeFeed feed = new HttpAssessmentMistakeFeed(new ObjectMapper(), url,
                    HttpClient.newBuilder().connectTimeout(Duration.ofMillis(200)).build(), timeout, maxPages);
            check.run(feed, url);
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        } finally {
            if (server != null) server.stop(0);
        }
    }

    private record Stub(int status, String body, long delayMs) {
    }

    @FunctionalInterface
    private interface FeedCheck {
        void run(HttpAssessmentMistakeFeed feed, String url) throws Exception;
    }
}
