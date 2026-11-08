package com.englishflow.learning.adapter.http;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import tools.jackson.databind.ObjectMapper;

/**
 * Reads assessment-owned ZERO mistakes for the caller. Learning does not open
 * the assessment schema. The same facts are written to
 * {@code learning.mistake.admitted.v1} in the assessment outbox; this feed is
 * the local consumer while the Kafka relay is off.
 *
 * <p>A walk either finishes or throws. A later 401/403/500, timeout, parse
 * failure, repeated cursor, duplicate id, or budget exit with {@code hasMore}
 * is not a successful prefix or empty book.
 */
public final class HttpAssessmentMistakeFeed {
    static final int DEFAULT_MAX_PAGES = 10_000;
    static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(4);

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String assessmentBaseUrl;
    private final Duration requestTimeout;
    private final int maxPages;

    public HttpAssessmentMistakeFeed(ObjectMapper mapper, String assessmentBaseUrl) {
        this(mapper, assessmentBaseUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_MAX_PAGES);
    }

    HttpAssessmentMistakeFeed(ObjectMapper mapper, String assessmentBaseUrl, HttpClient http,
            Duration requestTimeout, int maxPages) {
        this.mapper = mapper;
        this.http = http;
        String base = assessmentBaseUrl == null ? "" : assessmentBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        this.assessmentBaseUrl = base;
        this.requestTimeout = requestTimeout == null ? DEFAULT_REQUEST_TIMEOUT : requestTimeout;
        this.maxPages = maxPages < 1 ? 1 : maxPages;
    }

    public List<Map<String, Object>> list(String bearer) {
        if (bearer == null || bearer.isBlank()) {
            throw new AssessmentMistakeFeedException(401, "assessment mistake feed missing bearer");
        }
        if (!assessmentBaseUrl.startsWith("http")) {
            throw new AssessmentMistakeFeedException(503, "assessment mistake feed is not configured");
        }
        List<Map<String, Object>> facts = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();
        Set<String> seenCursors = new HashSet<>();
        String cursor = null;
        try {
            for (int page = 0; page < maxPages; page++) {
                HttpResponse<String> response = send(cursor, bearer);
                int status = response.statusCode();
                if (status != 200) {
                    throw new AssessmentMistakeFeedException(status,
                            "assessment mistake feed returned " + status);
                }
                Page parsed = parsePage(response.body());
                if (parsed.hasMore && parsed.facts.isEmpty()) {
                    throw new AssessmentMistakeFeedException(502,
                            "assessment mistake feed made no progress");
                }
                for (Map<String, Object> fact : parsed.facts) {
                    String id = String.valueOf(fact.get("itemId"));
                    if (seenIds.contains(id)) {
                        throw new AssessmentMistakeFeedException(502,
                                "assessment mistake feed duplicated an item");
                    }
                    seenIds.add(id);
                    facts.add(fact);
                }
                if (!parsed.hasMore) {
                    return List.copyOf(facts);
                }
                if (parsed.nextCursor == null || parsed.nextCursor.isBlank()) {
                    throw new AssessmentMistakeFeedException(502,
                            "assessment mistake feed has more without a cursor");
                }
                if (parsed.nextCursor.equals(cursor) || seenCursors.contains(parsed.nextCursor)) {
                    throw new AssessmentMistakeFeedException(502,
                            "assessment mistake feed repeated a cursor");
                }
                seenCursors.add(parsed.nextCursor);
                cursor = parsed.nextCursor;
            }
            throw new AssessmentMistakeFeedException(502,
                    "assessment mistake feed exceeded the page budget");
        } catch (AssessmentMistakeFeedException exception) {
            throw exception;
        } catch (HttpTimeoutException exception) {
            throw new AssessmentMistakeFeedException(504, "assessment mistake feed timed out", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssessmentMistakeFeedException(504, "assessment mistake feed unavailable", exception);
        } catch (IOException exception) {
            throw new AssessmentMistakeFeedException(504, "assessment mistake feed unavailable", exception);
        }
    }

    List<Map<String, Object>> parse(String body) {
        return parsePage(body).facts;
    }

    Page parsePage(String body) {
        Object parsed;
        try {
            parsed = mapper.readValue(body, Object.class);
        } catch (Exception exception) {
            throw new AssessmentMistakeFeedException(502, "assessment mistake feed body is not JSON", exception);
        }
        if (!(parsed instanceof Map<?, ?> map) || map.isEmpty()) {
            throw new AssessmentMistakeFeedException(502, "assessment mistake feed body is not a page");
        }
        Object data = map.get("data");
        Object items = data instanceof Map<?, ?> dataMap ? dataMap.get("items") : null;
        if (!(items instanceof List<?> list)) {
            throw new AssessmentMistakeFeedException(502, "assessment mistake feed body is not a page");
        }
        List<Map<String, Object>> facts = new ArrayList<>();
        for (Object entry : list) {
            if (!(entry instanceof Map<?, ?> raw)) {
                throw new AssessmentMistakeFeedException(502, "assessment mistake feed body is not a page");
            }
            Map<String, Object> fact = new LinkedHashMap<>();
            fact.put("itemId", raw.get("itemId"));
            fact.put("scoreBucket", raw.get("scoreBucket") == null ? "ZERO" : raw.get("scoreBucket"));
            fact.put("errorCategory", raw.get("errorCategory"));
            fact.put("contentCode", raw.get("contentCode"));
            fact.put("sourceAttemptId", sourceAttempt(raw));
            facts.add(fact);
        }
        Object meta = map.get("meta");
        boolean hasMore = meta instanceof Map<?, ?> metaMap && Boolean.TRUE.equals(metaMap.get("hasMore"));
        String nextCursor = null;
        if (meta instanceof Map<?, ?> metaMap) {
            Object cursor = metaMap.get("nextCursor");
            if (cursor instanceof String text && !text.isBlank()) nextCursor = text;
        }
        if (!hasMore) nextCursor = null;
        return new Page(List.copyOf(facts), hasMore, nextCursor);
    }

    record Page(List<Map<String, Object>> facts, boolean hasMore, String nextCursor) {
    }

    private HttpResponse<String> send(String cursor, String bearer) throws IOException, InterruptedException {
        StringBuilder uri = new StringBuilder(assessmentBaseUrl)
                .append("/internal/v1/assessment/mistakes?pageSize=100");
        if (cursor != null) {
            uri.append("&cursor=").append(URLEncoder.encode(cursor, StandardCharsets.UTF_8));
        }
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(uri.toString()))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + bearer.trim())
                .timeout(requestTimeout)
                .GET()
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static String sourceAttempt(Map<?, ?> raw) {
        Object direct = raw.get("sourceAttemptId");
        if (direct != null && !String.valueOf(direct).isBlank()) return String.valueOf(direct).trim();
        Object trace = raw.get("reasonTrace");
        if (!(trace instanceof List<?> entries)) return "";
        String found = "";
        for (Object entry : entries) {
            if (!(entry instanceof Map<?, ?> row)) continue;
            Object value = row.get("sourceAttemptId");
            if (value != null && !String.valueOf(value).isBlank()) found = String.valueOf(value).trim();
        }
        return found;
    }
}
