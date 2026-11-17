package com.nexora.frontend.bff.security;

import com.nexora.frontend.bff.auth.LogoutUrls;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

/**
 * The OIDC RP-initiated logout URL of Keycloak ({@code end_session_endpoint}) for the current session, so that
 * signing out of the console also ends the Keycloak session. Built before the local session is invalidated.
 */
@Component
public class OidcLogout implements LogoutUrls {

    private final ClientRegistrationRepository registrations;

    public OidcLogout(ClientRegistrationRepository registrations) {
        this.registrations = registrations;
    }

    @Override
    public Optional<String> endSession(Authentication authentication, String postLogoutRedirectUri) {
        if (!(authentication instanceof OAuth2AuthenticationToken token)
                || !(token.getPrincipal() instanceof OidcUser user)) {
            return Optional.empty();
        }
        ClientRegistration registration =
                registrations.findByRegistrationId(token.getAuthorizedClientRegistrationId());
        if (registration == null) {
            return Optional.empty();
        }
        Object endpoint = registration.getProviderDetails().getConfigurationMetadata().get("end_session_endpoint");
        if (!(endpoint instanceof String url) || url.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(UriComponentsBuilder.fromUriString(url)
                .queryParam("client_id", registration.getClientId())
                .queryParam("id_token_hint", user.getIdToken().getTokenValue())
                .queryParam("post_logout_redirect_uri", postLogoutRedirectUri)
                .encode().build().toUriString());
    }
}
