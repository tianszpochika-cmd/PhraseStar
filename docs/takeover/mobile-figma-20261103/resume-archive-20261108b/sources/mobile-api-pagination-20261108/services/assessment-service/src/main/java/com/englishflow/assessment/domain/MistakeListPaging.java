package com.englishflow.assessment.domain;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Cursor paging for assessment-owned mistake facts. Owner and tenant filters run
 * before the keyset; order is unique {@code mistake_id} ascending. The next
 * cursor is taken from an actual returned row.
 */
public final class MistakeListPaging {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;
    static final Pattern CURSOR_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{8,512}$");
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String VERSION = "asm.v1";

    private MistakeListPaging() {
    }

    public record Page<T>(List<T> items, boolean hasMore, String nextCursor, int pageSize) {
        public Page {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    public static int requestPageSize(Integer pageSize) {
        if (pageSize == null) {
            return DEFAULT_PAGE_SIZE;
        }
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
            throw AssessmentDomainException.invalid("ASM_PAGE_SIZE_INVALID", "pageSize is invalid");
        }
        return pageSize;
    }

    public static Long decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        if (!CURSOR_PATTERN.matcher(cursor).matches()) {
            throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
        }
        try {
            byte[] bytes = DECODER.decode(cursor);
            String payload = new String(bytes, StandardCharsets.UTF_8);
            int separator = payload.indexOf('|');
            if (bytes.length == 0 || bytes.length > 64 || separator != VERSION.length()
                    || !VERSION.equals(payload.substring(0, separator))
                    || payload.indexOf('|', separator + 1) >= 0
                    || !ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8)).equals(cursor)) {
                throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
            }
            long mistakeId = Long.parseLong(payload.substring(separator + 1));
            if (mistakeId < 1) {
                throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
            }
            return mistakeId;
        } catch (IllegalArgumentException invalid) {
            throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
        }
    }

    public static String encode(long mistakeId) {
        if (mistakeId < 1) {
            throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
        }
        String payload = VERSION + '|' + mistakeId;
        String cursor = ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        if (!CURSOR_PATTERN.matcher(cursor).matches()) {
            throw AssessmentDomainException.invalid("ASM_CURSOR_INVALID", "cursor is invalid");
        }
        return cursor;
    }

    public static <T> Page<T> slice(List<T> ownedOrdered, String cursor, int pageSize, java.util.function.ToLongFunction<T> idOf) {
        int size = requestPageSize(pageSize);
        Long afterId = decode(cursor);
        List<T> remaining = new ArrayList<>();
        for (T row : ownedOrdered) {
            long id = idOf.applyAsLong(row);
            if (afterId == null || id > afterId) {
                remaining.add(row);
            }
        }
        boolean hasMore = remaining.size() > size;
        List<T> items = hasMore ? List.copyOf(remaining.subList(0, size)) : List.copyOf(remaining);
        String nextCursor = hasMore ? encode(idOf.applyAsLong(items.get(items.size() - 1))) : null;
        return new Page<>(items, hasMore, nextCursor, size);
    }

    public static Comparator<AssessmentMistake> order() {
        return Comparator.comparingLong(AssessmentMistake::mistakeId);
    }
}
