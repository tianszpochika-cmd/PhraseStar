package com.englishflow.learner.application;

import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.ThemeMode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;

/** DTO seam for explicit UI/content locale and theme preference synchronization. */
public record UpdateLearnerPreferencesCommand(
        String uiLocale,
        String contentLocale,
        ThemeMode themeMode,
        String timezone,
        boolean reducedMotion,
        java.util.List<Integer> weeklyStudyDays,
        IdempotencyKey idempotencyKey,
        Long expectedVersion) {

    /** Character width of {@code request_fingerprint CHAR(64)} in the V1 learner schema. */
    private static final int REQUEST_FINGERPRINT_CAPACITY = 64;

    public UpdateLearnerPreferencesCommand {
        Objects.requireNonNull(uiLocale, "uiLocale is required");
        Objects.requireNonNull(contentLocale, "contentLocale is required");
        Objects.requireNonNull(themeMode, "themeMode is required");
        Objects.requireNonNull(timezone, "timezone is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
        if (expectedVersion != null && expectedVersion < 0) {
            throw new IllegalArgumentException("expectedVersion cannot be negative");
        }
    }

    public UpdateLearnerPreferencesCommand(
            String uiLocale,
            String contentLocale,
            ThemeMode themeMode,
            String timezone,
            boolean reducedMotion,
            IdempotencyKey idempotencyKey) {
        this(uiLocale, contentLocale, themeMode, timezone, reducedMotion, null, idempotencyKey, null);
    }

    public LearnerPreferences toPreferences(Instant now) {
        return new LearnerPreferences(uiLocale, contentLocale, themeMode, timezone, reducedMotion,
                weeklyStudyDays, now);
    }

    /**
     * V1 {@code learner_idempotency_record.request_fingerprint} is {@code CHAR(64)}.
     * Supported locales, timezones, study days and later versions can exceed that.
     * The historical raw text is kept when it fits so existing rows replay unchanged.
     * Longer values are the lowercase SHA-256 of that same text, including the
     * {@code preferences} operation token. Truncated prefixes are not comparable.
     */
    public String fingerprint() {
        String raw = String.join("|", "preferences", uiLocale, contentLocale, themeMode.name(), timezone,
                Boolean.toString(reducedMotion), String.valueOf(weeklyStudyDays),
                String.valueOf(expectedVersion));
        if (raw.length() <= REQUEST_FINGERPRINT_CAPACITY) {
            return raw;
        }
        return sha256(raw);
    }

    private static String sha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
