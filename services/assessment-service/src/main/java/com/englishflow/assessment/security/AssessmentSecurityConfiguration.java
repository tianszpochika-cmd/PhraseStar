package com.englishflow.assessment.security;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import tools.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.server.PathContainer;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Assessment service PEP boundary: self-owned JWT verification plus owner/tenant domain checks.
 * The root chain accepts access tokens only. The ordered binding chain is the one workload exception.
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
@EnableConfigurationProperties(AssessmentResourceServerSecurityProperties.class)
public class AssessmentSecurityConfiguration {

    static final String ATTEMPT_BINDING_PERMISSION = "assessment:attempt-binding:read";
    private static final String LEARNING_SERVICE_ID = "learning-service";
    private static final String PLATFORM_TENANT = "platform";
    private static final RequestMatcher ATTEMPT_BINDING_POST = new AttemptBindingPost();

    @Bean

    PdpPort pdpPort() {

        // No dynamic PDP is provisioned in Phase 1 service slices yet; the fail-closed adapter

        // keeps every future dynamic-fact consultation deny-by-default.

        return new UnavailablePdpPort();

    }


    @Bean

    FailClosedPep failClosedPep(PdpPort pdpPort) {

        return new FailClosedPep(pdpPort, java.time.Clock.systemUTC());

    }


    @Bean

    Object pdpActivationGuard(PdpPort pdpPort,

            @Value("${security.pep.dynamic-facts-required:false}") boolean dynamicFactsRequired) {

        PdpActivationGuard.requireProvisioned(dynamicFactsRequired, pdpPort);

        return new Object();

    }


    @Bean
    AssessmentClientAuthorityHeaderFilter assessmentClientAuthorityHeaderFilter() {
        return new AssessmentClientAuthorityHeaderFilter();
    }

    @Bean
    AssessmentJwtAuthenticationConverter assessmentJwtAuthenticationConverter() {
        return new AssessmentJwtAuthenticationConverter();
    }

    @Bean
    @ConditionalOnProperty(
            prefix = "security.resource-server",
            name = "enabled",
            havingValue = "true")
    JwtDecoder verifiedJwtDecoder(AssessmentResourceServerSecurityProperties properties) {
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(properties.getJwkSetUri(), java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(properties.getIssuerUri(), properties.getAudience());
        decoder.setJwtValidator(validator);
        return decoder;
    }

    /**
     * Exact POST /internal/v1/assessment/attempts/{attemptId}/binding. This decoder is not a bean:
     * {@link #verifiedJwtDecoder} stays {@code token_type=access}, and a second {@link JwtDecoder}
     * bean would make the root chain's provider ambiguous. A correct access or other-service JWT
     * authenticates and is then forbidden. Only the learning-service workload is authorized.
     * No owner reader is registered; the root chain still holds every other route.
     */
    @Bean
    @Order(0)
    SecurityFilterChain attemptBindingWorkloadSecurityFilterChain(
            HttpSecurity http,
            AssessmentResourceServerSecurityProperties properties,
            AssessmentClientAuthorityHeaderFilter authorityHeaderFilter,
            ObjectMapper objectMapper) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                write(objectMapper, response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                write(objectMapper, response, 403, "FORBIDDEN", "access denied");

        http.securityMatcher(ATTEMPT_BINDING_POST)
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> {
                    if (properties.isEnabled()) auth.anyRequest().hasAuthority(ATTEMPT_BINDING_PERMISSION);
                    else auth.anyRequest().denyAll();
                })
                .addFilterBefore(authorityHeaderFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(
                    properties.getJwkSetUri(), java.time.Clock.systemUTC());
            decoder.setJwtValidator(attemptBindingJwtValidator(properties.getIssuerUri(), properties.getAudience()));
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(attemptBindingAuthenticationConverter())));
        }
        return http.build();
    }

    @Bean
    SecurityFilterChain assessmentSecurityFilterChain(
            HttpSecurity http,
            AssessmentResourceServerSecurityProperties properties,
            ObjectProvider<JwtDecoder> decoderProvider,
            AssessmentClientAuthorityHeaderFilter authorityHeaderFilter,
            AssessmentJwtAuthenticationConverter jwtAuthenticationConverter,
            ObjectMapper objectMapper) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                write(objectMapper, response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                write(objectMapper, response, 403, "FORBIDDEN", "access denied");

        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> {
                    // Error forwards must render the honest framework error (400/404/405):
                    // denying them here masks every binding failure as opaque 403.
                    // Error bodies carry no secrets (domain messages exclude payloads;
                    // Boot sanitizes the rest), so permitting the forward is safe.
                    auth.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll();
                    auth.requestMatchers("/actuator/**").permitAll();
                    if (properties.isEnabled()) auth.anyRequest().authenticated();
                    else auth.anyRequest().denyAll();
                })
                .addFilterBefore(authorityHeaderFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("Resource Server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(jwtAuthenticationConverter)));
        }
        return http.build();
    }

    private static OAuth2TokenValidator<Jwt> jwtValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        OAuth2TokenValidator<Jwt> authorityClaims = jwt -> hasValues(jwt.getClaim("permissions"))
                || hasValues(jwt.getClaim("roles"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT authority claims are missing", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(audience),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                algorithm,
                new JwtClaimValidator<String>("token_type", "access"::equals),
                new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank()),
                authorityClaims);
    }

    /**
     * Same enveloped JWKS, RS256, issuer, audience, skew, scope and authority-claim checks as
     * {@link #jwtValidator}. Token type accepts access or service so a correct access JWT is
     * forbidden by authorization instead of rejected as an invalid token. This validator is not
     * installed on {@link #verifiedJwtDecoder}.
     */
    private static OAuth2TokenValidator<Jwt> attemptBindingJwtValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        OAuth2TokenValidator<Jwt> authorityClaims = jwt -> hasValues(jwt.getClaim("permissions"))
                || hasValues(jwt.getClaim("roles"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT authority claims are missing", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(audience),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                algorithm,
                new JwtClaimValidator<String>("token_type", value -> "access".equals(value) || "service".equals(value)),
                new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank()),
                authorityClaims);
    }

    private static Converter<Jwt, AbstractAuthenticationToken> attemptBindingAuthenticationConverter() {
        return AssessmentSecurityConfiguration::attemptBindingAuthentication;
    }

    private static AbstractAuthenticationToken attemptBindingAuthentication(Jwt jwt) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        if (isLearningAttemptBindingWorkload(jwt)) {
            authorities.add(new SimpleGrantedAuthority(ATTEMPT_BINDING_PERMISSION));
        }
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        authentication.setAuthenticated(true);
        return authentication;
    }

    private static boolean isLearningAttemptBindingWorkload(Jwt jwt) {
        if (!"service".equals(jwt.getClaimAsString("token_type"))) return false;
        if (!LEARNING_SERVICE_ID.equals(jwt.getSubject())
                || !LEARNING_SERVICE_ID.equals(jwt.getClaimAsString("service_id"))) return false;
        if (!PLATFORM_TENANT.equals(jwt.getClaimAsString("tenant_id"))) return false;
        if (!(jwt.getClaim("roles") instanceof Collection<?> roles) || !roles.isEmpty()) return false;
        return claimHasPermission(jwt.getClaim("scope")) && claimHasPermission(jwt.getClaim("permissions"));
    }

    private static boolean claimHasPermission(Object claim) {
        for (String value : AssessmentJwtAuthenticationConverter.strings(claim)) {
            for (String token : value.split(" ")) {
                if (ATTEMPT_BINDING_PERMISSION.equals(token)) return true;
            }
        }
        return false;
    }

    /** POST one path segment under attempts, then /binding. No handler mapping is consulted. */
    private static final class AttemptBindingPost implements RequestMatcher {
        private static final PathPattern PATTERN = new PathPatternParser()
                .parse("/internal/v1/assessment/attempts/{attemptId}/binding");

        @Override
        public boolean matches(HttpServletRequest request) {
            if (request == null || !"POST".equals(request.getMethod())) return false;
            String path = request.getServletPath();
            String pathInfo = request.getPathInfo();
            if (pathInfo != null && !pathInfo.isEmpty()) {
                path = (path == null ? "" : path) + pathInfo;
            }
            if (path == null || path.isEmpty() || path.charAt(0) != '/') return false;
            return PATTERN.matches(PathContainer.parsePath(path));
        }
    }

    private static boolean hasValues(Object value) {
        return value instanceof java.util.Collection<?> collection && !collection.isEmpty()
                || value instanceof String text && !text.isBlank();
    }

    private static void write(
            ObjectMapper objectMapper,
            HttpServletResponse response,
            int status,
            String code,
            String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), new ErrorEnvelope(code, message));
    }

    private record ErrorEnvelope(String code, String message) {}
}
