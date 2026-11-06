package com.englishflow.content.web;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.GradableQuestions;
import com.englishflow.content.web.ContentHttpPrincipals.VerifiedContentPrincipal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

/**
 * Service-only reader and scorer for one published reading opt-in version.
 *
 * <p>The path version is the only version. The current pointer is compared and
 * never substituted. Answer rules, the per-version seal, and the selected
 * option stay in this process.
 */
@RestController
@RequestMapping("/internal/v1/content/assessment-snapshots")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class GradableAssessmentSnapshotController {

    static final String ASSESSMENT_SERVICE = "assessment-service";
    private static final String TENANT = ContentHttpPrincipals.PLATFORM_TENANT;
    private static final long MAX_ITEM_ID = 9007199254740991L;
    private static final Set<String> SCORE_FIELDS = Set.of(
            "contentCode", "itemId", "selectedOptionId", "snapshotId", "snapshotHash", "ruleDigest");
    private static final Pattern CONTENT_CODE = Pattern.compile("^[a-z][a-z0-9._:-]{1,127}$");
    private static final Pattern OPTION_ID = Pattern.compile("^[a-z][a-z0-9._:-]{0,63}$");
    private static final Pattern SNAPSHOT_ID = Pattern.compile("^snap_[A-Za-z0-9._:-]{8,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern PATH_VERSION = Pattern.compile("[1-9][0-9]{0,18}");

    /**
     * One owner row. Verified rights columns only; editor proposals are not read.
     * {@code current_published_version_id} is not a second lookup key.
     */
    private static final String OWNER_VERSION_SQL = """
            SELECT c.content_id, c.content_code, c.content_epoch, c.projection_version,
                   c.current_published_version_id,
                   v.content_version_id, v.status, v.payload_json, v.published_at, v.archived_at,
                   v.copyright_status, v.rights_allows_learning, v.rights_source_code,
                   v.rights_license_code, v.rights_permitted_channels, v.rights_starts_at,
                   v.rights_expires_at, v.authorization_evidence_ref,
                   v.editor, v.first_reviewer, v.final_reviewer, v.publisher
              FROM content_version v
              JOIN content_definition c
                ON c.content_id = v.content_id
               AND c.tenant_id = ?
             WHERE v.content_version_id = ?
               AND c.tenant_id = ?
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public GradableAssessmentSnapshotController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/{contentVersionId}")
    public Map<String, Object> getB10AssessmentContentSnapshot(
            Authentication authentication, @PathVariable("contentVersionId") String contentVersionId) {
        requireWorkload(authentication);
        Reading reading = read(pathVersion(contentVersionId));
        return Map.of("data", reading.body());
    }

    @PostMapping("/{contentVersionId}/score")
    public Map<String, Object> scoreB10AssessmentContentSnapshot(
            Authentication authentication,
            @PathVariable("contentVersionId") String contentVersionId,
            @RequestBody(required = false) Map<String, Object> body) {
        requireWorkload(authentication);
        long versionId = pathVersion(contentVersionId);
        ScoreRequest request = scoreRequest(body);
        Reading reading = read(versionId);
        if (!reading.contentCode().equals(request.contentCode())
                || !reading.snapshotId().equals(request.snapshotId())
                || !reading.snapshotHash().equals(request.snapshotHash())) {
            throw conflict();
        }
        ReadingItem item = reading.item(request.itemId());
        if (item == null) {
            throw gone();
        }
        if (!item.ruleDigest().equals(request.ruleDigest())) {
            throw conflict();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemId", item.itemId());
        result.put("snapshotId", reading.snapshotId());
        result.put("ruleDigest", item.ruleDigest());
        result.put("outcome", item.correctOption().equals(request.selectedOptionId()) ? "FULL" : "ZERO");
        return result;
    }

    private static void requireWorkload(Authentication authentication) {
        VerifiedContentPrincipal principal = ContentHttpPrincipals.requirePlacementScore(authentication);
        if (!ASSESSMENT_SERVICE.equals(principal.subject())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "assessment workload is required");
        }
    }

    private Reading read(long versionId) {
        Map<String, Object> row = loadRow(versionId);
        if (!numberEquals(row.get("content_version_id"), versionId)) {
            throw notFound();
        }
        rejectSealedBank(row);
        requireCurrentPublished(row, versionId);
        requireFourActors(row);
        requireRights(row, Instant.now());
        return reading(row, versionId);
    }

    private Map<String, Object> loadRow(long versionId) {
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(OWNER_VERSION_SQL, TENANT, versionId, TENANT);
        } catch (DataAccessException ex) {
            throw unavailable();
        }
        if (rows.isEmpty()) {
            throw notFound();
        }
        if (rows.size() != 1) {
            throw unavailable();
        }
        return rows.getFirst();
    }

    private Reading reading(Map<String, Object> row, long versionId) {
        String contentCode = requiredText(row.get("content_code"));
        if (!CONTENT_CODE.matcher(contentCode).matches()) {
            throw gone();
        }
        long contentEpoch = epoch(row.get("content_epoch"));
        long snapshotVersion = positiveLong(row.get("projection_version"));
        Instant published = instantOf(row.get("published_at"));
        if (published == null) {
            throw gone();
        }
        String publishedAt = DateTimeFormatter.ISO_INSTANT.format(published);
        String snapshotId = snapshotId(versionId);
        Map<String, Object> payload = jsonMap(text(row.get("payload_json")));
        String seal = text(payload.get(GradableQuestions.SEAL_FIELD));
        if (!GradableQuestions.isStoredSeal(seal)) {
            throw gone();
        }
        List<Map<String, Object>> questions;
        try {
            questions = GradableQuestions.copy(payload.get(GradableQuestions.FIELD));
        } catch (ContentOperationException | ClassCastException ex) {
            throw gone();
        }
        List<ItemDraft> drafts = drafts(questions, seal, versionId);
        String versionDigest = hmac(seal, "version|" + versionId + "|" + contentCode + "|" + proofs(drafts));
        List<Map<String, Object>> visibleItems = new ArrayList<>(drafts.size());
        List<ReadingItem> items = new ArrayList<>(drafts.size());
        for (int index = 0; index < drafts.size(); index++) {
            ItemDraft draft = drafts.get(index);
            visibleItems.add(visibleItem(draft, index, versionDigest));
            items.add(new ReadingItem(draft.itemId(), draft.ruleDigest(), draft.correctOption()));
        }
        List<Map<String, Object>> frozenItems = List.copyOf(visibleItems);
        String snapshotHash = snapshotHash(
                contentCode, versionId, contentEpoch, snapshotId, publishedAt, versionDigest, frozenItems);
        Map<String, Object> body = body(
                contentCode, versionId, contentEpoch, snapshotVersion, snapshotId, snapshotHash,
                publishedAt, versionDigest, frozenItems);
        return new Reading(contentCode, snapshotId, snapshotHash, body, List.copyOf(items));
    }

    private List<ItemDraft> drafts(List<Map<String, Object>> questions, String seal, long versionId) {
        try {
            List<ItemDraft> drafts = new ArrayList<>(questions.size());
            for (Map<String, Object> question : questions) {
                long itemId = ((Number) question.get("itemId")).longValue();
                String correct = (String) ((Map<?, ?>) question.get("answerRule")).get("correctOption");
                String digest = hmac(seal, "item|" + versionId + "|" + itemId + "|" + correct);
                drafts.add(new ItemDraft(
                        itemId,
                        (String) question.get("stem"),
                        visibleOptions(question.get("options")),
                        correct,
                        digest));
            }
            return drafts;
        } catch (ClassCastException | NullPointerException ex) {
            throw gone();
        }
    }

    private static Map<String, Object> visibleItem(ItemDraft draft, int index, String versionDigest) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("ruleRef", "rule:reading." + draft.itemId());
        rule.put("answerRuleVersion", versionDigest);
        rule.put("ruleDigest", draft.ruleDigest());
        rule.put("evaluationMode", "DETERMINISTIC");
        rule.put("sealed", Boolean.TRUE);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemId", draft.itemId());
        item.put("itemCode", "item." + draft.itemId());
        item.put("itemType", "READING");
        item.put("stem", draft.stem());
        item.put("options", draft.options());
        item.put("displayOrder", index);
        item.put("ruleContract", Map.copyOf(rule));
        return Map.copyOf(item);
    }

    private static List<Map<String, Object>> visibleOptions(Object raw) {
        if (!(raw instanceof List<?> options)) {
            throw gone();
        }
        List<Map<String, Object>> copy = new ArrayList<>(options.size());
        for (Object option : options) {
            if (!(option instanceof Map<?, ?> fields)) {
                throw gone();
            }
            Map<String, Object> visible = new LinkedHashMap<>();
            visible.put("optionId", fields.get("optionId"));
            visible.put("label", fields.get("label"));
            copy.add(Map.copyOf(visible));
        }
        return List.copyOf(copy);
    }

    /**
     * HMAC-SHA256 with the stored 256-bit seal as the key. The digest is not a
     * hash of the raw correct option.
     */
    private static String hmac(String seal, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(HexFormat.of().parseHex(seal), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            throw unavailable();
        }
    }

    private static String proofs(List<ItemDraft> drafts) {
        StringBuilder joined = new StringBuilder();
        for (ItemDraft draft : drafts) {
            if (!joined.isEmpty()) {
                joined.append(',');
            }
            joined.append(draft.ruleDigest());
        }
        return joined.toString();
    }

    private static String snapshotHash(
            String contentCode, long versionId, long contentEpoch, String snapshotId,
            String publishedAt, String versionDigest, List<Map<String, Object>> items) {
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("answerRuleSetVersion", versionDigest);
        canonical.put("contentCode", contentCode);
        canonical.put("contentEpoch", contentEpoch);
        canonical.put("contentVersionId", versionId);
        canonical.put("items", items);
        canonical.put("publishedAt", publishedAt);
        canonical.put("snapshotId", snapshotId);
        return ContentPayloadHash.sha256(canonical);
    }

    private static Map<String, Object> body(
            String contentCode, long versionId, long contentEpoch, long snapshotVersion,
            String snapshotId, String snapshotHash, String publishedAt, String versionDigest,
            List<Map<String, Object>> items) {
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("contentCode", contentCode);
        pin.put("contentVersionId", versionId);
        pin.put("contentEpoch", contentEpoch);
        pin.put("snapshotId", snapshotId);
        pin.put("snapshotHash", snapshotHash);
        pin.put("pinStatus", "PINNED");
        pin.put("pinnedAt", publishedAt);
        pin.put("recoveryReasonCode", "NONE");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("pin", pin);
        data.put("snapshotVersion", snapshotVersion);
        data.put("answerRuleSetVersion", versionDigest);
        data.put("items", items);
        data.put("generatedAt", publishedAt);
        return data;
    }

    /**
     * The owner version id is globally unique, so the id stays inside
     * {@code B10SnapshotId} for a 128-character code and an int64 version.
     * The exact code stays on the pin and inside the snapshot hash.
     */
    private static String snapshotId(long versionId) {
        String id = "snap_reading_" + versionId;
        if (!SNAPSHOT_ID.matcher(id).matches()) {
            throw gone();
        }
        return id;
    }

    private void requireRights(Map<String, Object> row, Instant now) {
        CopyrightStatus status;
        try {
            status = CopyrightStatus.valueOf(requiredText(row.get("copyright_status")));
        } catch (IllegalArgumentException ex) {
            throw forbidden();
        }
        if (status != CopyrightStatus.ACTIVE || !flag(row.get("rights_allows_learning"))) {
            throw forbidden();
        }
        Set<String> channels = channels(row.get("rights_permitted_channels"));
        Instant starts = window(row.get("rights_starts_at"));
        Instant expires = window(row.get("rights_expires_at"));
        String evidence = requiredText(row.get("authorization_evidence_ref"));
        ContentRights rights;
        try {
            rights = new ContentRights(
                    requiredText(row.get("rights_source_code")),
                    requiredText(row.get("rights_license_code")),
                    status,
                    true,
                    channels,
                    starts,
                    expires,
                    evidence.isBlank() ? null : evidence);
        } catch (ContentOperationException ex) {
            throw forbidden();
        }
        // SEALED is the historical assessment grant. It is not a ContentChannel.
        // "*" satisfies both allows() checks. Publication's LEARNER+PUBLIC gate is separate.
        boolean assessmentGrant = rights.allows(ContentChannel.ASSESSMENT, now)
                || (channels.contains("SEALED") && rights.isActive(now) && rights.allowsLearning());
        if (!rights.allows(ContentChannel.LEARNER, now) || !assessmentGrant) {
            throw forbidden();
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
            } catch (Exception ex) {
                return Set.of();
            }
        }
        if (!(decoded instanceof List<?> values) || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> channels = new LinkedHashSet<>();
        for (Object value : values) {
            if (!(value instanceof String text) || text.isBlank()) {
                return Set.of();
            }
            channels.add(text.trim().toUpperCase(Locale.ROOT));
        }
        return Set.copyOf(channels);
    }

    private static void requireFourActors(Map<String, Object> row) {
        String editor = requiredText(row.get("editor"));
        String first = requiredText(row.get("first_reviewer"));
        String fin = requiredText(row.get("final_reviewer"));
        String publisher = requiredText(row.get("publisher"));
        if (editor.isBlank() || first.isBlank() || fin.isBlank() || publisher.isBlank()
                || editor.equals(first) || editor.equals(fin) || editor.equals(publisher)
                || first.equals(fin) || first.equals(publisher) || fin.equals(publisher)) {
            throw gone();
        }
    }

    private static void requireCurrentPublished(Map<String, Object> row, long versionId) {
        if (!"PUBLISHED".equals(requiredText(row.get("status")))
                || row.get("archived_at") != null
                || instantOf(row.get("published_at")) == null
                || !numberEquals(row.get("current_published_version_id"), versionId)) {
            throw gone();
        }
    }

    private static void rejectSealedBank(Map<String, Object> row) {
        if (GradableQuestions.SEALED_CODE.equals(requiredText(row.get("content_code")))
                || GradableQuestions.SEALED_OWNER_ID.equals(requiredText(row.get("content_id")))) {
            throw gone();
        }
    }

    private Map<String, Object> jsonMap(String json) {
        if (json == null || json.isBlank()) {
            throw gone();
        }
        try {
            Object decoded = objectMapper.readValue(json, Map.class);
            if (!(decoded instanceof Map<?, ?> map)) {
                throw gone();
            }
            LinkedHashMap<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                copy.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return copy;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw gone();
        }
    }

    private static ScoreRequest scoreRequest(Map<String, Object> body) {
        if (body == null || !SCORE_FIELDS.equals(body.keySet())) {
            throw badRequest();
        }
        return new ScoreRequest(
                requirePattern(body.get("contentCode"), CONTENT_CODE),
                scoreItemId(body.get("itemId")),
                requirePattern(body.get("selectedOptionId"), OPTION_ID),
                requirePattern(body.get("snapshotId"), SNAPSHOT_ID),
                requirePattern(body.get("snapshotHash"), SHA256),
                requirePattern(body.get("ruleDigest"), SHA256));
    }

    private static long scoreItemId(Object raw) {
        long value;
        if (raw instanceof Integer || raw instanceof Long || raw instanceof Short || raw instanceof Byte) {
            value = ((Number) raw).longValue();
        } else if (raw instanceof java.math.BigInteger big) {
            if (big.bitLength() > 63) {
                throw badRequest();
            }
            value = big.longValue();
        } else {
            throw badRequest();
        }
        if (value < 1 || value > MAX_ITEM_ID) {
            throw badRequest();
        }
        return value;
    }

    private static String requirePattern(Object raw, Pattern pattern) {
        if (!(raw instanceof String text) || !pattern.matcher(text).matches()) {
            throw badRequest();
        }
        return text;
    }

    private static long pathVersion(String raw) {
        if (raw == null || !PATH_VERSION.matcher(raw).matches()) {
            throw badRequest();
        }
        try {
            long value = Long.parseLong(raw);
            if (value < 1) {
                throw badRequest();
            }
            return value;
        } catch (NumberFormatException ex) {
            throw badRequest();
        }
    }

    private static Instant window(Object raw) {
        if (raw == null) {
            return null;
        }
        Instant instant = instantOf(raw);
        if (instant == null) {
            throw forbidden();
        }
        return instant;
    }

    private static Instant instantOf(Object value) {
        if (value == null) {
            return null;
        }
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
            } catch (DateTimeParseException ex) {
                try {
                    return LocalDateTime.parse(text.replace(' ', 'T')).toInstant(ZoneOffset.UTC);
                } catch (DateTimeParseException ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private static boolean flag(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value instanceof Number number && number.intValue() == 1;
    }

    private static boolean numberEquals(Object value, long expected) {
        return value instanceof Number number && number.longValue() == expected;
    }

    private static long positiveLong(Object value) {
        if (!(value instanceof Number number)) {
            throw gone();
        }
        long parsed = number.longValue();
        if (parsed < 1) {
            throw gone();
        }
        return parsed;
    }

    private static long epoch(Object value) {
        if (!(value instanceof Number number)) {
            throw gone();
        }
        long parsed = number.longValue();
        if (parsed < 0) {
            throw gone();
        }
        return parsed;
    }

    private static String text(Object value) {
        if (value instanceof String text) {
            return text;
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        if (value instanceof java.sql.Clob clob) {
            try {
                long length = clob.length();
                if (length < 0 || length > Integer.MAX_VALUE) {
                    return null;
                }
                return clob.getSubString(1, (int) length);
            } catch (java.sql.SQLException ex) {
                return null;
            }
        }
        return null;
    }

    private static String requiredText(Object value) {
        String text = text(value);
        return text == null ? "" : text.trim();
    }

    private static ResponseStatusException badRequest() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "request is invalid");
    }

    private static ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "content rights are not active");
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "content version does not exist");
    }

    private static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "content pin does not match");
    }

    private static ResponseStatusException gone() {
        return new ResponseStatusException(HttpStatus.GONE, "content version is unavailable");
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "content version could not be read");
    }

    private record ItemDraft(
            long itemId, String stem, List<Map<String, Object>> options, String correctOption, String ruleDigest) {
    }

    private record ReadingItem(long itemId, String ruleDigest, String correctOption) {
    }

    private record Reading(
            String contentCode, String snapshotId, String snapshotHash,
            Map<String, Object> body, List<ReadingItem> items) {

        private ReadingItem item(long itemId) {
            for (ReadingItem candidate : items) {
                if (candidate.itemId() == itemId) {
                    return candidate;
                }
            }
            return null;
        }
    }

    private record ScoreRequest(
            String contentCode, long itemId, String selectedOptionId,
            String snapshotId, String snapshotHash, String ruleDigest) {
    }
}
