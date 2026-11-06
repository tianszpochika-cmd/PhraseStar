package com.englishflow.learner.web;

import com.englishflow.learner.adapter.memory.InMemoryLearnerProfileStore;
import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.application.DefaultLearnerProfileCommandService;
import com.englishflow.learner.application.DefaultLearnerProfileQueryService;
import com.englishflow.learner.config.LearnerServiceProperties;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerProfileStore;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Preference wire alias and If-Match gate. Root overlays this file onto
 * services/learner-service/src/test/java/com/englishflow/learner/web/.
 */
class LearnerPreferencesContractTest {

    private static final Instant NOW = Instant.parse("2026-11-06T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String SUBJECT = "prn_learner00000001";
    private static final JsonMapper JSON = JsonMapper.builder()
            .addModule(new SimpleModule().addSerializer(Instant.class, new ValueSerializer<Instant>() {
                @Override
                public void serialize(Instant value, JsonGenerator gen, SerializationContext ctxt)
                        throws JacksonException {
                    gen.writeString(value.toString());
                }
            }))
            .build();

    private CountingStore store;
    private LearnerHttpController controller;
    private int keySequence;

    @BeforeEach
    void setUp() {
        store = new CountingStore();
        var shadow = new LearnerProfileShadowAdapter(scope -> Optional.empty(), CLOCK);
        var policy = new LearnerAccessPolicy(CLOCK);
        var commands = new DefaultLearnerProfileCommandService(store, shadow, policy, CLOCK);
        var queries = new DefaultLearnerProfileQueryService(store, shadow, policy, CLOCK);
        LearnerServiceProperties properties = new LearnerServiceProperties();
        properties.setPhase("phase-1");
        controller = new LearnerHttpController(commands, queries,
                new VerifiedLearnerPrincipalFactory(properties), null, null);
        keySequence = 0;
    }

    @Test
    void readWriteAndReplayExposeEqualPreferenceVersion() {
        assertAlias(controller.preferences(writer(), new HttpHeaders()).data(), 0);

        String createKey = key("create");
        var created = send(0, "0", false, createKey);
        assertFalse(created.meta().replayed());
        assertAlias(created.data(), 1);

        String legacyKey = key("legacy");
        var legacy = send(1, null, false, legacyKey);
        assertFalse(legacy.meta().replayed());
        assertAlias(legacy.data(), 2);
        assertEquals(2, store.outboxSize());

        var legacyReplay = send(1, null, false, legacyKey);
        assertTrue(legacyReplay.meta().replayed());
        assertEquals(legacy.data(), legacyReplay.data());
        assertAlias(legacyReplay.data(), 2);

        var headerReplay = send(0, "0", false, createKey);
        assertTrue(headerReplay.meta().replayed());
        assertEquals(created.data(), headerReplay.data());
        assertAlias(headerReplay.data(), 1);
        assertEquals(2, store.version());
        assertEquals(2, store.outboxSize());
    }

    @Test
    void bodyOnlyStaleVersionStillUsesStoreCas() {
        send(0, null, false, key("seed"));
        int commits = store.commits();
        long version = store.version();

        LearnerDomainException stale = assertThrows(LearnerDomainException.class,
                () -> send(0, null, false, key("stale")));
        assertEquals(LearnerDecisionCode.CONCURRENT_UPDATE, stale.code());
        assertTrue(stale.getMessage().contains("profile version"), stale.getMessage());
        assertEquals(HttpStatus.CONFLICT, new LearnerHttpExceptionHandler().domain(stale).getStatusCode());
        // LearnerMutation rejects a stale expected version before store.commit, so the store is not entered.
        assertEquals(commits, store.commits());
        assertEquals(version, store.version());
        assertEquals(1, store.outboxSize());
    }

    @Test
    void badIfMatchOrMissingBodyDoesNotReadOrMutate() {
        send(0, null, false, key("seed"));
        assertRejected("01", 1, false, false, LearnerDecisionCode.INVALID_PROFILE, HttpStatus.BAD_REQUEST,
                "IF_MATCH_MALFORMED");
        assertRejected("1,2", 1, false, false, LearnerDecisionCode.INVALID_PROFILE, HttpStatus.BAD_REQUEST,
                "IF_MATCH_MALFORMED");
        assertRejected(" 1", 1, false, false, LearnerDecisionCode.INVALID_PROFILE, HttpStatus.BAD_REQUEST,
                "IF_MATCH_MALFORMED");
        assertRejected("9223372036854775808", 1, false, false, LearnerDecisionCode.INVALID_PROFILE,
                HttpStatus.BAD_REQUEST, "IF_MATCH_OVERFLOW");
        assertRejected("1", 1, true, false, LearnerDecisionCode.INVALID_PROFILE, HttpStatus.BAD_REQUEST,
                "IF_MATCH_DUPLICATE");
        assertRejected(null, 1, false, true, LearnerDecisionCode.INVALID_PROFILE, HttpStatus.BAD_REQUEST,
                "PREFERENCE_BODY_REQUIRED");
        assertRejected("2", 1, false, false, LearnerDecisionCode.CONCURRENT_UPDATE, HttpStatus.CONFLICT,
                "does not equal");
        assertEquals(1, store.version());
        assertEquals(1, store.outboxSize());
    }

    @Test
    void preferenceWriteIsAuthorizedBeforeOwnerRead() {
        LearnerAuthorizationException denied = assertThrows(LearnerAuthorizationException.class,
                () -> controller.patchPreferences(body(0), readerOnly(), key("denied"), new HttpHeaders()));
        assertEquals(LearnerDecisionCode.PERMISSION_DENIED, denied.code());
        assertEquals(HttpStatus.FORBIDDEN,
                new LearnerHttpExceptionHandler().authorization(denied).getStatusCode());
        assertEquals(0, store.reads());
        assertEquals(0, store.commits());
        assertEquals(0, store.version());
    }

    @Test
    void preferenceVersionCannotDivergeFromStateVersion() {
        assertThrows(IllegalArgumentException.class, () -> new LearnerHttpController.PreferencesData(
                "zh-CN", "en-US", "Asia/Shanghai", "DARK", false, "FULL", List.of(1), 2, 1, NOW));
        var alias = new LearnerHttpController.PreferencesData(
                "zh-CN", "en-US", "Asia/Shanghai", "DARK", false, "FULL", List.of(1), 4, NOW);
        assertEquals(4, alias.preferenceVersion());
        assertEquals(4, alias.stateVersion());
    }

    private LearnerHttpController.Envelope<LearnerHttpController.PreferencesData> send(
            long expected, String ifMatch, boolean duplicate, String idempotencyKey) {
        return controller.patchPreferences(body(expected), writer(), idempotencyKey, headers(ifMatch, duplicate));
    }

    private void assertRejected(String ifMatch, long expected, boolean duplicate, boolean missingBody,
            LearnerDecisionCode code, HttpStatus status, String messagePart) {
        int reads = store.reads();
        int commits = store.commits();
        int outbox = store.outboxSize();
        long version = store.version();
        LearnerHttpController.PreferencesPatchRequest request = missingBody ? null : body(expected);
        LearnerDomainException failure = assertThrows(LearnerDomainException.class,
                () -> controller.patchPreferences(request, writer(), key("reject"), headers(ifMatch, duplicate)),
                messagePart);
        assertEquals(code, failure.code(), messagePart);
        assertTrue(failure.getMessage().contains(messagePart), failure.getMessage());
        assertEquals(status, new LearnerHttpExceptionHandler().domain(failure).getStatusCode(), messagePart);
        assertEquals(reads, store.reads(), messagePart);
        assertEquals(commits, store.commits(), messagePart);
        assertEquals(outbox, store.outboxSize(), messagePart);
        assertEquals(version, store.version(), messagePart);
    }

    private static void assertAlias(LearnerHttpController.PreferencesData data, long version) {
        assertEquals(version, data.stateVersion());
        assertEquals(data.stateVersion(), data.preferenceVersion());
        JsonNode json = JSON.valueToTree(data);
        assertEquals(Long.toString(version), json.path("stateVersion").toString());
        assertEquals(json.path("stateVersion").toString(), json.path("preferenceVersion").toString());
    }

    private static LearnerHttpController.PreferencesPatchRequest body(long expected) {
        return new LearnerHttpController.PreferencesPatchRequest(
                expected, null, null, null, "DARK", false, null, null);
    }

    private static HttpHeaders headers(String ifMatch, boolean duplicate) {
        HttpHeaders headers = new HttpHeaders();
        if (ifMatch != null) {
            headers.add(HttpHeaders.IF_MATCH, ifMatch);
            if (duplicate) {
                headers.add(HttpHeaders.IF_MATCH, ifMatch);
            }
        }
        return headers;
    }

    private JwtAuthenticationToken writer() {
        return token("learner.preference.write", "learner.profile.read");
    }

    private JwtAuthenticationToken readerOnly() {
        return token("learner.profile.read");
    }

    private String key(String label) {
        keySequence++;
        return "pref-" + label + "-" + String.format("%04d", keySequence) + "-key";
    }

    private static JwtAuthenticationToken token(String... permissions) {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("principal_id", SUBJECT)
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of(permissions))
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, java.util.Set.of(), jwt.getSubject());
    }

    private static final class CountingStore implements LearnerProfileStore {
        private final InMemoryLearnerProfileStore delegate = new InMemoryLearnerProfileStore();
        private int reads;
        private int commits;

        int reads() {
            return reads;
        }

        int commits() {
            return commits;
        }

        int outboxSize() {
            return delegate.outboxEvents().size();
        }

        long version() {
            return delegate.find(LearnerTenantScope.forPhaseOne(SUBJECT)).map(LearnerProfile::version).orElse(0L);
        }

        @Override
        public Optional<LearnerProfile> find(LearnerTenantScope scope) {
            reads++;
            return delegate.find(scope);
        }

        @Override
        public Optional<FirstDayProjection> findFirstDay(LearnerTenantScope scope) {
            return delegate.findFirstDay(scope);
        }

        @Override
        public Optional<IdempotencyRecord> findIdempotency(
                LearnerTenantScope scope, String operation, IdempotencyKey key) {
            reads++;
            return delegate.findIdempotency(scope, operation, key);
        }

        @Override
        public List<LearnerTenantScope> search(String tenantId, String query, int limit, String afterSubjectId) {
            return delegate.search(tenantId, query, limit, afterSubjectId);
        }

        @Override
        public LearnerCommitResult commit(LearnerMutation mutation) {
            commits++;
            return delegate.commit(mutation);
        }
    }
}
