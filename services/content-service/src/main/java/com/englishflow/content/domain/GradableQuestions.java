package com.englishflow.content.domain;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Closed optional {@code gradableQuestions} array for a single owner draft.
 * Absence is not an empty array: callers keep the legacy payload when the key is missing.
 */
public final class GradableQuestions {

    public static final String FIELD = "gradableQuestions";
    public static final String SEALED_CODE = "p1.placement.v1";
    public static final String SEALED_OWNER_ID = "p1-placement-bank-v1";

    private static final BigInteger MAX_ITEM_ID = BigInteger.valueOf(9007199254740991L);
    private static final int MAX_QUESTIONS = 100;
    private static final int MAX_OPTIONS = 8;
    private static final int MAX_STEM = 4096;
    private static final int MAX_LABEL = 512;
    private static final Pattern TOKEN = Pattern.compile("^[a-z][a-z0-9._:-]{0,63}$");
    private static final Set<String> QUESTION_KEYS = Set.of("itemId", "stem", "options", "answerRule");
    private static final Set<String> OPTION_KEYS = Set.of("optionId", "label");
    private static final Set<String> RULE_KEYS = Set.of("correctOption");

    private GradableQuestions() {
    }

    /** Exact code {@code p1.placement.v1} or resolved {@code ContentId.value()} {@code p1-placement-bank-v1}. */
    public static void rejectSealedOwner(String contentCode, String contentIdValue) {
        if (SEALED_CODE.equals(contentCode) || SEALED_OWNER_ID.equals(contentIdValue)) {
            throw ContentOperationException.badRequest(
                    "GRADABLE_QUESTIONS_SEALED_BANK",
                    "gradableQuestions cannot extend the sealed placement bank");
        }
    }

    public static boolean valid(Object raw) {
        try {
            copy(raw);
            return true;
        } catch (ContentOperationException exception) {
            return false;
        }
    }

    /** Closed copy. Array order and option order are the stored order. */
    public static List<Map<String, Object>> copy(Object raw) {
        if (!(raw instanceof List<?> questions) || questions.isEmpty() || questions.size() > MAX_QUESTIONS) {
            throw invalid();
        }
        Set<Long> itemIds = new LinkedHashSet<>();
        List<Map<String, Object>> copy = new ArrayList<>(questions.size());
        for (Object question : questions) {
            if (!(question instanceof Map<?, ?> map)) {
                throw invalid();
            }
            Map<String, Object> fields = strings(map);
            rejectUnknown(fields, QUESTION_KEYS);
            long itemId = itemId(fields.get("itemId"));
            if (!itemIds.add(itemId)) {
                throw invalid();
            }
            String stem = nonBlank(fields.get("stem"), MAX_STEM);
            if (!(fields.get("options") instanceof List<?> options)
                    || options.size() < 2 || options.size() > MAX_OPTIONS) {
                throw invalid();
            }
            if (!(fields.get("answerRule") instanceof Map<?, ?> ruleMap)) {
                throw invalid();
            }
            Map<String, Object> ruleFields = strings(ruleMap);
            rejectUnknown(ruleFields, RULE_KEYS);
            Set<String> optionIds = new LinkedHashSet<>();
            List<Map<String, Object>> optionCopy = new ArrayList<>(options.size());
            for (Object option : options) {
                if (!(option instanceof Map<?, ?> optionMap)) {
                    throw invalid();
                }
                Map<String, Object> optionFields = strings(optionMap);
                rejectUnknown(optionFields, OPTION_KEYS);
                String optionId = token(optionFields.get("optionId"));
                if (!optionIds.add(optionId)) {
                    throw invalid();
                }
                Map<String, Object> storedOption = new LinkedHashMap<>();
                storedOption.put("optionId", optionId);
                storedOption.put("label", nonBlank(optionFields.get("label"), MAX_LABEL));
                optionCopy.add(Collections.unmodifiableMap(storedOption));
            }
            String correctOption = token(ruleFields.get("correctOption"));
            if (!optionIds.contains(correctOption)) {
                throw invalid();
            }
            Map<String, Object> stored = new LinkedHashMap<>();
            stored.put("itemId", itemId);
            stored.put("stem", stem);
            stored.put("options", Collections.unmodifiableList(optionCopy));
            stored.put("answerRule", Map.of("correctOption", correctOption));
            copy.add(Collections.unmodifiableMap(stored));
        }
        return Collections.unmodifiableList(copy);
    }

    /**
     * Same instance when the opt-in is absent. Otherwise a shallow copy that drops
     * only that top-level field, valid or not, so a response cannot carry its answer.
     */
    public static Map<String, Object> omitPrivateField(Map<String, Object> payload) {
        if (payload == null || !payload.containsKey(FIELD)) {
            return payload;
        }
        LinkedHashMap<String, Object> copy = new LinkedHashMap<>(payload);
        copy.remove(FIELD);
        return Collections.unmodifiableMap(copy);
    }

    private static long itemId(Object raw) {
        BigInteger value;
        if (raw instanceof Integer || raw instanceof Long) {
            value = BigInteger.valueOf(((Number) raw).longValue());
        } else if (raw instanceof BigInteger big) {
            value = big;
        } else {
            throw invalid();
        }
        if (value.compareTo(BigInteger.ONE) < 0 || value.compareTo(MAX_ITEM_ID) > 0) {
            throw invalid();
        }
        return value.longValue();
    }

    private static String token(Object raw) {
        if (!(raw instanceof String text) || !TOKEN.matcher(text).matches()) {
            throw invalid();
        }
        return text;
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

    private static Map<String, Object> strings(Map<?, ?> raw) {
        LinkedHashMap<String, Object> fields = new LinkedHashMap<>();
        raw.forEach((key, value) -> fields.put(String.valueOf(key), value));
        return fields;
    }

    private static ContentOperationException invalid() {
        return ContentOperationException.badRequest(
                "GRADABLE_QUESTIONS_INVALID", "gradableQuestions is not a closed authoring array");
    }
}
