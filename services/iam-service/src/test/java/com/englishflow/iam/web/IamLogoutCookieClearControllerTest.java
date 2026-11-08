package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
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
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamLogoutCookieClearControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-09T00:00:00Z");
    private static final String PASSWORD = "ValidPassword123!";

    private IamServiceProperties properties;
    private SessionService sessions;
    private IamAuthenticationController controller;
    private PrincipalId principalId;
    private SessionRecord session;
    private JwtAuthenticationToken authToken;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        properties = new IamServiceProperties();
        properties.getJwt().setIssuer("https://auth.englishflow.test");
        properties.getJwt().setAudience("englishflow-platform");
        properties.getJwt().setEphemeralKeysAllowed(true);
        properties.getJwt().setAccessTokenTtl(Duration.ofMinutes(15));
        properties.getJwt().setRefreshTokenTtl(Duration.ofDays(30));
        properties.getJwt().setRefreshCookieSecure(true);
        properties.getJwt().setRefreshCookieName("yuxuexing_refresh");
        properties.getIdempotency().setReplaySecret("controller-replay-secret-for-idempotency-2026");
        properties.getIdempotency().setFingerprintSecret("controller-fingerprint-secret-for-idempotency-2026");
        properties.setLocalAdultGateEnabled(true);

        InMemoryAuditFactPort audit = new InMemoryAuditFactPort();
        InMemoryRateLimitStore rateLimits = new InMemoryRateLimitStore();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(
                accounts, new BCryptPasswordEncoder(12), audit, clock, properties, rateLimits);
        AccountRecord account = passwords.register("h5-logout@example.com", PASSWORD, ClientAuthorityClaims.none());
        principalId = account.principalId();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principalId, account.roles());

        sessions = new SessionService(new InMemorySessionStore(), audit, clock, properties);
        DeviceService devices = new DeviceService(new InMemoryDeviceRegistry(), audit, clock);
        DeviceId deviceId = new DeviceId(UUID.randomUUID().toString());
        devices.register(context, new DeviceRegistrationCommand(deviceId, "H5", "Mobile H5", ClientAuthorityClaims.none()));
        session = sessions.open(context, deviceId).session();

        InMemoryAdultGateFactStore adultGateFacts = new InMemoryAdultGateFactStore();
        AdultGateService adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions, IamTransactionRunner.direct());
        ConsentPolicyPort consentPolicy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore, consentPolicy, audit, clock, sessions, IamTransactionRunner.direct());
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties,
                sessions, IamTransactionRunner.direct(), rateLimits,
                new InMemoryPasswordResetDelivery(), properties.getIdempotency().getFingerprintSecret());

        JwtSigningKeyProvider keys = new JwtSigningKeyProvider(properties);
        JWKSource<SecurityContext> source = (selector, ctx) -> List.of(keys.signingKey());
        JwtTokenService tokens = new JwtTokenService(new NimbusJwtEncoder(source), keys, properties, clock);
        IdempotencyService idempotency = new IdempotencyService(new InMemoryIdempotencyStore(),
                new ObjectMapper().findAndRegisterModules(),
                IamTransactionRunner.direct(), properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(), Duration.ofHours(24));

        controller = new IamAuthenticationController(properties, passwords,
                passwordResets, tokens, keys, sessions, devices, adultGates, adultGateFacts,
                consents, consentStore, idempotency, clock);
        authToken = createAuthToken(session);
    }

    @Test
    void webCookieCurrentSessionLogoutClearsRefreshCookieAttributes() {
        ResponseEntity<?> response = controller.logout(authToken, null, null, "web-cookie-logout-key-01");
        assertEquals(200, response.getStatusCode().value());
        assertEquals(SessionStatus.REVOKED, sessions.find(session.sessionId()).status());
        assertClearCookie(response, true);
    }

    @Test
    void webCookieCurrentSessionRevokeClearsRefreshCookieAttributes() {
        ResponseEntity<?> response = controller.revoke(
                authToken, session.sessionId().toString(), null, "web-cookie-revoke-key-01");
        assertEquals(200, response.getStatusCode().value());
        assertEquals(SessionStatus.REVOKED, sessions.find(session.sessionId()).status());
        assertClearCookie(response, true);
    }

    @Test
    void webCookieLogoutOmitsSecureWhenRefreshCookieIsNotConfiguredSecure() {
        properties.getJwt().setRefreshCookieSecure(false);
        ResponseEntity<?> response = controller.logout(authToken, null, null, "web-cookie-logout-key-02");
        assertEquals(200, response.getStatusCode().value());
        assertClearCookie(response, false);
    }

    private JwtAuthenticationToken createAuthToken(SessionRecord userSession) {
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

    private static void assertClearCookie(ResponseEntity<?> response, boolean secureConfigured) {
        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(cookies);
        assertEquals(1, cookies.size());
        Map<String, String> attrs = cookieAttributes(cookies.getFirst());
        assertEquals("yuxuexing_refresh", attrs.get("name"));
        assertEquals("", attrs.get("value"));
        assertEquals("/api/v1/auth", attrs.get("Path"));
        assertEquals("0", attrs.get("Max-Age"));
        assertTrue(attrs.containsKey("Expires"), cookies.getFirst());
        Instant expires = ZonedDateTime.parse(attrs.get("Expires"), DateTimeFormatter.RFC_1123_DATE_TIME.withLocale(Locale.US))
                .toInstant();
        assertTrue(expires.isBefore(NOW), attrs.get("Expires"));
        assertTrue(attrs.containsKey("HttpOnly"), cookies.getFirst());
        assertEquals("None", attrs.get("SameSite"));
        assertTrue(attrs.containsKey("Partitioned"), cookies.getFirst());
        if (secureConfigured) {
            assertTrue(attrs.containsKey("Secure"), cookies.getFirst());
        } else {
            assertFalse(attrs.containsKey("Secure"), cookies.getFirst());
        }
    }

    private static Map<String, String> cookieAttributes(String header) {
        String[] parts = header.split(";");
        Map<String, String> attrs = new LinkedHashMap<>();
        String first = parts[0].trim();
        int eq = first.indexOf('=');
        assertTrue(eq >= 0, header);
        attrs.put("name", first.substring(0, eq));
        attrs.put("value", first.substring(eq + 1));
        for (int i = 1; i < parts.length; i++) {
            String part = parts[i].trim();
            int sep = part.indexOf('=');
            if (sep < 0) attrs.put(part, "");
            else attrs.put(part.substring(0, sep), part.substring(sep + 1));
        }
        return attrs;
    }
}
