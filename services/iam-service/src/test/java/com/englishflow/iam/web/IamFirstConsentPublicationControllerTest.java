package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamRuntimeConfiguration;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.InMemoryAuditFactPort;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryDeviceRegistry;
import com.englishflow.iam.domain.InMemoryIdempotencyStore;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemoryPasswordResetDelivery;
import com.englishflow.iam.domain.InMemoryRateLimitStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Real principal controller plus an explicit policy double. Fixture text is simulated test input.
 */
class IamFirstConsentPublicationControllerTest {

    private static final Instant NOW = Instant.parse("2026-11-05T00:00:00Z");
    private static final String PASSWORD = "ValidPassword123!";
    private static final String IDENTIFIER = "first-consent@example.com";
    private static final String POLICY_DIGEST = "c0ffee".repeat(10) + "c0ff";
    private static final String ROTATED_BODY = "ROTATED-TERMS-TEXT-MUST-NOT-APPEAR";

    private final ObjectMapper objectMapper = new IamRuntimeConfiguration().iamObjectMapper();

    private RecordingConsentPolicy policy;
    private InMemoryAdultGateFactStore adultGateFacts;
    private SessionService sessions;
    private SessionRecord session;
    private PrincipalId principalId;
    private JwtAuthenticationToken authToken;
    private MockMvc mockMvc;
    private List<FixtureDocument> fixtures;

    @BeforeEach
    void setUp() throws Exception {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        fixtures = loadFixtures();
        policy = new RecordingConsentPolicy();
        policy.restore(fixtures);

        IamServiceProperties properties = new IamServiceProperties();
        properties.getJwt().setIssuer("https://auth.englishflow.test");
        properties.getJwt().setAudience("englishflow-platform");
        properties.getJwt().setEphemeralKeysAllowed(true);
        properties.getJwt().setAccessTokenTtl(Duration.ofMinutes(15));
        properties.getJwt().setRefreshTokenTtl(Duration.ofDays(30));
        properties.getIdempotency().setReplaySecret("controller-replay-secret-for-idempotency-2026");
        properties.getIdempotency().setFingerprintSecret("controller-fingerprint-secret-for-idempotency-2026");
        properties.setLocalAdultGateEnabled(true);

        InMemoryAuditFactPort audit = new InMemoryAuditFactPort();
        InMemoryRateLimitStore rateLimits = new InMemoryRateLimitStore();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accounts, new BCryptPasswordEncoder(12),
                audit, clock, properties, rateLimits);
        AccountRecord account = passwords.register(IDENTIFIER, PASSWORD, ClientAuthorityClaims.none());
        principalId = account.principalId();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principalId, account.roles());

        sessions = new SessionService(new InMemorySessionStore(), audit, clock, properties);
        DeviceService devices = new DeviceService(new InMemoryDeviceRegistry(), audit, clock);
        DeviceId deviceId = new DeviceId(UUID.randomUUID().toString());
        devices.register(context, new DeviceRegistrationCommand(deviceId, "WEB", "Chrome Browser",
                ClientAuthorityClaims.none()));
        session = sessions.open(context, deviceId).session();

        adultGateFacts = new InMemoryAdultGateFactStore();
        AdultGateService adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions,
                IamTransactionRunner.direct());
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore, policy, audit, clock, sessions,
                IamTransactionRunner.direct());
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties, sessions,
                IamTransactionRunner.direct(), rateLimits, new InMemoryPasswordResetDelivery(),
                properties.getIdempotency().getFingerprintSecret());
        JwtSigningKeyProvider signingKeys = new JwtSigningKeyProvider(properties);
        JWKSource<SecurityContext> source = (selector, ctx) -> List.of(signingKeys.signingKey());
        JwtTokenService tokens = new JwtTokenService(new NimbusJwtEncoder(source), signingKeys, properties, clock);
        IdempotencyService idempotency = new IdempotencyService(new InMemoryIdempotencyStore(), objectMapper,
                IamTransactionRunner.direct(), properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(), Duration.ofHours(24));
        IamAuthenticationController controller = new IamAuthenticationController(properties, passwords, passwordResets,
                tokens, signingKeys, sessions, devices, adultGates, adultGateFacts, consents, consentStore,
                idempotency, clock);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
        authToken = createAuthToken(principalId, session);
    }

    @Test
    void principalProjectsFixtureDocumentsForAnEligibleIncompleteConsent() throws Exception {
        policy.resetReads();
        assertOmitted(principalOk(), "账号条款样本");
        assertEquals(0, policy.bodyReads());

        adultGateFacts.approve(principalId, "b30-adult-v1", NOW);
        policy.resetReads();
        String json = principalOk();
        JsonNode data = objectMapper.readTree(json).get("data");
        JsonNode documents = data.get("publishedConsentDocuments");
        assertEquals(3, documents.size());
        assertEquals(List.of("TERMS", "PRIVACY", "ADULT_LEARNING"), textValues(documents, "type"));
        assertEquals(List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE", "ADULT_LEARNING_ELIGIBILITY"),
                textValues(documents, "purpose"));
        assertFalse(data.get("consentState").has("bodyText"));
        assertFalse(data.get("consentState").has("publishedConsentDocuments"));
        assertFalse(data.get("consentState").get("accepted").asBoolean());
        assertEquals("RESTRICTED", data.get("status").asText());
        assertEquals("mock-mb004-terms-v1", data.get("consentState").get("version").asText());
        assertEquals(1, policy.bodyReads());

        List<String> digests = new ArrayList<>();
        for (int index = 0; index < fixtures.size(); index++) {
            FixtureDocument fixture = fixtures.get(index);
            JsonNode document = documents.get(index);
            assertEquals(fixture.type(), document.get("type").asText());
            assertEquals(fixture.purpose(), document.get("purpose").asText());
            assertEquals(fixture.documentVersion(), document.get("documentVersion").asText());
            assertEquals(fixture.documentDigest(), document.get("documentDigest").asText());
            assertEquals(fixture.bodyText(), document.get("bodyText").asText());
            assertEquals(fixture.publishedAt(), Instant.parse(document.get("publishedAt").asText()));
            assertEquals(fixture.policyVersion(), document.get("policyVersion").asText());
            assertEquals(fixture.policyRef(), document.get("policyRef").asText());
            assertEquals(fixture.documentDigest(), sha256Utf8Hex(document.get("bodyText").asText()));
            digests.add(document.get("documentDigest").asText());
        }
        assertEquals(3, Set.copyOf(digests).size());
        assertNotEquals(digests.get(0), digests.get(1));
        assertTrue(json.contains("账号条款样本"));
        assertTrue(json.contains("隐私说明样本"));
        assertTrue(json.contains("成人学习资格样本"));

        String atLimit = "\uD83D\uDE0A" + "b".repeat(65_535);
        policy.replaceBodyAndDigest(ConsentType.TERMS_OF_SERVICE, atLimit);
        JsonNode atLimitDocument = objectMapper.readTree(principalOk()).get("data").get("publishedConsentDocuments").get(0);
        assertEquals(atLimit, atLimitDocument.get("bodyText").asText());
        assertEquals(65_536, atLimitDocument.get("bodyText").asText().codePointCount(0,
                atLimitDocument.get("bodyText").asText().length()));

        policy.restore(fixtures);
        policy.replaceBodyAndDigest(ConsentType.TERMS_OF_SERVICE, "c".repeat(65_537));
        assertOmitted(principalOk(), "c".repeat(80));

        policy.restore(fixtures);
        policy.removeBody(ConsentType.ADULT_LEARNING);
        assertOmitted(principalOk(), "隐私说明样本");

        policy.restore(fixtures);
        policy.replaceBodyOnly(ConsentType.TERMS_OF_SERVICE, fixtures.get(1).bodyText());
        assertOmitted(principalOk(), "隐私说明样本");

        policy.restore(fixtures);
        policy.replaceBodyAndDigest(ConsentType.TERMS_OF_SERVICE, "nul-body\u0000tail");
        String nulJson = principalOk();
        assertOmitted(nulJson, "nul-body");
        assertFalse(nulJson.indexOf('\u0000') >= 0);

        policy.restore(fixtures);
        String lowercase = fixtures.get(0).documentDigest();
        policy.setStoredDigest(ConsentType.TERMS_OF_SERVICE, lowercase.toUpperCase(Locale.ROOT));
        policy.resetReads();
        String uppercaseJson = principalOk();
        assertOmitted(uppercaseJson, "账号条款样本");
        assertFalse(uppercaseJson.contains(lowercase.toUpperCase(Locale.ROOT)));
        assertEquals(1, policy.bodyReads());

        policy.restore(fixtures);
        policy.failNextBodyRead(new IllegalStateException("consent body read failed"));
        String failedJson = principalOk();
        assertOmitted(failedJson, "账号条款样本");
        assertEquals("mock-mb004-terms-v1", objectMapper.readTree(failedJson).get("data").get("consentState")
                .get("version").asText());
        assertEquals(1, policy.bodyReads());

        policy.restore(fixtures);
        policy.rotateOnRead();
        String rotatedJson = principalOk();
        assertOmitted(rotatedJson, "账号条款样本");
        assertFalse(rotatedJson.contains(ROTATED_BODY));
        assertFalse(rotatedJson.contains("mock-mb004-terms-v2"));
        assertEquals("mock-mb004-terms-v1", objectMapper.readTree(rotatedJson).get("data").get("consentState")
                .get("version").asText());

        adultGateFacts.invalidate(principalId, "b30-adult-v1", NOW);
        policy.restore(fixtures);
        policy.resetReads();
        assertOmitted(principalOk(), "账号条款样本");
        assertEquals(0, policy.bodyReads());
    }

    @Test
    void activeSessionPrecedesBodyReadAndAcceptedOrWritePathsStaySmall() throws Exception {
        JwtAuthenticationToken live = createAuthToken(principalId, sessions.open(
                ServerPrincipalContext.forPlatform(principalId, Set.of("learner")), session.deviceId()).session());

        policy.resetReads();
        policy.revokeSessionOnFirstDescriptor(() -> sessions.revoke(session.sessionId(), "revoke-before-body"));
        mockMvc.perform(get("/api/v1/iam/principal/me").principal(authToken))
                .andExpect(status().isUnauthorized());
        assertEquals(0, policy.bodyReads());

        policy.restore(fixtures);
        mockMvc.perform(get("/api/v1/iam/principal/me").principal(authToken))
                .andExpect(status().isUnauthorized());
        assertEquals(0, policy.bodyReads());

        policy.restore(fixtures);
        mockMvc.perform(get("/api/v1/iam/principal/me")).andExpect(status().isUnauthorized());
        assertEquals(0, policy.bodyReads());

        policy.restore(fixtures);
        policy.makeUnavailable();
        mockMvc.perform(get("/api/v1/iam/principal/me").principal(live))
                .andExpect(status().isServiceUnavailable());
        assertEquals(0, policy.bodyReads());

        policy.restore(fixtures);
        policy.resetReads();
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Idempotency-Key", "idemp-mb004-login-0001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "identifier": "first-consent@example.com",
                                  "password": "ValidPassword123!",
                                  "device": {"deviceType": "WEB", "deviceName": "Chrome Browser", "clientVersion": "1.0.0"}
                                }
                                """))
                .andExpect(status().isOk());
        assertEquals(0, policy.bodyReads());

        policy.resetReads();
        mockMvc.perform(put("/api/v1/iam/consents")
                        .principal(live)
                        .header("Idempotency-Key", "idemp-mb004-consent-bad1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "TERMS",
                                  "version": "mock-mb004-terms-v1",
                                  "decision": "ACCEPTED",
                                  "expectedDocumentDigest": "%s"
                                }
                                """.formatted("0123456789abcdef".repeat(4))))
                .andExpect(status().isConflict());
        assertEquals(0, policy.bodyReads());

        adultGateFacts.approve(principalId, "b30-adult-v1", NOW);
        policy.resetReads();
        MvcResult accepted = accept(live, fixtures.get(0), "idemp-mb004-consent-ok01");
        assertTrue(accepted.getResponse().getHeader("Cache-Control").contains("no-store"));
        JsonNode acceptedData = objectMapper.readTree(accepted.getResponse().getContentAsString()).get("data");
        assertEquals(fixtures.get(0).documentDigest(), acceptedData.get("document").get("digest").asText());
        assertFalse(acceptedData.has("bodyText"));
        assertFalse(accepted.getResponse().getContentAsString().contains("账号条款样本"));
        assertEquals(0, policy.bodyReads());

        policy.resetReads();
        JsonNode incomplete = objectMapper.readTree(principalOk(live)).get("data").get("publishedConsentDocuments");
        assertEquals(3, incomplete.size());
        assertEquals(fixtures.get(0).bodyText(), incomplete.get(0).get("bodyText").asText());
        assertEquals(1, policy.bodyReads());

        policy.resetReads();
        accept(live, fixtures.get(1), "idemp-mb004-consent-ok02");
        accept(live, fixtures.get(2), "idemp-mb004-consent-ok03");
        assertEquals(0, policy.bodyReads());

        policy.resetReads();
        assertOmitted(principalOk(live), "账号条款样本");
        assertEquals(0, policy.bodyReads());

        policy.resetReads();
        String consents = mockMvc.perform(get("/api/v1/iam/consents").principal(live))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(consents.contains("publishedConsentDocuments"));
        assertFalse(consents.contains("bodyText"));
        assertEquals(0, policy.bodyReads());

        String permissions = mockMvc.perform(get("/api/v1/iam/permissions").principal(live))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(permissions.contains("publishedConsentDocuments"));
        assertEquals(0, policy.bodyReads());
    }

    private MvcResult accept(JwtAuthenticationToken token, FixtureDocument fixture, String idempotencyKey)
            throws Exception {
        return mockMvc.perform(put("/api/v1/iam/consents")
                        .principal(token)
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "%s",
                                  "version": "%s",
                                  "decision": "ACCEPTED",
                                  "expectedDocumentDigest": "%s"
                                }
                                """.formatted(fixture.type(), fixture.documentVersion(), fixture.documentDigest())))
                .andExpect(status().isOk())
                .andReturn();
    }

    private String principalOk() throws Exception {
        return principalOk(authToken);
    }

    private String principalOk(JwtAuthenticationToken token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/iam/principal/me").principal(token))
                .andExpect(status().isOk())
                .andReturn();
        assertNotNull(result.getResponse().getHeader("Cache-Control"));
        assertTrue(result.getResponse().getHeader("Cache-Control").contains("no-store"));
        return result.getResponse().getContentAsString();
    }

    private static void assertOmitted(String json, String absentText) {
        assertFalse(json.contains("publishedConsentDocuments"));
        assertFalse(json.contains("\"publishedConsentDocuments\":null"));
        assertFalse(json.contains(absentText));
        assertTrue(json.length() < 16_000);
    }

    private static JwtAuthenticationToken createAuthToken(PrincipalId principalId, SessionRecord userSession) {
        Jwt jwt = Jwt.withTokenValue("jwt-" + UUID.randomUUID())
                .header("alg", "RS256")
                .header("typ", "JWT")
                .subject(principalId.toString())
                .issuedAt(NOW)
                .expiresAt(NOW.plus(Duration.ofMinutes(15)))
                .claim("token_type", "access")
                .claim("tenant_id", userSession.scope().tenantId())
                .claim("owner_id", userSession.scope().owner().toString())
                .claim("session_id", userSession.sessionId().toString())
                .claim("device_id", userSession.deviceId().value())
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("TOKEN_TYPE_access")));
    }

    private List<FixtureDocument> loadFixtures() throws Exception {
        Path cursor = Path.of("").toAbsolutePath();
        Path path = null;
        while (cursor != null) {
            Path candidate = cursor.resolve("apps/mobile/tests/fixtures/mock-consent-publication.json");
            if (Files.isRegularFile(candidate)) {
                path = candidate;
                break;
            }
            cursor = cursor.getParent();
        }
        if (path == null) {
            throw new IllegalStateException("mock-consent-publication.json is not visible from the working directory");
        }
        JsonNode root = objectMapper.readTree(Files.readString(path));
        assertEquals("SYNTHETIC_TEST_ONLY", root.get("fixtureScope").asText());
        List<FixtureDocument> documents = new ArrayList<>();
        for (JsonNode node : root.get("documents")) {
            FixtureDocument document = new FixtureDocument(node.get("type").asText(), node.get("purpose").asText(),
                    node.get("documentVersion").asText(), node.get("documentDigest").asText(),
                    Instant.parse(node.get("publishedAt").asText()), node.get("policyVersion").asText(),
                    node.get("policyRef").asText(), node.get("bodyText").asText());
            assertEquals(document.documentDigest(), sha256Utf8Hex(document.bodyText()));
            assertEquals(NOW, document.publishedAt());
            documents.add(document);
        }
        assertEquals(List.of("TERMS", "PRIVACY", "ADULT_LEARNING"),
                documents.stream().map(FixtureDocument::type).toList());
        return List.copyOf(documents);
    }

    private static List<String> textValues(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.get(field).asText()));
        return values;
    }

    private static String sha256Utf8Hex(String body) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record FixtureDocument(String type, String purpose, String documentVersion, String documentDigest,
                                   Instant publishedAt, String policyVersion, String policyRef, String bodyText) {
    }

    private static final class RecordingConsentPolicy implements ConsentPolicyPort {
        private final Map<ConsentType, ConsentPolicyDescriptor> descriptors = new EnumMap<>(ConsentType.class);
        private final Map<ConsentType, String> bodies = new EnumMap<>(ConsentType.class);
        private int bodyReads;
        private RuntimeException bodyFailure;
        private boolean unavailable;
        private boolean rotateOnRead;
        private Runnable onFirstDescriptor;

        void restore(List<FixtureDocument> fixtures) {
            descriptors.clear();
            bodies.clear();
            for (ConsentType type : ConsentType.values()) {
                descriptors.put(type, ConsentPolicyDescriptor.localCandidate(type));
            }
            for (FixtureDocument fixture : fixtures) {
                ConsentType type = ConsentType.fromWire(fixture.type());
                ConsentPolicyDescriptor.Requirement requirement = type == ConsentType.ADULT_LEARNING
                        ? ConsentPolicyDescriptor.Requirement.LEARNING_REQUIRED
                        : ConsentPolicyDescriptor.Requirement.BASE_REQUIRED;
                Set<String> capabilities = type == ConsentType.ADULT_LEARNING
                        ? Set.of("LEARNING") : Set.of("ACCOUNT", "LEARNING");
                descriptors.put(type, new ConsentPolicyDescriptor(type, fixture.purpose(),
                        new ConsentVersion(fixture.documentVersion()), fixture.documentDigest(), fixture.publishedAt(),
                        new ConsentVersion(fixture.policyVersion()), POLICY_DIGEST, requirement, capabilities,
                        ConsentPolicyDescriptor.WithdrawalEffect.RESTRICT_ALL_LEARNING_ACCESS, true,
                        fixture.policyRef(), "NOT_RUNTIME_VERIFIED"));
                bodies.put(type, fixture.bodyText());
            }
            resetReads();
        }

        void resetReads() {
            bodyReads = 0;
            bodyFailure = null;
            unavailable = false;
            rotateOnRead = false;
            onFirstDescriptor = null;
        }

        void replaceBodyAndDigest(ConsentType type, String body) {
            ConsentPolicyDescriptor current = descriptors.get(type);
            descriptors.put(type, copy(current, current.documentVersion(), sha256Utf8Hex(body)));
            bodies.put(type, body);
        }

        void replaceBodyOnly(ConsentType type, String body) {
            bodies.put(type, body);
        }

        void removeBody(ConsentType type) {
            bodies.remove(type);
        }

        void setStoredDigest(ConsentType type, String digest) {
            ConsentPolicyDescriptor current = descriptors.get(type);
            descriptors.put(type, copy(current, current.documentVersion(), digest));
        }

        void failNextBodyRead(RuntimeException failure) {
            this.bodyFailure = failure;
        }

        void rotateOnRead() {
            this.rotateOnRead = true;
        }

        void revokeSessionOnFirstDescriptor(Runnable hook) {
            this.onFirstDescriptor = hook;
        }

        void makeUnavailable() {
            this.unavailable = true;
        }

        int bodyReads() {
            return bodyReads;
        }

        @Override
        public ConsentPolicyDescriptor descriptor(ConsentType type) {
            if (unavailable) {
                throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE, "iam.consent.version_unavailable");
            }
            if (onFirstDescriptor != null) {
                Runnable hook = onFirstDescriptor;
                onFirstDescriptor = null;
                hook.run();
            }
            ConsentPolicyDescriptor descriptor = descriptors.get(type);
            if (descriptor == null) {
                throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE, "iam.consent.version_unavailable");
            }
            return descriptor;
        }

        @Override
        public Optional<List<ConsentPolicyPort.ActivePublishedDocument>> activePublishedDocuments() {
            bodyReads++;
            if (bodyFailure != null) {
                RuntimeException failure = bodyFailure;
                bodyFailure = null;
                throw failure;
            }
            if (rotateOnRead) {
                rotateOnRead = false;
                ConsentPolicyDescriptor current = descriptors.get(ConsentType.TERMS_OF_SERVICE);
                descriptors.put(ConsentType.TERMS_OF_SERVICE, copy(current, new ConsentVersion("mock-mb004-terms-v2"),
                        sha256Utf8Hex(ROTATED_BODY)));
                bodies.put(ConsentType.TERMS_OF_SERVICE, ROTATED_BODY);
            }
            List<ConsentPolicyPort.ActivePublishedDocument> rows = new ArrayList<>();
            for (Map.Entry<ConsentType, ConsentPolicyDescriptor> entry : descriptors.entrySet()) {
                rows.add(new ConsentPolicyPort.ActivePublishedDocument(entry.getValue(), bodies.get(entry.getKey())));
            }
            return Optional.of(rows);
        }

        private static ConsentPolicyDescriptor copy(ConsentPolicyDescriptor current, ConsentVersion version,
                                                     String digest) {
            return new ConsentPolicyDescriptor(current.type(), current.purpose(), version, digest,
                    current.publishedAt(), current.policyVersion(), current.policyDigest(), current.requirement(),
                    current.capabilities(), current.withdrawalEffect(), current.revokeSessions(), current.policyRef(),
                    current.runtimeStatus());
        }
    }
}
