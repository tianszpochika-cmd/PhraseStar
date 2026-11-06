package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.GradableQuestions;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

/**
 * Owner transaction that pins the current published version into B3 experience
 * and ACTIVE binding rows. The publication pointer, version payload, and hash
 * stay unchanged.
 */
@Component
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class JdbcPublishedReadingBindings {

    static final String ARTICLE_TYPE = "READING_ARTICLE";
    static final String QUESTION_TYPE = "READING_QUESTION";

    private static final String TENANT = "platform";
    private static final String DOMAIN = "READING";
    private static final String PUBLISHED = "PUBLISHED";
    private static final String ACTIVE = "ACTIVE";
    private static final String SCOPE_PREFIX = "content-reading-binding:";
    private static final String ARTICLE_FIELD = "readingArticle";
    private static final long MAX_SAFE_ID = 9007199254740991L;
    private static final int MAX_BLOCKS = 10000;
    private static final int MAX_TEXT = 4096;
    private static final long RESERVED_PLACEMENT_MIN = 266001L;
    private static final long RESERVED_PLACEMENT_MAX = 266010L;
    private static final Set<String> ARTICLE_KEYS = Set.of(
            "articleId", "title", "cefrLevel", "wordCount", "blocks");
    private static final Set<String> BLOCK_KEYS = Set.of("blockId", "blockIndex", "text", "translation");
    private static final Set<String> BLOCK_REQUIRED = Set.of("blockId", "blockIndex", "text");

    private static final String LOCK_SQL = """
            SELECT content_id, tenant_id, content_code, current_published_version_id, state_version
              FROM content_definition
             WHERE content_code = ?
             FOR UPDATE
            """;

    private static final String VERSION_SQL = """
            SELECT content_version_id, content_id, status, payload_json, payload_hash,
                   published_at, archived_at, copyright_status, rights_allows_learning,
                   rights_source_code, rights_license_code, rights_permitted_channels,
                   rights_starts_at, rights_expires_at, authorization_evidence_ref,
                   editor, first_reviewer, final_reviewer, publisher
              FROM content_version
             WHERE content_version_id = ? AND content_id = ?
            """;

    private static final String EXPERIENCE_SQL = """
            SELECT experience_id, tenant_id, domain_code, resource_type, resource_key,
                   content_version_id, availability, payload_json
              FROM b3_content_experience
             WHERE tenant_id = ? AND domain_code = ? AND resource_type = ? AND resource_key = ?
            """;

    private static final String BINDING_SQL = """
            SELECT tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id,
                   content_code, content_version_id, question_item_id, status
              FROM content_b3_item_binding
             WHERE tenant_id = ? AND b3_domain = ? AND b3_resource_type = ? AND b3_resource_key = ?
            """;

    private static final String INSERT_EXPERIENCE = """
            INSERT INTO b3_content_experience
                (experience_id, tenant_id, domain_code, resource_type, resource_key,
                 content_version_id, availability, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String INSERT_BINDING = """
            INSERT INTO content_b3_item_binding
                (tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id,
                 content_code, content_version_id, question_item_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public JdbcPublishedReadingBindings(
            JdbcTemplate jdbc, ObjectMapper objectMapper, TransactionTemplate transaction, Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "object mapper is required");
        this.transaction = Objects.requireNonNull(transaction, "transaction is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public Map<String, Object> bind(Command command) {
        Objects.requireNonNull(command, "command is required");
        Request request = request(command);
        try {
            Map<String, Object> receipt = transaction.execute(status -> write(request));
            return Objects.requireNonNull(receipt, "reading binding returned no receipt");
        } catch (Race race) {
            Map<String, Object> receipt = transaction.execute(status -> reconcile(request));
            return Objects.requireNonNull(receipt, "reading binding returned no receipt");
        }
    }

    private Map<String, Object> write(Request request) {
        StoredRequest existing = findIdempotency(request);
        if (existing != null) {
            return replayOrConflict(existing, request);
        }
        if (reservedRequest(request.command())) {
            throw Failure.reserved();
        }
        Prepared prepared = prepare(request);
        assertReadback(prepared);
        if (prepared.presence() == Presence.EXACT) {
            insertIdempotency(request, prepared.receipt());
            return returned(prepared.receipt(), true);
        }
        if (prepared.presence() != Presence.ABSENT) {
            throw Failure.crossOwner();
        }
        try {
            insertRows(prepared);
            insertIdempotency(request, prepared.receipt());
        } catch (DuplicateKeyException duplicate) {
            throw new Race();
        }
        return returned(prepared.receipt(), false);
    }

    private Map<String, Object> reconcile(Request request) {
        StoredRequest existing = findIdempotency(request);
        if (existing != null) {
            return replayOrConflict(existing, request);
        }
        if (reservedRequest(request.command())) {
            throw Failure.reserved();
        }
        Prepared prepared = prepare(request);
        if (prepared.presence() != Presence.EXACT) {
            throw Failure.crossOwner();
        }
        try {
            insertIdempotency(request, prepared.receipt());
        } catch (DuplicateKeyException duplicate) {
            StoredRequest raced = findIdempotency(request);
            if (raced == null) {
                throw Failure.crossOwner();
            }
            return replayOrConflict(raced, request);
        }
        return returned(prepared.receipt(), true);
    }

    private Prepared prepare(Request request) {
        Map<String, Object> definition = lockDefinition(request.command().contentCode());
        String contentId = text(definition.get("content_id"));
        String contentCode = text(definition.get("content_code"));
        if (contentId == null || contentId.isBlank() || !request.command().contentCode().equals(contentCode)) {
            throw Failure.identity();
        }
        if (GradableQuestions.SEALED_CODE.equals(contentCode) || GradableQuestions.SEALED_OWNER_ID.equals(contentId)) {
            throw Failure.reserved();
        }
        if (definition.get("current_published_version_id") == null) {
            throw Failure.notPublished();
        }
        long current = dbLong(definition.get("current_published_version_id"), Failure.notPublished());
        if (current != request.command().contentVersionId()) {
            throw Failure.identity();
        }
        if (current == 301L || current == 266100L) {
            throw Failure.reserved();
        }
        Map<String, Object> version = loadVersion(contentId, current);
        if (version == null || !"PUBLISHED".equals(text(version.get("status")))
                || version.get("archived_at") != null
                || instantOf(version.get("published_at")) == null) {
            throw Failure.notPublished();
        }
        String payloadHash = text(version.get("payload_hash"));
        long stateVersion = dbLong(definition.get("state_version"), Failure.cas());
        if (payloadHash == null || !payloadHash.equalsIgnoreCase(request.command().expectedHash())
                || stateVersion < 1 || stateVersion != request.command().expectedStateVersion()) {
            throw Failure.cas();
        }
        requireActors(version, request.command().subject());
        requireRights(version, clock.instant());
        Map<String, Object> payload = readPayload(version.get("payload_json"));
        StoredArticle article = readArticle(payload.get(ARTICLE_FIELD));
        List<Map<String, Object>> questions = readQuestions(payload.get(GradableQuestions.FIELD));
        if (!GradableQuestions.isStoredSeal(payload.get(GradableQuestions.SEAL_FIELD))) {
            throw Failure.questionsRequired();
        }
        List<Long> itemIds = new ArrayList<>(questions.size());
        for (Map<String, Object> question : questions) {
            itemIds.add(((Number) question.get("itemId")).longValue());
        }
        if (reservedId(article.articleId()) || itemIds.stream().anyMatch(JdbcPublishedReadingBindings::reservedId)) {
            throw Failure.reserved();
        }
        if (itemIds.contains(article.articleId())) {
            throw Failure.articleRequired();
        }
        List<PlannedRow> rows = plan(article, questions, itemIds, current);
        Presence presence = presence(rows, current, contentCode);
        return new Prepared(
                contentId, contentCode, current, stateVersion, payloadHash, rows, presence,
                receipt(contentCode, current, payloadHash, stateVersion, article.articleId(), itemIds));
    }

    private void assertReadback(Prepared prepared) {
        Map<String, Object> definition = lockDefinition(prepared.contentCode());
        long current = dbLong(definition.get("current_published_version_id"), Failure.cas());
        long stateVersion = dbLong(definition.get("state_version"), Failure.cas());
        if (current != prepared.versionId() || stateVersion != prepared.stateVersion()) {
            throw Failure.cas();
        }
        Map<String, Object> version = loadVersion(prepared.contentId(), prepared.versionId());
        if (version == null || !prepared.payloadHash().equals(text(version.get("payload_hash")))) {
            throw Failure.cas();
        }
    }

    private void insertRows(Prepared prepared) {
        for (PlannedRow row : prepared.rows()) {
            jdbc.update(INSERT_EXPERIENCE,
                    row.experienceId(), TENANT, DOMAIN, row.resourceType(), row.resourceKey(),
                    prepared.versionId(), PUBLISHED,
                    JdbcContentJson.write(objectMapper, row.payload(), "reading experience could not be encoded"));
            jdbc.update(INSERT_BINDING,
                    TENANT, DOMAIN, row.resourceType(), row.resourceKey(), row.experienceId(),
                    prepared.contentCode(), prepared.versionId(), row.questionItemId(), ACTIVE);
        }
    }

    private Presence presence(List<PlannedRow> rows, long versionId, String contentCode) {
        boolean absent = false;
        boolean exact = false;
        for (PlannedRow row : rows) {
            Presence one = classify(row, versionId, contentCode);
            if (one == Presence.CONFLICT) {
                return Presence.CONFLICT;
            }
            if (one == Presence.ABSENT) {
                absent = true;
            } else if (one == Presence.EXACT) {
                exact = true;
            }
        }
        if (absent && exact) {
            return Presence.PARTIAL;
        }
        return exact ? Presence.EXACT : Presence.ABSENT;
    }

    private Presence classify(PlannedRow planned, long versionId, String contentCode) {
        List<Map<String, Object>> experiences = query(
                EXPERIENCE_SQL, TENANT, DOMAIN, planned.resourceType(), planned.resourceKey());
        List<Map<String, Object>> bindings = query(
                BINDING_SQL, TENANT, DOMAIN, planned.resourceType(), planned.resourceKey());
        if (experiences.isEmpty() && bindings.isEmpty()) {
            return Presence.ABSENT;
        }
        if (experiences.size() != 1 || bindings.size() != 1) {
            return Presence.CONFLICT;
        }
        if (!experienceExact(experiences.get(0), planned, versionId)
                || !bindingExact(bindings.get(0), planned, versionId, contentCode)) {
            return Presence.CONFLICT;
        }
        return Presence.EXACT;
    }

    private boolean experienceExact(Map<String, Object> row, PlannedRow planned, long versionId) {
        return planned.experienceId().equals(text(row.get("experience_id")))
                && TENANT.equals(text(row.get("tenant_id")))
                && DOMAIN.equals(text(row.get("domain_code")))
                && planned.resourceType().equals(text(row.get("resource_type")))
                && planned.resourceKey().equals(text(row.get("resource_key")))
                && numberEquals(row.get("content_version_id"), versionId)
                && PUBLISHED.equals(text(row.get("availability")))
                && payloadEquals(row.get("payload_json"), planned.payload());
    }

    private static boolean bindingExact(
            Map<String, Object> row, PlannedRow planned, long versionId, String contentCode) {
        return TENANT.equals(text(row.get("tenant_id")))
                && DOMAIN.equals(text(row.get("b3_domain")))
                && planned.resourceType().equals(text(row.get("b3_resource_type")))
                && planned.resourceKey().equals(text(row.get("b3_resource_key")))
                && planned.experienceId().equals(text(row.get("b3_experience_id")))
                && contentCode.equals(text(row.get("content_code")))
                && numberEquals(row.get("content_version_id"), versionId)
                && planned.questionItemId().equals(text(row.get("question_item_id")))
                && ACTIVE.equals(text(row.get("status")));
    }

    private boolean payloadEquals(Object storedJson, Map<String, Object> expected) {
        String json = text(storedJson);
        if (json == null) {
            return false;
        }
        try {
            return deepEquals(expected, JdbcContentJson.readMap(
                    objectMapper, json, "stored reading payload is unreadable"));
        } catch (ContentOperationException unreadable) {
            return false;
        }
    }

    private Map<String, Object> lockDefinition(String contentCode) {
        Map<String, Object> platform = null;
        for (Map<String, Object> row : query(LOCK_SQL, contentCode)) {
            if (!TENANT.equals(text(row.get("tenant_id")))) {
                continue;
            }
            if (platform != null) {
                throw Failure.identity();
            }
            platform = row;
        }
        if (platform == null) {
            throw Failure.identity();
        }
        return platform;
    }

    private Map<String, Object> loadVersion(String contentId, long versionId) {
        List<Map<String, Object>> rows = query(VERSION_SQL, versionId, contentId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private StoredRequest findIdempotency(Request request) {
        List<Map<String, Object>> rows = query("""
                SELECT request_fingerprint, status, response_json
                  FROM content_idempotency_record
                 WHERE scope = ? AND idempotency_key = ?
                 FOR UPDATE
                """, request.scope(), request.command().idempotencyKey());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        return new StoredRequest(
                text(row.get("request_fingerprint")), text(row.get("status")), text(row.get("response_json")));
    }

    private Map<String, Object> replayOrConflict(StoredRequest existing, Request request) {
        if (existing.fingerprint() == null || !existing.fingerprint().equals(request.fingerprint())
                || !"COMPLETED".equals(existing.status()) || existing.responseJson() == null) {
            throw Failure.idempotency();
        }
        try {
            return returned(JdbcContentJson.readMap(
                    objectMapper, existing.responseJson(), "stored reading binding receipt is unreadable"), true);
        } catch (ContentOperationException unreadable) {
            throw Failure.idempotency();
        }
    }

    private void insertIdempotency(Request request, Map<String, Object> receipt) {
        jdbc.update("""
                INSERT INTO content_idempotency_record
                    (scope, idempotency_key, request_fingerprint, status, response_json, recorded_at)
                VALUES (?, ?, ?, 'COMPLETED', ?, ?)
                """,
                request.scope(), request.command().idempotencyKey(), request.fingerprint(),
                JdbcContentJson.write(objectMapper, receipt, "reading binding receipt could not be encoded"),
                JdbcContentJson.timestamp(clock.instant()));
    }

    private void requireActors(Map<String, Object> version, String subject) {
        String editor = actor(version.get("editor"));
        String first = actor(version.get("first_reviewer"));
        String fin = actor(version.get("final_reviewer"));
        String publisher = actor(version.get("publisher"));
        if (editor == null || first == null || fin == null || publisher == null
                || editor.equals(first) || editor.equals(fin) || editor.equals(publisher)
                || first.equals(fin) || first.equals(publisher) || fin.equals(publisher)) {
            throw Failure.actors();
        }
        if (!publisher.equals(subject)) {
            throw Failure.publisher();
        }
    }

    private void requireRights(Map<String, Object> version, Instant now) {
        CopyrightStatus status;
        try {
            status = CopyrightStatus.valueOf(text(version.get("copyright_status")));
        } catch (RuntimeException invalid) {
            throw Failure.rights();
        }
        if (status != CopyrightStatus.ACTIVE || !flag(version.get("rights_allows_learning"))) {
            throw Failure.rights();
        }
        Set<String> channels = channels(version.get("rights_permitted_channels"));
        try {
            ContentRights rights = new ContentRights(
                    text(version.get("rights_source_code")),
                    text(version.get("rights_license_code")),
                    status,
                    true,
                    channels,
                    window(version.get("rights_starts_at")),
                    window(version.get("rights_expires_at")),
                    text(version.get("authorization_evidence_ref")));
            boolean assessment = rights.allows(ContentChannel.ASSESSMENT, now)
                    || (channels.contains("SEALED") && rights.isActive(now) && rights.allowsLearning());
            if (!rights.allows(ContentChannel.LEARNER, now) || !assessment) {
                throw Failure.rights();
            }
        } catch (ContentOperationException denied) {
            throw Failure.rights();
        }
    }

    private Set<String> channels(Object raw) {
        Object decoded = raw;
        if (raw instanceof String || raw instanceof byte[]) {
            String json = text(raw);
            if (json == null || json.isBlank()) {
                return Set.of();
            }
            try {
                decoded = objectMapper.readValue(json, Object.class);
            } catch (RuntimeException invalid) {
                return Set.of();
            }
        }
        if (!(decoded instanceof List<?> values) || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> channels = new LinkedHashSet<>();
        for (Object value : values) {
            if (!(value instanceof String channel) || channel.isBlank()) {
                return Set.of();
            }
            channels.add(channel.trim().toUpperCase(Locale.ROOT));
        }
        return Set.copyOf(channels);
    }

    private Map<String, Object> readPayload(Object raw) {
        String json = text(raw);
        if (json == null) {
            throw Failure.articleRequired();
        }
        try {
            return JdbcContentJson.readMap(objectMapper, json, "stored content payload is unreadable");
        } catch (ContentOperationException unreadable) {
            throw Failure.articleRequired();
        }
    }

    private static StoredArticle readArticle(Object raw) {
        Map<String, Object> fields = stringMap(raw);
        if (fields == null || !ARTICLE_KEYS.equals(fields.keySet())) {
            throw Failure.articleRequired();
        }
        long articleId = exactInteger(fields.get("articleId"), 1, MAX_SAFE_ID);
        String title = boundedText(fields.get("title"), MAX_TEXT);
        String cefrLevel = boundedText(fields.get("cefrLevel"), 128);
        List<Map<String, Object>> blocks = storedBlocks(fields.get("blocks"));
        long wordCount = exactInteger(fields.get("wordCount"), 0, MAX_SAFE_ID);
        if (wordCount != countWords(blocks)) {
            throw Failure.articleRequired();
        }
        return new StoredArticle(articleId, title, cefrLevel, wordCount, blocks);
    }

    private static List<Map<String, Object>> storedBlocks(Object raw) {
        if (!(raw instanceof List<?> blocks) || blocks.isEmpty() || blocks.size() > MAX_BLOCKS) {
            throw Failure.articleRequired();
        }
        List<Map<String, Object>> stored = new ArrayList<>(blocks.size());
        for (int index = 0; index < blocks.size(); index++) {
            Map<String, Object> fields = stringMap(blocks.get(index));
            if (fields == null || !BLOCK_KEYS.containsAll(fields.keySet()) || !fields.keySet().containsAll(BLOCK_REQUIRED)) {
                throw Failure.articleRequired();
            }
            if (!("block-" + (index + 1)).equals(fields.get("blockId"))) {
                throw Failure.articleRequired();
            }
            if (exactInteger(fields.get("blockIndex"), 0, MAX_BLOCKS) != index) {
                throw Failure.articleRequired();
            }
            Map<String, Object> block = new LinkedHashMap<>();
            block.put("blockId", "block-" + (index + 1));
            block.put("blockIndex", index);
            block.put("text", boundedText(fields.get("text"), MAX_TEXT));
            if (fields.containsKey("translation")) {
                block.put("translation", boundedText(fields.get("translation"), MAX_TEXT));
            }
            stored.add(block);
        }
        return List.copyOf(stored);
    }

    private static List<Map<String, Object>> readQuestions(Object raw) {
        try {
            return GradableQuestions.copy(raw);
        } catch (ContentOperationException invalid) {
            throw Failure.questionsRequired();
        }
    }

    private static List<PlannedRow> plan(
            StoredArticle article, List<Map<String, Object>> questions, List<Long> itemIds, long versionId) {
        List<PlannedRow> rows = new ArrayList<>(questions.size() + 1);
        String articleKey = Long.toString(article.articleId());
        String firstItem = Long.toString(itemIds.get(0));
        Map<String, Object> articlePayload = new LinkedHashMap<>();
        articlePayload.put("articleId", article.articleId());
        articlePayload.put("title", article.title());
        articlePayload.put("cefrLevel", article.cefrLevel());
        articlePayload.put("wordCount", article.wordCount());
        articlePayload.put("contentVersionId", versionId);
        articlePayload.put("blocks", article.blocks());
        rows.add(new PlannedRow(
                "b3-reading-article-" + articleKey, ARTICLE_TYPE, articleKey, firstItem, articlePayload));
        for (int index = 0; index < questions.size(); index++) {
            Map<String, Object> question = questions.get(index);
            long itemId = itemIds.get(index);
            String key = Long.toString(itemId);
            List<Map<String, Object>> options = new ArrayList<>();
            Object rawOptions = question.get("options");
            if (rawOptions instanceof List<?> values) {
                for (Object value : values) {
                    if (!(value instanceof Map<?, ?> option)) {
                        throw Failure.questionsRequired();
                    }
                    Map<String, Object> stored = new LinkedHashMap<>();
                    stored.put("optionCode", String.valueOf(option.get("optionId")));
                    stored.put("label", String.valueOf(option.get("label")));
                    options.add(stored);
                }
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("questionId", itemId);
            payload.put("articleId", article.articleId());
            payload.put("stemText", String.valueOf(question.get("stem")));
            payload.put("options", List.copyOf(options));
            payload.put("contentVersionId", versionId);
            rows.add(new PlannedRow(
                    "b3-reading-question-" + key, QUESTION_TYPE, key, key, payload));
        }
        return List.copyOf(rows);
    }

    private static Map<String, Object> receipt(
            String contentCode, long versionId, String payloadHash, long stateVersion,
            long articleId, List<Long> itemIds) {
        List<String> questionItemIds = itemIds.stream().map(id -> Long.toString(id)).toList();
        String first = questionItemIds.get(0);
        Map<String, Object> practiceRef = new LinkedHashMap<>();
        practiceRef.put("contentCode", contentCode);
        practiceRef.put("contentVersionId", versionId);
        practiceRef.put("questionItemId", first);
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("contentCode", contentCode);
        receipt.put("contentVersionId", versionId);
        receipt.put("payloadHash", payloadHash);
        receipt.put("stateVersion", stateVersion);
        receipt.put("articleId", articleId);
        receipt.put("articleQuestionItemId", first);
        receipt.put("questionItemIds", questionItemIds);
        receipt.put("practiceRef", practiceRef);
        receipt.put("articleExperienceId", "b3-reading-article-" + articleId);
        receipt.put("questionExperienceIds", questionItemIds.stream()
                .map(itemId -> "b3-reading-question-" + itemId).toList());
        receipt.put("bindingStatus", ACTIVE);
        receipt.put("replayed", false);
        return receipt;
    }

    private Request request(Command command) {
        Map<String, Object> digest = new LinkedHashMap<>();
        digest.put("contentCode", command.contentCode());
        digest.put("contentVersionId", command.contentVersionId());
        digest.put("expectedHash", command.expectedHash());
        digest.put("expectedStateVersion", command.expectedStateVersion());
        return new Request(command, ContentPayloadHash.sha256(digest), SCOPE_PREFIX + command.subject());
    }

    private List<Map<String, Object>> query(String sql, Object... args) {
        return jdbc.queryForList(sql, args).stream().map(JdbcPublishedReadingBindings::lower).toList();
    }

    private static boolean reservedRequest(Command command) {
        return GradableQuestions.SEALED_CODE.equals(command.contentCode())
                || command.contentVersionId() == 301L
                || command.contentVersionId() == 266100L;
    }

    private static boolean reservedId(long id) {
        return id == 3501L || id == 3950L || (id >= RESERVED_PLACEMENT_MIN && id <= RESERVED_PLACEMENT_MAX);
    }

    private static int countWords(List<Map<String, Object>> blocks) {
        String[] texts = new String[blocks.size()];
        for (int index = 0; index < blocks.size(); index++) {
            texts[index] = String.valueOf(blocks.get(index).get("text"));
        }
        return String.join(" ", texts).split(" ", -1).length;
    }

    private static long exactInteger(Object raw, long minimum, long maximum) {
        BigInteger value;
        if (raw instanceof Integer || raw instanceof Long) {
            value = BigInteger.valueOf(((Number) raw).longValue());
        } else if (raw instanceof BigInteger big) {
            value = big;
        } else {
            throw Failure.articleRequired();
        }
        if (value.compareTo(BigInteger.valueOf(minimum)) < 0
                || value.compareTo(BigInteger.valueOf(maximum)) > 0) {
            throw Failure.articleRequired();
        }
        return value.longValue();
    }

    private static String boundedText(Object raw, int maxLength) {
        if (!(raw instanceof String text) || text.codePointCount(0, text.length()) > maxLength || blank(text)) {
            throw Failure.articleRequired();
        }
        return text;
    }

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

    private static Map<String, Object> stringMap(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) {
            return null;
        }
        LinkedHashMap<String, Object> fields = new LinkedHashMap<>();
        map.forEach((key, value) -> fields.put(String.valueOf(key), value));
        return fields;
    }

    private static Map<String, Object> lower(Map<String, Object> row) {
        Map<String, Object> copy = new LinkedHashMap<>();
        row.forEach((key, value) -> copy.put(key == null ? "" : key.toLowerCase(Locale.ROOT), value));
        return copy;
    }

    private static Map<String, Object> returned(Map<String, Object> stored, boolean replayed) {
        Map<String, Object> copy = new LinkedHashMap<>(stored);
        copy.put("replayed", replayed);
        return copy;
    }

    private static boolean deepEquals(Object left, Object right) {
        if (left instanceof Number leftNumber && right instanceof Number rightNumber) {
            return sameNumber(leftNumber, rightNumber);
        }
        if (left instanceof Map<?, ?> leftMap && right instanceof Map<?, ?> rightMap) {
            if (leftMap.size() != rightMap.size()) {
                return false;
            }
            for (Map.Entry<?, ?> entry : leftMap.entrySet()) {
                if (!rightMap.containsKey(entry.getKey()) || !deepEquals(entry.getValue(), rightMap.get(entry.getKey()))) {
                    return false;
                }
            }
            return true;
        }
        if (left instanceof List<?> leftList && right instanceof List<?> rightList) {
            if (leftList.size() != rightList.size()) {
                return false;
            }
            for (int index = 0; index < leftList.size(); index++) {
                if (!deepEquals(leftList.get(index), rightList.get(index))) {
                    return false;
                }
            }
            return true;
        }
        return Objects.equals(left, right);
    }

    private static boolean sameNumber(Number left, Number right) {
        if (!integral(left) || !integral(right)) {
            return left.equals(right);
        }
        if ((left instanceof BigInteger leftBig && leftBig.bitLength() > 63)
                || (right instanceof BigInteger rightBig && rightBig.bitLength() > 63)) {
            return left.equals(right);
        }
        return left.longValue() == right.longValue();
    }

    private static boolean integral(Number number) {
        if (number instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().scale() <= 0;
        }
        if (number instanceof Double || number instanceof Float) {
            double value = number.doubleValue();
            return !Double.isNaN(value) && !Double.isInfinite(value) && value == Math.rint(value);
        }
        return true;
    }

    private static boolean numberEquals(Object value, long expected) {
        return value instanceof Number number && integral(number) && number.longValue() == expected;
    }

    private static long dbLong(Object value, Failure failure) {
        if (!(value instanceof Number number) || !integral(number)) {
            throw failure;
        }
        if (number instanceof BigInteger big && big.bitLength() > 63) {
            throw failure;
        }
        return number.longValue();
    }

    private static boolean flag(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value instanceof Number number && number.intValue() == 1;
    }

    private static String actor(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            return null;
        }
        return text;
    }

    private static String text(Object value) {
        if (value instanceof String string) {
            return string;
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return null;
    }

    private Instant window(Object raw) {
        if (raw == null) {
            return null;
        }
        Instant instant = instantOf(raw);
        if (instant == null) {
            throw Failure.rights();
        }
        return instant;
    }

    private static Instant instantOf(Object value) {
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof OffsetDateTime offset) {
            return offset.toInstant();
        }
        if (value instanceof LocalDateTime local) {
            return local.toInstant(ZoneOffset.UTC);
        }
        if (value instanceof Date date) {
            return date.toInstant();
        }
        if (value instanceof String text) {
            try {
                return Instant.parse(text);
            } catch (DateTimeParseException invalid) {
                try {
                    return LocalDateTime.parse(text.replace(' ', 'T')).toInstant(ZoneOffset.UTC);
                } catch (DateTimeParseException ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    public record Command(
            String subject,
            String idempotencyKey,
            String contentCode,
            long contentVersionId,
            String expectedHash,
            long expectedStateVersion) {
    }

    public static final class Failure extends RuntimeException {
        private final int status;
        private final String errorCode;

        private Failure(int status, String errorCode, String message) {
            super(message);
            this.status = status;
            this.errorCode = errorCode;
        }

        public int status() {
            return status;
        }

        public String errorCode() {
            return errorCode;
        }

        public boolean retryable() {
            return false;
        }

        public static Failure unauthorized() {
            return new Failure(401, "READING_BINDING_AUTH_REQUIRED", "a verified access token is required");
        }

        public static Failure permission() {
            return new Failure(403, "READING_BINDING_PUBLISH_PERMISSION_REQUIRED", "content:publish is required");
        }

        public static Failure publisher() {
            return new Failure(403, "READING_BINDING_PUBLISHER_MISMATCH",
                    "verified subject is not the stored publisher");
        }

        public static Failure actors() {
            return new Failure(403, "READING_BINDING_ACTORS_INVALID", "stored publication actors are invalid");
        }

        public static Failure rights() {
            return new Failure(403, "READING_BINDING_RIGHTS_DENIED", "reading rights are not active");
        }

        public static Failure validation() {
            return new Failure(400, "READING_BINDING_VALIDATION", "reading binding request is invalid");
        }

        public static Failure cas() {
            return new Failure(409, "READING_BINDING_CAS_CONFLICT",
                    "published version hash or state does not match");
        }

        public static Failure identity() {
            return new Failure(409, "READING_BINDING_IDENTITY_MISMATCH",
                    "content identity does not match the published definition");
        }

        public static Failure idempotency() {
            return new Failure(409, "READING_BINDING_IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key was reused for a different request");
        }

        public static Failure articleRequired() {
            return new Failure(409, "READING_BINDING_ARTICLE_REQUIRED",
                    "published version has no closed reading article");
        }

        public static Failure questionsRequired() {
            return new Failure(409, "READING_BINDING_QUESTIONS_REQUIRED",
                    "published version has no closed gradable questions");
        }

        public static Failure reserved() {
            return new Failure(409, "READING_BINDING_RESERVED_KEY", "reading binding key is reserved");
        }

        public static Failure crossOwner() {
            return new Failure(409, "READING_BINDING_CROSS_OWNER_KEY",
                    "reading binding key is owned by different content");
        }

        public static Failure notPublished() {
            return new Failure(409, "READING_BINDING_NOT_PUBLISHED",
                    "content version is not the current published version");
        }
    }

    private record Request(Command command, String fingerprint, String scope) {
    }

    private record StoredRequest(String fingerprint, String status, String responseJson) {
    }

    private record StoredArticle(
            long articleId, String title, String cefrLevel, long wordCount, List<Map<String, Object>> blocks) {
    }

    private record PlannedRow(
            String experienceId, String resourceType, String resourceKey,
            String questionItemId, Map<String, Object> payload) {
    }

    private record Prepared(
            String contentId, String contentCode, long versionId, long stateVersion, String payloadHash,
            List<PlannedRow> rows, Presence presence, Map<String, Object> receipt) {
    }

    private enum Presence {
        ABSENT, EXACT, PARTIAL, CONFLICT
    }

    private static final class Race extends RuntimeException {
        private Race() {
            super(null, null, false, false);
        }
    }
}
