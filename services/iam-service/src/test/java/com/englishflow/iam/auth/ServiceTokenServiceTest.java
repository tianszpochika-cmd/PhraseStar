package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Service token issuance, with the encoder faked so the test is about the rules rather than about signing.
 *
 * <p>The rules that matter are refusals. An unknown client and a wrong secret must be indistinguishable, a client
 * granted nothing must not receive a token that can only fail later, and the issued claims must be unusable as a
 * user token: a service token that looked like an access token would let an internal caller act as a person.
 */
class ServiceTokenServiceTest {

    /** Captures the claims it is asked to sign, so the test can assert on them. */
    private static final class RecordingEncoder implements JwtEncoder {
        private org.springframework.security.oauth2.jwt.JwtClaimsSet claims;
        private org.springframework.security.oauth2.jwt.JwsHeader header;

        @Override
        public Jwt encode(JwtEncoderParameters parameters) {
            this.claims = parameters.getClaims();
            this.header = parameters.getJwsHeader();
            return new Jwt("signed-value", parameters.getClaims().getIssuedAt(),
                    parameters.getClaims().getExpiresAt(), parameters.getJwsHeader().getHeaders(),
                    parameters.getClaims().getClaims());
        }
    }

    private static IamServiceProperties properties(String clientId, String secret, List<String> permissions,
                                                   Duration ttl) {
        IamServiceProperties properties = new IamServiceProperties();
        IamServiceProperties.ServiceClientProperties client = new IamServiceProperties.ServiceClientProperties();
        client.setSecretDigest(ServiceTokenService.sha256(secret));
        client.setPermissions(permissions);
        client.setTokenTtl(ttl);
        properties.setServiceClients(new java.util.LinkedHashMap<>(java.util.Map.of(clientId, client)));
        return properties;
    }

    private static ServiceTokenService service(IamServiceProperties properties, RecordingEncoder encoder) {
        return new ServiceTokenService(encoder, null, properties,
                java.time.Clock.fixed(Instant.parse("2026-09-14T12:00:00Z"), java.time.ZoneOffset.UTC));
    }

    @Test
    void theRightSecretProducesATokenThatCannotBeUsedAsAUserToken() {
        RecordingEncoder encoder = new RecordingEncoder();
        IamServiceProperties properties = properties("api-gateway", "s3cret", List.of("audit.ingest"),
                Duration.ofMinutes(5));

        ServiceTokenService.IssuedServiceToken issued = service(properties, encoder).issue("api-gateway", "s3cret");

        assertEquals("api-gateway", encoder.claims.getSubject());
        // Subject-bound service identity (the IAM resource server requires
        // service_id to equal the subject); token_type still keeps a service
        // token unmistakable from a person's access token.
        assertEquals("api-gateway", encoder.claims.getClaim("service_id"));
        // The claim name is the same one user tokens carry and the value is not, so every existing authority
        // mapping keeps working while a service token can never be mistaken for a person's.
        assertEquals("service", encoder.claims.getClaim("token_type"));
        assertEquals(List.of("audit.ingest"), encoder.claims.getClaim("permissions"));
        assertEquals("api-gateway", issued.serviceId());
        assertEquals(Duration.ofMinutes(5).toSeconds(), Duration.between(issued.issuedAt(), issued.expiresAt()).toSeconds());
        assertNotEquals(null, issued.jti());
    }

    @Test
    void anUnknownClientAndAWrongSecretAreRefusedTheSameWay() {
        RecordingEncoder encoder = new RecordingEncoder();
        ServiceTokenService service = service(properties("api-gateway", "s3cret", List.of("audit.ingest"),
                Duration.ofMinutes(5)), encoder);

        ServiceTokenService.CredentialsRejected unknown = assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service.issue("nobody", "s3cret"));
        ServiceTokenService.CredentialsRejected wrong = assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service.issue("api-gateway", "wrong"));

        // Telling them apart would say which half of a guess was right.
        assertEquals(unknown.getMessage(), wrong.getMessage());
        assertTrue(unknown.getMessage().contains("not accepted"), unknown.getMessage());
    }

    @Test
    void aClientGrantedNothingIsRefusedRatherThanGivenATokenThatCanOnlyFailLater() {
        RecordingEncoder encoder = new RecordingEncoder();

        IllegalStateException refusal = assertThrows(IllegalStateException.class,
                () -> service(properties("api-gateway", "s3cret", List.of(), Duration.ofMinutes(5)), encoder)
                        .issue("api-gateway", "s3cret"));

        assertTrue(refusal.getMessage().contains("no permissions"), refusal.getMessage());
    }

    @Test
    void theTtlIsShortByDefaultAndNeverLongerThanConfiguredWhenUnset() {
        RecordingEncoder encoder = new RecordingEncoder();
        // A zero TTL is a configuration mistake, not a request for a token that expires immediately.
        ServiceTokenService.IssuedServiceToken issued = service(
                properties("api-gateway", "s3cret", List.of("audit.ingest"), Duration.ZERO), encoder)
                .issue("api-gateway", "s3cret");

        assertEquals(Duration.ofMinutes(5).toSeconds(), Duration.between(issued.issuedAt(), issued.expiresAt()).toSeconds());
        // No refresh token is issued, so a leaked token expires rather than renewing itself. Asserted as "absent"
        // rather than "equal to null": the overload taking two nulls is ambiguous, and the assertion is about the
        // claim not being present at all.
        assertTrue(encoder.claims.getClaims().get("refresh_token") == null,
                String.valueOf(encoder.claims.getClaims().get("refresh_token")));
    }

    @Test
    void noClientConfiguredMeansNoTokenCanBeIssued() {
        RecordingEncoder encoder = new RecordingEncoder();

        assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service(new IamServiceProperties(), encoder).issue("api-gateway", "s3cret"));
    }

    @Test
    void theDigestIsStableAndThePlaintextIsNotTheStoredForm() {
        String digest = ServiceTokenService.sha256("s3cret");

        assertEquals(digest, ServiceTokenService.sha256("s3cret"));
        assertEquals(64, digest.length());
        assertTrue(digest.matches("[0-9a-f]{64}"), digest);
        assertNotEquals("s3cret", digest);
    }

    /**
     * learning-service is registered from the default application.yaml. System properties and the process
     * environment are removed so an ambient digest cannot turn that default into an issued principal.
     */
    @Test
    void anUnsetLearningDigestRegistersNoIssuablePrincipalAndKeepsTheThreeClients() throws Exception {
        EnumerablePropertySource<?> source = defaultApplicationYaml();
        assertEquals(Set.of("api-gateway", "assessment-service", "learner-service", "learning-service"),
                serviceClientIds(source));
        assertEquals("${IAM_SERVICE_CLIENT_GATEWAY_SECRET_DIGEST:}",
                yamlClientValue(source, "api-gateway", "secret-digest"));
        assertEquals("audit.ingest", yamlClientValue(source, "api-gateway", "permissions[0]"));
        assertTrue(yamlClientValue(source, "api-gateway", "permissions[1]") == null);
        assertEquals("${IAM_SERVICE_CLIENT_GATEWAY_TOKEN_TTL:5m}",
                yamlClientValue(source, "api-gateway", "token-ttl"));
        assertEquals("${IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST:}",
                yamlClientValue(source, "assessment-service", "secret-digest"));
        assertEquals("content:answer-rules:read", yamlClientValue(source, "assessment-service", "permissions[0]"));
        assertTrue(yamlClientValue(source, "assessment-service", "permissions[1]") == null);
        assertEquals("${IAM_SERVICE_CLIENT_ASSESSMENT_TOKEN_TTL:5m}",
                yamlClientValue(source, "assessment-service", "token-ttl"));
        assertEquals("${IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST:}",
                yamlClientValue(source, "learner-service", "secret-digest"));
        assertEquals("iam.consent.read", yamlClientValue(source, "learner-service", "permissions[0]"));
        assertTrue(yamlClientValue(source, "learner-service", "permissions[1]") == null);
        assertEquals("${IAM_SERVICE_CLIENT_LEARNER_TOKEN_TTL:5m}",
                yamlClientValue(source, "learner-service", "token-ttl"));
        assertEquals("${IAM_SERVICE_CLIENT_LEARNING_SECRET_DIGEST:}",
                yamlClientValue(source, "learning-service", "secret-digest"));
        assertEquals("assessment:attempt-binding:read",
                yamlClientValue(source, "learning-service", "permissions[0]"));
        assertTrue(yamlClientValue(source, "learning-service", "permissions[1]") == null);
        assertEquals("${IAM_SERVICE_CLIENT_LEARNING_TOKEN_TTL:5m}",
                yamlClientValue(source, "learning-service", "token-ttl"));
        assertEquals(1, grantsOf(source, "assessment:attempt-binding:read"));

        IamServiceProperties defaults = bindDefaultIam(source);
        assertEquals("platform", defaults.getPlatformTenant());
        assertEquals(List.of("audit.ingest"), defaults.getServiceClients().get("api-gateway").getPermissions());
        assertEquals(List.of("content:answer-rules:read"),
                defaults.getServiceClients().get("assessment-service").getPermissions());
        assertEquals(List.of("iam.consent.read"), defaults.getServiceClients().get("learner-service").getPermissions());
        assertEquals(List.of("assessment:attempt-binding:read"),
                defaults.getServiceClients().get("learning-service").getPermissions());
        assertEquals(Duration.ofMinutes(5), defaults.getServiceClients().get("api-gateway").getTokenTtl());
        assertEquals(Duration.ofMinutes(5), defaults.getServiceClients().get("assessment-service").getTokenTtl());
        assertEquals(Duration.ofMinutes(5), defaults.getServiceClients().get("learner-service").getTokenTtl());
        assertEquals(Duration.ofMinutes(5), defaults.getServiceClients().get("learning-service").getTokenTtl());

        RecordingEncoder encoder = new RecordingEncoder();
        ServiceTokenService tokens = service(defaults, encoder);
        for (String clientId : List.of("api-gateway", "assessment-service", "learner-service", "learning-service")) {
            assertTrue(digestUnset(defaults.getServiceClients().get(clientId).getSecretDigest()), clientId);
            assertThrows(ServiceTokenService.CredentialsRejected.class,
                    () -> tokens.issue(clientId, "learning-secret"));
        }
        assertTrue(encoder.claims == null);
    }

    @Test
    void aLearningServiceTokenCarriesOnlyItsOwnAttemptBindingReadScope() throws Exception {
        IamServiceProperties defaults = bindDefaultIam(defaultApplicationYaml());
        assertTrue(digestUnset(defaults.getServiceClients().get("learning-service").getSecretDigest()));
        String secret = "learning-secret";
        defaults.getServiceClients().get("learning-service")
                .setSecretDigest(ServiceTokenService.sha256(secret));

        RecordingEncoder encoder = new RecordingEncoder();
        ServiceTokenService tokens = service(defaults, encoder);
        ServiceTokenService.IssuedServiceToken issued = tokens.issue("learning-service", secret);

        assertEquals("learning-service", encoder.claims.getSubject());
        assertEquals("learning-service", encoder.claims.getClaim("service_id"));
        assertEquals("learning-service", encoder.claims.getClaim("client_id"));
        assertEquals("service", encoder.claims.getClaim("token_type"));
        assertEquals("platform", encoder.claims.getClaim("tenant_id"));
        assertEquals(List.of(), encoder.claims.getClaim("roles"));
        assertEquals(List.of("assessment:attempt-binding:read"), encoder.claims.getClaim("permissions"));
        assertEquals("assessment:attempt-binding:read", encoder.claims.getClaim("scope"));
        // getClaim() is generic; String.valueOf selects valueOf(char[]) and casts the String claim.
        String scope = encoder.claims.getClaimAsString("scope");
        assertEquals(List.of("assessment:attempt-binding:read"), List.of(scope.split(" ")));
        assertEquals(List.of("yuxuexing-api"), encoder.claims.getAudience());
        String issuer = encoder.claims.getClaimAsString("iss");
        assertEquals("http://127.0.0.1:18087", issuer);
        assertEquals("JWT", String.valueOf(encoder.header.getHeaders().get("typ")));
        assertEquals("RS256", String.valueOf(encoder.header.getHeaders().get("alg")));
        assertEquals("iam-local-2026-08", String.valueOf(encoder.header.getHeaders().get("kid")));
        assertEquals("learning-service", issued.serviceId());
        assertEquals(List.of("assessment:attempt-binding:read"), issued.permissions());
        assertEquals(Instant.parse("2026-09-14T12:00:00Z"), issued.issuedAt());
        assertEquals(Instant.parse("2026-09-14T12:05:00Z"), issued.expiresAt());
        assertNotEquals(null, issued.jti());
        assertTrue(encoder.claims.getClaims().get("refresh_token") == null);
        assertTrue(encoder.claims.getClaims().get("session_id") == null);
        assertTrue(encoder.claims.getClaims().get("owner_id") == null);
        assertTrue(encoder.claims.getClaims().get("device_id") == null);
        assertTrue(encoder.claims.getClaims().get("amr") == null);
        assertTrue(encoder.claims.getClaims().get("adult_gate") == null);
        assertNotEquals("access", encoder.claims.getClaim("token_type"));
        assertNotEquals("learner-service", encoder.claims.getSubject());
        assertNotEquals(List.of("iam.consent.read"), encoder.claims.getClaim("permissions"));

        assertEquals(List.of("iam.consent.read"), defaults.getServiceClients().get("learner-service").getPermissions());
        assertEquals(List.of("audit.ingest"), defaults.getServiceClients().get("api-gateway").getPermissions());
        assertEquals(List.of("content:answer-rules:read"),
                defaults.getServiceClients().get("assessment-service").getPermissions());
        for (String other : List.of("api-gateway", "assessment-service", "learner-service")) {
            assertTrue(digestUnset(defaults.getServiceClients().get(other).getSecretDigest()), other);
            assertThrows(ServiceTokenService.CredentialsRejected.class, () -> tokens.issue(other, secret));
        }
        assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> tokens.issue("learning-service", "learner-secret"));
        assertEquals("learning-service", encoder.claims.getSubject());
        assertEquals(List.of("assessment:attempt-binding:read"), encoder.claims.getClaim("permissions"));
    }

    private static EnumerablePropertySource<?> defaultApplicationYaml() throws java.io.IOException {
        return (EnumerablePropertySource<?>) new YamlPropertySourceLoader()
                .load("iam", new ClassPathResource("application.yaml"))
                .getFirst();
    }

    /** Binds production defaults. Ambient secrets stay out of the result, matching an unset digest. */
    private static IamServiceProperties bindDefaultIam(EnumerablePropertySource<?> source) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().addFirst(source);
        ConfigurationPropertySources.attach(environment);
        return Binder.get(environment)
                .bind("iam", Bindable.of(IamServiceProperties.class))
                .orElseThrow(() -> new IllegalStateException("default IAM properties were not bound"));
    }

    private static Object yamlClientValue(EnumerablePropertySource<?> source, String clientId, String rest) {
        Object dotted = source.getProperty("iam.service-clients." + clientId + "." + rest);
        if (dotted != null) {
            return dotted;
        }
        return source.getProperty("iam.service-clients[" + clientId + "]." + rest);
    }

    private static Set<String> serviceClientIds(EnumerablePropertySource<?> source) {
        Set<String> ids = new LinkedHashSet<>();
        String root = "iam.service-clients";
        for (String name : source.getPropertyNames()) {
            if (!name.startsWith(root)) {
                continue;
            }
            String rest = name.substring(root.length());
            if (rest.startsWith(".")) {
                rest = rest.substring(1);
                int cut = rest.length();
                int dot = rest.indexOf('.');
                int bracket = rest.indexOf('[');
                if (dot >= 0) {
                    cut = Math.min(cut, dot);
                }
                if (bracket >= 0) {
                    cut = Math.min(cut, bracket);
                }
                if (cut > 0) {
                    ids.add(rest.substring(0, cut));
                }
            } else if (rest.startsWith("[")) {
                int end = rest.indexOf(']');
                if (end > 1) {
                    ids.add(rest.substring(1, end));
                }
            }
        }
        return ids;
    }

    private static int grantsOf(EnumerablePropertySource<?> source, String permission) {
        int grants = 0;
        for (String name : source.getPropertyNames()) {
            if (!permission.equals(source.getProperty(name))) {
                continue;
            }
            grants++;
            assertTrue(name.startsWith("iam.service-clients.learning-service.")
                    || name.startsWith("iam.service-clients[learning-service]"), name);
        }
        return grants;
    }

    private static boolean digestUnset(String digest) {
        return digest == null || digest.isBlank();
    }
}
