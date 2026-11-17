package com.nexora.frontend.bff.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Optional;

/**
 * The access token of the signed-in user, refreshed when needed. Empty when there is no usable session (not signed
 * in, or the refresh failed): the caller answers 401 and the console asks the user to sign in again. The token is used
 * only in the {@code Authorization} header of calls to the services; it is never written to a response or a log.
 */
public interface AccessTokens {

    Optional<String> current(HttpServletRequest request, HttpServletResponse response);
}
