package com.englishflow.assessment.security;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;

import tools.jackson.databind.ObjectMapper;

import jakarta.servlet.DispatcherType;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Drives the published filter chains for POST attempt binding. No owner reader is registered.
 * The loopback JWKS is the same enveloped document shape the service decoder already accepts.
 */
class AttemptBindingWorkloadPepTest {

    private static final String ISSUER = "http://iam.test";
    private static final String AUDIENCE = "yuxuexing-api";
    private static final String KEY_ID = "iam-test-key";
    private static final String PERMISSION = "assessment:attempt-binding:read";
    private static final String BINDING = "/internal/v1/assessment/attempts/attempt-1/binding";
    private static final String OTHER_ATTEMPT = "/internal/v1/assessment/attempts/attempt-2/binding";
    private static final String SESSIONS = "/internal/v1/assessment/sessions";
    private static final String SIBLING = "/internal/v1/assessment/attempts/attempt-1/pin";

    private static HttpServer server;
    private static RSAKey signingKey;
    private static RSAKey attackerKey;
    private static AnnotationConfigApplicationContext context;
    private static FilterChainProxy proxy;

    @BeforeAll
    static void startSlice() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        attackerKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        String envelope = "{\"data\":" + new JWKSet(signingKey.toPublicJWK()) + "}";
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jwks", exchange -> {
            byte[] body = envelope.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        context = new AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("pep", Map.of(
                "security.resource-server.enabled", "true",
                "security.resource-server.issuer-uri", ISSUER,
                "security.resource-server.jwk-set-uri",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/jwks",
                "security.resource-server.audience", AUDIENCE)));
        context.register(PepSlice.class);
        context.refresh();
        proxy = context.getBean(FilterChainProxy.class);
    }

    @AfterAll
    static void stopSlice() {
        if (context != null) {
            context.close();
        }
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void bindingPostAdmitsOnlyTheLearningServiceWorkload() throws Exception {
        AssessmentResourceServerSecurityProperties bound =
                context.getBean(AssessmentResourceServerSecurityProperties.class);
        assertTrue(bound.isEnabled(), "resource server properties did not bind");
        assertEquals(ISSUER, bound.getIssuerUri());
        assertEquals(1, context.getBeansOfType(JwtDecoder.class).size(),
                "generic decoder must stay the only JwtDecoder bean");
        assertTrue(context.containsBean("verifiedJwtDecoder"));

        String learning = serviceToken("learning-service", "platform", PERMISSION, PERMISSION,
                List.of(), Instant.now().plusSeconds(300), signingKey);
        String access = accessToken(List.of("assessment.session.read"), "assessment.session.read", List.of("learner"));
        String accessWithPermission = accessToken(List.of(PERMISSION), PERMISSION, List.of("learner"));
        JwtDecoder generic = context.getBean(JwtDecoder.class);
        assertNotNull(generic.decode(access));
        assertThrows(JwtException.class, () -> generic.decode(learning));

        List<SecurityFilterChain> chains = proxy.getFilterChains();
        assertEquals(2, chains.size());
        SecurityFilterChain workload = chains.get(0);
        SecurityFilterChain root = chains.get(1);
        assertTrue(workload.matches(request("POST", BINDING)));
        assertTrue(workload.matches(request("POST", OTHER_ATTEMPT)));
        assertFalse(workload.matches(request("GET", BINDING)));
        assertFalse(workload.matches(request("PUT", BINDING)));
        assertFalse(workload.matches(request("POST", SESSIONS)));
        assertFalse(workload.matches(request("POST", SIBLING)));
        assertFalse(workload.matches(request("POST", BINDING + "/extra")));
        assertFalse(workload.matches(request("POST", BINDING + "/")));
        assertFalse(workload.matches(request("GET", "/actuator/health")));
        assertTrue(root.matches(request("POST", BINDING)));
        assertTrue(root.matches(request("POST", SESSIONS)));

        assertAllowed("learning workload", "POST", BINDING, learning);
        assertAllowed("other attempt id", "POST", OTHER_ATTEMPT, learning);
        assertDenied("valid access", "POST", BINDING, access, 403, "FORBIDDEN");
        assertDenied("access token carrying the permission", "POST", BINDING, accessWithPermission, 403, "FORBIDDEN");
        assertDenied("other service with the permission", "POST", BINDING,
                serviceToken("assessment-service", "platform", PERMISSION, PERMISSION, List.of(),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("gateway service", "POST", BINDING,
                serviceToken("api-gateway", "platform", "audit.ingest", "audit.ingest", List.of(),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("missing permission", "POST", BINDING,
                serviceToken("learning-service", "platform", "assessment.session.read", "assessment.session.read",
                        List.of(), Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("permission only in scope", "POST", BINDING,
                serviceToken("learning-service", "platform", PERMISSION, "assessment.session.read", List.of(),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("permission only in permissions", "POST", BINDING,
                serviceToken("learning-service", "platform", "assessment.session.read", PERMISSION, List.of(),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("wrong tenant", "POST", BINDING,
                serviceToken("learning-service", "other", PERMISSION, PERMISSION, List.of(),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("non-empty roles", "POST", BINDING,
                serviceToken("learning-service", "platform", PERMISSION, PERMISSION, List.of("learner"),
                        Instant.now().plusSeconds(300), signingKey),
                403, "FORBIDDEN");
        assertDenied("service id mismatch", "POST", BINDING, mismatchedServiceToken(), 403, "FORBIDDEN");
        assertDenied("absent token", "POST", BINDING, null, 401, "UNAUTHENTICATED");
        assertDenied("malformed token", "POST", BINDING, "not-a-jwt", 401, "UNAUTHENTICATED");
        assertDenied("bad signature", "POST", BINDING,
                serviceToken("learning-service", "platform", PERMISSION, PERMISSION, List.of(),
                        Instant.now().plusSeconds(300), attackerKey),
                401, "UNAUTHENTICATED");
        assertDenied("expired", "POST", BINDING,
                serviceToken("learning-service", "platform", PERMISSION, PERMISSION, List.of(),
                        Instant.now().minusSeconds(180), signingKey),
                401, "UNAUTHENTICATED");
        assertDenied("refresh token type", "POST", BINDING, refreshToken(), 401, "UNAUTHENTICATED");
        assertDenied("same service on sessions", "POST", SESSIONS, learning, 401, "UNAUTHENTICATED");
        assertDenied("same service on sibling", "POST", SIBLING, learning, 401, "UNAUTHENTICATED");
        assertDenied("same service on other method", "GET", BINDING, learning, 401, "UNAUTHENTICATED");
        assertDenied("same service on extra segment", "POST", BINDING + "/extra", learning, 401, "UNAUTHENTICATED");
        assertAllowed("access token on sessions", "POST", SESSIONS, access);
        assertAllowed("actuator without a token", "GET", "/actuator/health", null);

        MockHttpServletRequest error = request("POST", "/error");
        error.setDispatcherType(DispatcherType.ERROR);
        Outcome errorDispatch = exchange(error, null);
        assertTrue(errorDispatch.reached(), "error dispatch must stay permitted on the root chain");
        assertEquals(200, errorDispatch.status());

        MockHttpServletRequest forged = request("POST", BINDING);
        forged.addHeader("X-Role", "admin");
        Outcome rejectedHeader = exchange(forged, learning);
        assertFalse(rejectedHeader.reached(), "forged authority header");
        assertEquals(403, rejectedHeader.status());
        assertTrue(rejectedHeader.body().contains("UNTRUSTED_SECURITY_FACT"), rejectedHeader.body());
    }

    private static void assertAllowed(String name, String method, String path, String token) throws Exception {
        Outcome outcome = exchange(request(method, path), token);
        assertTrue(outcome.reached(), name);
        assertEquals(200, outcome.status(), name);
        assertEquals("", outcome.body(), name);
    }

    private static void assertDenied(String name, String method, String path, String token, int status, String code)
            throws Exception {
        Outcome outcome = exchange(request(method, path), token);
        assertFalse(outcome.reached(), name);
        assertEquals(status, outcome.status(), name + " body=" + outcome.body());
        assertTrue(outcome.body().contains(code), name + " body=" + outcome.body());
    }

    private static Outcome exchange(MockHttpServletRequest request, String token) throws Exception {
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reached = new AtomicBoolean(false);
        proxy.doFilter(request, response, (servletRequest, servletResponse) -> reached.set(true));
        return new Outcome(response.getStatus(), response.getContentAsString(), reached.get());
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }

    private static String accessToken(List<String> permissions, String scope, List<String> roles) throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("learner-1")
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .issueTime(Date.from(now))
                .notBeforeTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .jwtID("access-jti")
                .claim("token_type", "access")
                .claim("scope", scope)
                .claim("permissions", permissions)
                .claim("roles", roles)
                .claim("tenant_id", "platform")
                .build();
        return sign(claims, signingKey);
    }

    private static String serviceToken(String serviceId, String tenant, String scope, String permission,
            List<String> roles, Instant expiresAt, RSAKey key) throws Exception {
        Instant issuedAt = Instant.now().minusSeconds(30);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(serviceId)
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .issueTime(Date.from(issuedAt))
                .notBeforeTime(Date.from(issuedAt))
                .expirationTime(Date.from(expiresAt))
                .jwtID("service-" + serviceId + "-" + expiresAt.getEpochSecond())
                .claim("token_type", "service")
                .claim("service_id", serviceId)
                .claim("scope", scope)
                .claim("permissions", List.of(permission))
                .claim("roles", roles)
                .claim("tenant_id", tenant)
                .build();
        return sign(claims, key);
    }

    private static String mismatchedServiceToken() throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("learning-service")
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .issueTime(Date.from(now))
                .notBeforeTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .jwtID("mismatch-jti")
                .claim("token_type", "service")
                .claim("service_id", "learner-service")
                .claim("scope", PERMISSION)
                .claim("permissions", List.of(PERMISSION))
                .claim("roles", List.of())
                .claim("tenant_id", "platform")
                .build();
        return sign(claims, signingKey);
    }

    private static String refreshToken() throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("learning-service")
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .issueTime(Date.from(now))
                .notBeforeTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .jwtID("refresh-jti")
                .claim("token_type", "refresh")
                .claim("service_id", "learning-service")
                .claim("scope", PERMISSION)
                .claim("permissions", List.of(PERMISSION))
                .claim("roles", List.of())
                .claim("tenant_id", "platform")
                .build();
        return sign(claims, signingKey);
    }

    private static String sign(JWTClaimsSet claims, RSAKey key) throws Exception {
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY_ID).type(JOSEObjectType.JWT).build(),
                claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private record Outcome(int status, String body, boolean reached) {}

    @Configuration
    @EnableWebSecurity
    @Import(AssessmentSecurityConfiguration.class)
    static class PepSlice {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }
}
