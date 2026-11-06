package com.englishflow.content.domain;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Closed optional {@code readingArticle} for one owner draft.
 * A missing key means that version has no article. The stored object keeps the
 * closed client fields and the server-derived owner fields. It is not a projection.
 */
public final class ReadingArticleAuthoring {

    public static final String FIELD = "readingArticle";

    private static final BigInteger MAX_SAFE_ID = BigInteger.valueOf(9007199254740991L);
    private static final int MAX_BLOCKS = 10000;
    private static final int MAX_TEXT = 4096;
    private static final long RESERVED_PLACEMENT_MIN = 266001L;
    private static final long RESERVED_PLACEMENT_MAX = 266010L;
    private static final Set<String> CLIENT_KEYS = Set.of("articleId", "blocks");
    private static final Set<String> CLIENT_BLOCK_KEYS = Set.of("text", "translation");

    private ReadingArticleAuthoring() {
    }

    public static boolean isWithheld(String key) {
        return FIELD.equals(key);
    }

    /** True when any map key is the opt-in field. String values are not scanned. */
    public static boolean mentioned(Object node) {
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (FIELD.equals(String.valueOf(entry.getKey())) || mentioned(entry.getValue())) {
                    return true;
                }
            }
            return false;
        }
        if (node instanceof List<?> list) {
            for (Object item : list) {
                if (mentioned(item)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static void rejectSealedOwner(String contentCode, String contentIdValue) {
        if (GradableQuestions.SEALED_CODE.equals(contentCode)
                || GradableQuestions.SEALED_OWNER_ID.equals(contentIdValue)) {
            throw ContentOperationException.badRequest(
                    "READING_ARTICLE_SEALED_BANK",
                    "readingArticle cannot extend the sealed placement bank");
        }
    }

    /**
     * One parse of the closed client object. Title is copied exactly.
     * {@code cefrLevel} is the same payload target level. Block identity and word count
     * are derived. Projection-only fields are not stored.
     */
    public static Map<String, Object> copy(
            Object raw, Object title, String cefrLevel, List<Map<String, Object>> questions) {
        Set<Long> itemIds = new LinkedHashSet<>();
        if (questions != null) {
            for (Map<String, Object> question : questions) {
                itemIds.add(((Number) question.get("itemId")).longValue());
            }
        }
        Parsed parsed = parse(raw, itemIds);
        return freeze(parsed, exactTitle(title), level(cefrLevel));
    }

    /**
     * Same instance when the article key is absent, including a legacy payload with no private
     * question keys. A present article is dropped. Nested legacy values stay in place.
     */
    public static Map<String, Object> omitPrivateField(Map<String, Object> payload) {
        Map<String, Object> withoutQuestions = GradableQuestions.omitPrivateField(payload);
        if (withoutQuestions == null || !withoutQuestions.containsKey(FIELD)) {
            return withoutQuestions;
        }
        LinkedHashMap<String, Object> copy = new LinkedHashMap<>(withoutQuestions);
        copy.remove(FIELD);
        return Collections.unmodifiableMap(copy);
    }

    private static Parsed parse(Object raw, Set<Long> itemIds) {
        Map<String, Object> fields = stringsRequired(raw);
        rejectUnknown(fields, CLIENT_KEYS);
        requireKeys(fields, CLIENT_KEYS);
        long articleId = exactInteger(fields.get("articleId"), 1, MAX_SAFE_ID.longValue());
        rejectIds(articleId, itemIds);
        return new Parsed(articleId, clientBlocks(fields.get("blocks")));
    }

    private static Map<String, Object> freeze(Parsed parsed, String title, String cefrLevel) {
        List<Map<String, Object>> blocks = new ArrayList<>(parsed.blocks().size());
        for (int index = 0; index < parsed.blocks().size(); index++) {
            Block block = parsed.blocks().get(index);
            Map<String, Object> stored = new LinkedHashMap<>();
            stored.put("blockId", "block-" + (index + 1));
            stored.put("blockIndex", index);
            stored.put("text", block.text());
            if (block.translation() != null) {
                stored.put("translation", block.translation());
            }
            blocks.add(Collections.unmodifiableMap(stored));
        }
        Map<String, Object> article = new LinkedHashMap<>();
        article.put("articleId", parsed.articleId());
        article.put("title", title);
        article.put("cefrLevel", cefrLevel);
        article.put("wordCount", wordCount(parsed.blocks()));
        article.put("blocks", Collections.unmodifiableList(blocks));
        return Collections.unmodifiableMap(article);
    }

    private static List<Block> clientBlocks(Object raw) {
        if (!(raw instanceof List<?> blocks) || blocks.isEmpty() || blocks.size() > MAX_BLOCKS) {
            throw invalid();
        }
        List<Block> copy = new ArrayList<>(blocks.size());
        for (Object block : blocks) {
            Map<String, Object> fields = stringsRequired(block);
            rejectUnknown(fields, CLIENT_BLOCK_KEYS);
            if (!fields.containsKey("text")) {
                throw invalid();
            }
            String translation = null;
            if (fields.containsKey("translation")) {
                translation = nonBlank(fields.get("translation"), MAX_TEXT);
            }
            copy.add(new Block(nonBlank(fields.get("text"), MAX_TEXT), translation));
        }
        return List.copyOf(copy);
    }

    /** Join block text with one U+0020, then split on U+0020, keeping trailing empties. */
    private static int wordCount(List<Block> blocks) {
        String[] texts = new String[blocks.size()];
        for (int index = 0; index < blocks.size(); index++) {
            texts[index] = blocks.get(index).text();
        }
        return String.join(" ", texts).split(" ", -1).length;
    }

    private static void rejectIds(long articleId, Set<Long> itemIds) {
        if (reserved(articleId)) {
            throw invalid();
        }
        for (long itemId : itemIds) {
            if (reserved(itemId) || itemId == articleId) {
                throw invalid();
            }
        }
    }

    private static boolean reserved(long id) {
        return id == 3501L || id == 3950L || (id >= RESERVED_PLACEMENT_MIN && id <= RESERVED_PLACEMENT_MAX);
    }

    private static long exactInteger(Object raw, long minimum, long maximum) {
        BigInteger value;
        if (raw instanceof Integer || raw instanceof Long) {
            value = BigInteger.valueOf(((Number) raw).longValue());
        } else if (raw instanceof BigInteger big) {
            value = big;
        } else {
            throw invalid();
        }
        if (value.compareTo(BigInteger.valueOf(minimum)) < 0
                || value.compareTo(BigInteger.valueOf(maximum)) > 0) {
            throw invalid();
        }
        return value.longValue();
    }

    private static String exactTitle(Object raw) {
        if (!(raw instanceof String text) || blank(text)) {
            throw ContentOperationException.badRequest("CONTENT_FIELD_REQUIRED", "title is required");
        }
        return text;
    }

    private static String level(String cefrLevel) {
        if (cefrLevel == null || blank(cefrLevel)) {
            throw invalid();
        }
        return cefrLevel;
    }

    private static String nonBlank(Object raw, int maxLength) {
        if (!(raw instanceof String text)
                || text.codePointCount(0, text.length()) > maxLength
                || blank(text)) {
            throw invalid();
        }
        return text;
    }

    /** ECMAScript {@code \s}: WhiteSpace plus LineTerminator, matched per code point. */
    private static boolean blank(String text) {
        for (int offset = 0; offset < text.length(); ) {
            int codePoint = text.codePointAt(offset);
            if (!ecmaScriptWhitespace(codePoint)) {
                return false;
            }
            offset += Character.charCount(codePoint);
        }
        return true;
    }

    private static boolean ecmaScriptWhitespace(int codePoint) {
        return switch (codePoint) {
            case 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680,
                    0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF -> true;
            default -> codePoint >= 0x2000 && codePoint <= 0x200A;
        };
    }

    private static void rejectUnknown(Map<String, Object> fields, Set<String> allowed) {
        for (String key : fields.keySet()) {
            if (!allowed.contains(key)) {
                throw invalid();
            }
        }
    }

    private static void requireKeys(Map<String, Object> fields, Set<String> required) {
        for (String key : required) {
            if (!fields.containsKey(key)) {
                throw invalid();
            }
        }
    }

    private static Map<String, Object> stringsRequired(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) {
            throw invalid();
        }
        return strings(map);
    }

    private static Map<String, Object> strings(Map<?, ?> raw) {
        LinkedHashMap<String, Object> fields = new LinkedHashMap<>();
        raw.forEach((key, value) -> fields.put(String.valueOf(key), value));
        return fields;
    }

    private static ContentOperationException invalid() {
        return ContentOperationException.badRequest(
                "READING_ARTICLE_INVALID", "readingArticle is not a closed authoring object");
    }

    private record Parsed(long articleId, List<Block> blocks) {
    }

    private record Block(String text, String translation) {
    }
}
