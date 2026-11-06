package com.englishflow.learner.application;

import com.englishflow.learner.adapter.memory.InMemoryLearnerProfileStore;
import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V1 {@code learner_idempotency_record.request_fingerprint} is {@code CHAR(64)}.
 * Historical preference text that fits is stored unchanged. Longer supported
 * days, timezones and versions use the lowercase SHA-256 of that same text.
 */
class UpdateLearnerPreferencesCommandTest {

    private static final int FINGERPRINT_CAPACITY = 64;
    private static final Pattern LOWER_SHA256 = Pattern.compile("[0-9a-f]{64}");
    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String SUBJECT = "prn_learner00000001";
    private static final String LEGACY_DEFAULT_RAW =
            "preferences|zh-CN|en-US|SYSTEM|Asia/Shanghai|false|null|null";
    private static final String CAPACITY_RAW =
            "preferences|zh-CN|en-US|SYSTEM|Asia/ShanghaiXXXX|false|null|null";

    private InMemoryLearnerProfileStore store;
    private DefaultLearnerProfileCommandService commands;
    private LearnerPrincipalContext context;

    @BeforeEach
    void setUp() {
        store = new InMemoryLearnerProfileStore();
        LegacyLearnerReadModelPort emptyLegacy = scope -> Optional.empty();
        LearnerProfileShadowAdapter shadow = new LearnerProfileShadowAdapter(emptyLegacy, CLOCK);
        LearnerAccessPolicy policy = new LearnerAccessPolicy(CLOCK);
        commands = new DefaultLearnerProfileCommandService(store, shadow, policy, CLOCK);
        context = LearnerPrincipalContext.phaseOne(SUBJECT);
    }

    @Test
    void legacyRawFingerprintStaysExactThroughCapacity() {
        LearnerPreferences defaults = LearnerPreferences.defaults(NOW);
        UpdateLearnerPreferencesCommand legacy = command(defaults, null, key("preference-20260822-raw"));
        assertEquals(LEGACY_DEFAULT_RAW, historical(legacy));
        assertExactLegacy(legacy, LEGACY_DEFAULT_RAW);

        LearnerPreferences atCapacity = accepted(defaults, defaults.timezone() + "XXXX", null);
        UpdateLearnerPreferencesCommand capacity = command(atCapacity, null, key("preference-20260822-cap"));
        assertEquals(FINGERPRINT_CAPACITY, historical(capacity).length());
        assertEquals(CAPACITY_RAW, historical(capacity));
        assertExactLegacy(capacity, CAPACITY_RAW);

        MutationResult<LearnerProfileView> written = update(legacy);
        assertFalse(written.replayed());
        assertEquals(defaults.uiLocale(), written.data().preferences().orElseThrow().uiLocale());
        assertEquals(defaults.contentLocale(), written.data().preferences().orElseThrow().contentLocale());
        assertEquals(defaults.themeMode(), written.data().preferences().orElseThrow().themeMode());
        assertEquals(defaults.timezone(), written.data().preferences().orElseThrow().timezone());
        assertEquals(LEGACY_DEFAULT_RAW, storedFingerprint(legacy.idempotencyKey()));
        assertTrue(update(legacy).replayed());
        assertEquals(written.version(), update(legacy).version());
        assertEquals(1, store.outboxEvents().size());

        MutationResult<LearnerProfileView> capacityWrite = update(capacity);
        assertFalse(capacityWrite.replayed());
        assertEquals(2L, capacityWrite.version());
        assertEquals(atCapacity.timezone(), capacityWrite.data().preferences().orElseThrow().timezone());
        assertEquals(CAPACITY_RAW, storedFingerprint(capacity.idempotencyKey()));
        assertEquals(2, store.outboxEvents().size());
    }

    @Test
    void longSupportedPreferenceUsesDeterministicSha256() {
        LearnerPreferences defaults = LearnerPreferences.defaults(NOW);
        LearnerPreferences justOver = accepted(defaults, defaults.timezone() + "XXXXX", null);
        UpdateLearnerPreferencesCommand overflow = command(justOver, null, key("preference-20260822-over"));
        String overflowRaw = historical(overflow);
        assertEquals(FINGERPRINT_CAPACITY + 1, overflowRaw.length());
        assertSha(overflow, overflowRaw, jdkSha256(overflowRaw));

        LearnerPreferences accepted = accepted(
                defaults, maximumTimezone(defaults), defaults.effectiveStudyDays());
        assertEquals(FINGERPRINT_CAPACITY, accepted.timezone().length());
        assertEquals(List.of(1, 2, 3, 4, 5, 6, 7), accepted.weeklyStudyDays());
        assertEquals(defaults.uiLocale(), accepted.uiLocale());
        assertEquals(defaults.contentLocale(), accepted.contentLocale());
        assertEquals(defaults.themeMode(), accepted.themeMode());
        assertEquals(defaults.reducedMotion(), accepted.reducedMotion());

        UpdateLearnerPreferencesCommand command = command(accepted, 0L, key("preference-20260822-long"));
        UpdateLearnerPreferencesCommand repeated = command(accepted, 0L, command.idempotencyKey());
        assertEquals(accepted.timezone(), command.toPreferences(NOW).timezone());
        assertEquals(accepted.weeklyStudyDays(), command.toPreferences(NOW).weeklyStudyDays());
        String raw = historical(command);
        assertTrue(raw.length() > FINGERPRINT_CAPACITY);
        assertTrue(raw.indexOf(String.valueOf(accepted.weeklyStudyDays())) >= FINGERPRINT_CAPACITY);
        assertTrue(raw.endsWith("|0"));
        String digest = jdkSha256(raw);
        assertSha(command, raw, digest);
        assertEquals(digest, repeated.fingerprint());

        MutationResult<LearnerProfileView> written = update(command);
        assertFalse(written.replayed());
        assertEquals(1L, written.version());
        LearnerPreferences saved = written.data().preferences().orElseThrow();
        assertEquals(accepted.timezone(), saved.timezone());
        assertEquals(accepted.weeklyStudyDays(), saved.weeklyStudyDays());
        assertEquals(defaults.uiLocale(), saved.uiLocale());
        assertEquals(defaults.contentLocale(), saved.contentLocale());
        assertEquals(digest, storedFingerprint(command.idempotencyKey()));
        assertEquals(FINGERPRINT_CAPACITY, storedFingerprint(command.idempotencyKey()).length());
        assertTrue(update(command).replayed());
        assertEquals(1, store.outboxEvents().size());
    }

    @Test
    void distinctSupportedVersionConflictsWhenTruncatedPrefixMatches() {
        LearnerPreferences defaults = LearnerPreferences.defaults(NOW);
        LearnerPreferences accepted = accepted(
                defaults, maximumTimezone(defaults), defaults.effectiveStudyDays());
        IdempotencyKey key = key("preference-20260822-conf");
        UpdateLearnerPreferencesCommand first = command(accepted, 0L, key);
        UpdateLearnerPreferencesCommand laterVersion = command(accepted, 1L, key);

        String firstRaw = historical(first);
        String laterRaw = historical(laterVersion);
        assertTrue(firstRaw.length() > FINGERPRINT_CAPACITY);
        assertTrue(laterRaw.length() > FINGERPRINT_CAPACITY);
        assertEquals(firstRaw.substring(0, FINGERPRINT_CAPACITY), laterRaw.substring(0, FINGERPRINT_CAPACITY));
        assertEquals(firstRaw.substring(0, firstRaw.length() - 1), laterRaw.substring(0, laterRaw.length() - 1));
        assertTrue(firstRaw.endsWith("|0"));
        assertTrue(laterRaw.endsWith("|1"));
        assertEquals(accepted.weeklyStudyDays(), laterVersion.toPreferences(NOW).weeklyStudyDays());

        String firstDigest = jdkSha256(firstRaw);
        String laterDigest = jdkSha256(laterRaw);
        assertSha(first, firstRaw, firstDigest);
        assertSha(laterVersion, laterRaw, laterDigest);
        assertNotEquals(firstDigest, laterDigest);

        MutationResult<LearnerProfileView> written = update(first);
        assertFalse(written.replayed());
        assertEquals(accepted.timezone(), written.data().preferences().orElseThrow().timezone());
        assertEquals(accepted.weeklyStudyDays(), written.data().preferences().orElseThrow().weeklyStudyDays());
        assertTrue(update(first).replayed());

        LearnerDomainException conflict = assertThrows(LearnerDomainException.class, () -> update(laterVersion));
        assertEquals(LearnerDecisionCode.IDEMPOTENCY_CONFLICT, conflict.code());
        assertEquals(firstDigest, storedFingerprint(key));
        assertEquals(accepted.weeklyStudyDays(), update(first).data().preferences().orElseThrow().weeklyStudyDays());
        assertEquals(1, store.outboxEvents().size());
    }

    private static void assertExactLegacy(UpdateLearnerPreferencesCommand command, String raw) {
        assertTrue(raw.length() <= FINGERPRINT_CAPACITY);
        assertEquals(raw, historical(command));
        assertEquals(raw, command.fingerprint());
        assertFalse(LOWER_SHA256.matcher(command.fingerprint()).matches());
    }

    private static void assertSha(UpdateLearnerPreferencesCommand command, String raw, String digest) {
        assertEquals(FINGERPRINT_CAPACITY, digest.length());
        assertTrue(LOWER_SHA256.matcher(digest).matches());
        assertEquals(digest, jdkSha256(raw));
        assertEquals(digest, command.fingerprint());
        assertNotEquals(raw, command.fingerprint());
        assertNotEquals(raw.substring(0, FINGERPRINT_CAPACITY), command.fingerprint());
    }

    private MutationResult<LearnerProfileView> update(UpdateLearnerPreferencesCommand command) {
        return commands.updatePreferences(context, command, RequestMetadata.none());
    }

    private String storedFingerprint(IdempotencyKey key) {
        return store.findIdempotency(context.scope(), "preference.update", key)
                .orElseThrow()
                .fingerprint();
    }

    private static LearnerPreferences accepted(
            LearnerPreferences defaults,
            String timezone,
            List<Integer> days) {
        return new LearnerPreferences(
                defaults.uiLocale(),
                defaults.contentLocale(),
                defaults.themeMode(),
                timezone,
                defaults.reducedMotion(),
                days,
                defaults.updatedAt());
    }

    private static String maximumTimezone(LearnerPreferences defaults) {
        return defaults.timezone() + "X".repeat(FINGERPRINT_CAPACITY - defaults.timezone().length());
    }

    private static UpdateLearnerPreferencesCommand command(
            LearnerPreferences preferences,
            Long expectedVersion,
            IdempotencyKey key) {
        return new UpdateLearnerPreferencesCommand(
                preferences.uiLocale(),
                preferences.contentLocale(),
                preferences.themeMode(),
                preferences.timezone(),
                preferences.reducedMotion(),
                preferences.weeklyStudyDays(),
                key,
                expectedVersion);
    }

    /** Canonical historical fingerprint, including the {@code preferences} operation token. */
    private static String historical(UpdateLearnerPreferencesCommand command) {
        return String.join("|",
                "preferences",
                command.uiLocale(),
                command.contentLocale(),
                command.themeMode().name(),
                command.timezone(),
                Boolean.toString(command.reducedMotion()),
                String.valueOf(command.weeklyStudyDays()),
                String.valueOf(command.expectedVersion()));
    }

    private static String jdkSha256(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static IdempotencyKey key(String value) {
        return new IdempotencyKey(value);
    }
}
