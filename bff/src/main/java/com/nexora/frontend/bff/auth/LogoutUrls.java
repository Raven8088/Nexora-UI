package com.nexora.frontend.bff.auth;

import org.springframework.security.core.Authentication;

import java.util.Optional;

/** Where the browser goes to end the identity provider's session after the console's session is closed. */
public interface LogoutUrls {

    Optional<String> endSession(Authentication authentication, String postLogoutRedirectUri);
}
