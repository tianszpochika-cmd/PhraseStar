package com.englishflow.workflow.domain;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Cursor paging for unfinished sagas. Ordering is {@code started_at, saga_id} so the
 * recovery list is oldest-first and unique even when {@code updated_at} moves.
 * Cursor state is opaque and derived from an actual returned row. The encoded
 * instant uses microsecond precision so it round-trips to the SQL bind.
 */
public final class UnfinishedSagaPaging {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;
    static final Pattern CURSOR_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{8,512}$");
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String VERSION = "v1";
    private static final DateTimeFormatter CURSOR_INSTANT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC);
    private static final Comparator<SagaStore.SagaRecord> ORDER =
            Comparator.comparing(SagaStore.SagaRecord::startedAt).thenComparing(SagaStore.SagaRecord::sagaId);

    private UnfinishedSagaPaging() {
    }

    public record Position(Instant startedAt, String sagaId) {
        public Position {
            if (startedAt == null || sagaId == null || sagaId.isBlank()) {
                throw new IllegalArgumentException("cursor is invalid");
            }
        }
    }

    public static int requestPageSize(Integer pageSize) {
        if (pageSize == null) {
            return DEFAULT_PAGE_SIZE;
        }
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("pageSize is invalid");
        }
        return pageSize;
    }

    public static int clampLimit(int limit) {
        if (limit < 1) {
            return 1;
        }
        return Math.min(limit, MAX_PAGE_SIZE);
    }

    public static boolean unfinished(SagaStatus status) {
        return status != null && !status.isTerminal();
    }

    public static String formatStartedAt(Instant startedAt) {
        if (startedAt == null) {
            throw new IllegalArgumentException("cursor is invalid");
        }
        return CURSOR_INSTANT.format(startedAt.truncatedTo(ChronoUnit.MICROS));
    }

    public static Position decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        if (!CURSOR_PATTERN.matcher(cursor).matches()) {
            throw new IllegalArgumentException("cursor is invalid");
        }
        try {
            byte[] bytes = DECODER.decode(cursor);
            String payload = new String(bytes, StandardCharsets.UTF_8);
            int first = payload.indexOf('|');
            int second = first < 0 ? -1 : payload.indexOf('|', first + 1);
            if (bytes.length == 0 || bytes.length > 256 || first <= 0 || second <= first
                    || payload.indexOf('|', second + 1) >= 0
                    || !VERSION.equals(payload.substring(0, first))) {
                throw new IllegalArgumentException("cursor is invalid");
            }
            Instant startedAt = Instant.parse(payload.substring(first + 1, second)).truncatedTo(ChronoUnit.MICROS);
            String sagaId = payload.substring(second + 1);
            if (sagaId.length() < 8 || sagaId.length() > 128
                    || sagaId.codePoints().anyMatch(Character::isISOControl)
                    || !ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8)).equals(cursor)) {
                throw new IllegalArgumentException("cursor is invalid");
            }
            return new Position(startedAt, sagaId);
        } catch (IllegalArgumentException | java.time.DateTimeException invalid) {
            throw new IllegalArgumentException("cursor is invalid");
        }
    }

    public static String encode(SagaStore.SagaRecord row) {
        if (row == null || row.startedAt() == null || row.sagaId() == null || row.sagaId().isBlank()) {
            throw new IllegalArgumentException("cursor is invalid");
        }
        String payload = VERSION + '|' + formatStartedAt(row.startedAt()) + '|' + row.sagaId();
        String cursor = ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        if (!CURSOR_PATTERN.matcher(cursor).matches()) {
            throw new IllegalArgumentException("cursor is invalid");
        }
        return cursor;
    }

    public static int compare(SagaStore.SagaRecord row, Position after) {
        int byTime = row.startedAt().compareTo(after.startedAt());
        if (byTime != 0) {
            return byTime;
        }
        return row.sagaId().compareTo(after.sagaId());
    }

    public static SagaStore.UnfinishedPage slice(List<SagaStore.SagaRecord> rows, String cursor, int pageSize) {
        int size = requestPageSize(pageSize);
        Position after = decode(cursor);
        List<SagaStore.SagaRecord> ordered = rows.stream()
                .filter(row -> unfinished(row.status()))
                .sorted(ORDER)
                .toList();
        List<SagaStore.SagaRecord> remaining = new ArrayList<>();
        for (SagaStore.SagaRecord row : ordered) {
            if (after == null || compare(row, after) > 0) {
                remaining.add(row);
            }
        }
        boolean hasMore = remaining.size() > size;
        List<SagaStore.SagaRecord> items = hasMore ? List.copyOf(remaining.subList(0, size)) : List.copyOf(remaining);
        String nextCursor = hasMore ? encode(items.get(items.size() - 1)) : null;
        return new SagaStore.UnfinishedPage(items, hasMore, nextCursor, size);
    }
}
