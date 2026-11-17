package com.nexora.frontend.bff.security;

import com.nexora.frontend.bff.config.BffProperties;
import com.nexora.frontend.bff.oidc.ProviderDiscovery;
import com.nexora.frontend.bff.oidc.ProviderEndpoints;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Production security: {@link SecurityRules} plus the OIDC login with Keycloak (Authorization Code with PKCE, client
 * {@code nexora-console}, registration id {@code keycloak}). Tokens stay in the server-side session (the authorized
 * client repository of the session); the browser only holds the HttpOnly session cookie and the CSRF cookie.
 * <p>
 * The client registration is built from {@link ProviderDiscovery}: browser endpoints on the public issuer, token, keys
 * and user info through the Docker network, and the issuer of every ID token validated against the public issuer
 * (Spring checks {@code iss} against {@code issuerUri}). The only class, with {@link OidcLogout}, that depends on
 * Spring Security's OAuth2 client.
 */
@Configuration
@EnableWebSecurity
public class OidcSecurityConfig {

    static final String REGISTRATION = "keycloak";
    private static final Logger log = LoggerFactory.getLogger(OidcSecurityConfig.class);

    @Bean
    ProviderEndpoints providerEndpoints(BffProperties properties) {
        BffProperties.Oidc oidc = properties.oidc();
        return new ProviderDiscovery(Duration.ofSeconds(5)).discover(oidc.issuer(), oidc.backchannelUrl(),
                oidc.discoveryAttempts(), oidc.discoveryInterval());
    }

    /**
     * @param secretFile the Docker secret {@code /run/secrets/nexora_console_client_secret}, read by Spring's config
     *                   tree import (application.yml); never logged, never in the image
     * @param secretEnv  outside Docker only: the environment variable
     */
    @Bean
    ClientRegistrationRepository clientRegistrationRepository(
            BffProperties properties, ProviderEndpoints endpoints,
            @Value("${nexora_console_client_secret:}") String secretFile,
            @Value("${NEXORA_CONSOLE_CLIENT_SECRET:}") String secretEnv) {
        String secret = !secretFile.isBlank() ? secretFile.strip() : secretEnv.strip();
        if (secret.isEmpty()) {
            throw new IllegalStateException("the client secret of " + properties.oidc().clientId() + " is missing:"
                    + " Docker secret nexora_console_client_secret (or NEXORA_CONSOLE_CLIENT_SECRET outside Docker)");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("issuer", endpoints.issuer().toString());
        if (endpoints.endSession() != null) {
            metadata.put("end_session_endpoint", endpoints.endSession().toString());
        }
        ClientRegistration registration = ClientRegistration.withRegistrationId(REGISTRATION)
                .clientId(properties.oidc().clientId())
                .clientSecret(secret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                // nexora-semantic and nexora-intelligence are DEFAULT client scopes of nexora-console in Keycloak
                // (docs/03-keycloak-cliente.md): they add the audiences, the tenant and the roles to every token.
                // Only "openid": realm nexora has no "profile" scope (Keycloak: "Invalid scopes: openid profile").
                // Nothing depends on its claims: the display name falls back to preferred_username, then to sub.
                .scope("openid")
                .issuerUri(endpoints.issuer().toString())
                .authorizationUri(endpoints.authorization().toString())
                .tokenUri(endpoints.token().toString())
                .jwkSetUri(endpoints.jwks().toString())
                .userInfoUri(endpoints.userInfo().toString())
                .userNameAttributeName("sub")
                .providerConfigurationMetadata(metadata)
                .clientName("Keycloak")
                .build();
        return new InMemoryClientRegistrationRepository(registration);
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ClientRegistrationRepository registrations)
            throws Exception {
        DefaultOAuth2AuthorizationRequestResolver resolver =
                new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
        // PKCE (S256) also for this confidential client.
        resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
        return SecurityRules.apply(http)
                .oauth2Login(login -> login
                        .authorizationEndpoint(a -> a.authorizationRequestResolver(resolver))
                        .successHandler(loginSucceeded())
                        .failureHandler(loginFailed()))
                .build();
    }

    /** Same behaviour as defaultSuccessUrl("/", true), plus one log line (no identity, token or session id). */
    static SimpleUrlAuthenticationSuccessHandler loginSucceeded() {
        SimpleUrlAuthenticationSuccessHandler handler = new SimpleUrlAuthenticationSuccessHandler("/") {
            @Override
            public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                                Authentication authentication)
                    throws java.io.IOException, jakarta.servlet.ServletException {
                log.info("oidc login: callback accepted, session established (registration={})", REGISTRATION);
                super.onAuthenticationSuccess(request, response, authentication);
            }
        };
        handler.setAlwaysUseDefaultTargetUrl(true);
        return handler;
    }

    /** Same behaviour as failureUrl("/?login=failed"), plus the OAuth2 error in the log (it was silent before). */
    static SimpleUrlAuthenticationFailureHandler loginFailed() {
        return new SimpleUrlAuthenticationFailureHandler("/?login=failed") {
            @Override
            public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                                org.springframework.security.core.AuthenticationException exception)
                    throws java.io.IOException, jakarta.servlet.ServletException {
                log.warn("oidc login: callback refused: {}", SessionDiagnostics.describe(exception));
                super.onAuthenticationFailure(request, response, exception);
            }
        };
    }

    /** Refreshes the access token with the refresh token when it expired. */
    @Bean
    OAuth2AuthorizedClientManager authorizedClientManager(ClientRegistrationRepository registrations,
                                                          OAuth2AuthorizedClientRepository clients) {
        OAuth2AuthorizedClientProvider provider = OAuth2AuthorizedClientProviderBuilder.builder()
                .authorizationCode().refreshToken().build();
        DefaultOAuth2AuthorizedClientManager manager = new DefaultOAuth2AuthorizedClientManager(registrations, clients);
        manager.setAuthorizedClientProvider(provider);
        return manager;
    }

    @Bean
    AccessTokens accessTokens(OAuth2AuthorizedClientManager manager) {
        return (HttpServletRequest request, HttpServletResponse response) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (!(authentication instanceof OAuth2AuthenticationToken)) {
                return Optional.empty();
            }
            try {
                OAuth2AuthorizedClient client = manager.authorize(OAuth2AuthorizeRequest
                        .withClientRegistrationId(REGISTRATION).principal(authentication)
                        .attribute(HttpServletRequest.class.getName(), request)
                        .attribute(HttpServletResponse.class.getName(), response).build());
                if (client == null) {
                    SessionDiagnostics.mark(request, SessionDiagnostics.NO_AUTHORIZED_CLIENT);
                    log.warn("session not usable: reason={}", SessionDiagnostics.NO_AUTHORIZED_CLIENT);
                    return Optional.empty();
                }
                return Optional.of(client.getAccessToken().getTokenValue());
            } catch (OAuth2AuthorizationException e) {
                // No authorized client in the session, or the refresh failed (session ended in Keycloak).
                String reason = e instanceof org.springframework.security.oauth2.client.ClientAuthorizationRequiredException
                        ? SessionDiagnostics.NO_AUTHORIZED_CLIENT : SessionDiagnostics.AUTHORIZATION_FAILED;
                SessionDiagnostics.mark(request, reason);
                log.warn("session not usable: reason={} error={}", reason, e.getError().getErrorCode());
                return Optional.empty();
            }
        };
    }
}
