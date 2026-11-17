package com.nexora.frontend.bff.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

import java.util.Locale;

/**
 * Why a sign-in or a session is not usable, as evidence for operators: a fixed reason code (also returned in the 401
 * body of {@code /bff/session}, so it can be read in the browser's developer tools) and a log line. Never a token,
 * a cookie, a session id, a code or a secret: only OAuth2 error codes, Spring's error descriptions (claim names and
 * values such as the issuer, never a token) and fixed texts.
 */
public final class SessionDiagnostics {

    /** Request attribute holding the reason a signed-in request has no usable session. */
    public static final String REASON = SessionDiagnostics.class.getName() + ".reason";

    /** No signed-in session (no or unknown session cookie, or the sign-in did not complete). */
    public static final String NOT_SIGNED_IN = "not_signed_in";
    /** Signed in, but the session holds no authorized client (tokens) for the registration. */
    public static final String NO_AUTHORIZED_CLIENT = "no_authorized_client";
    /** Signed in, but obtaining or refreshing the access token failed. */
    public static final String AUTHORIZATION_FAILED = "authorization_failed";
    /** The access token is not a readable JWT. */
    public static final String ACCESS_TOKEN_UNREADABLE = "access_token_unreadable";
    /** The access token has no {@code sub}: in realm nexora it comes from client scope nexora-semantic. */
    public static final String ACCESS_TOKEN_WITHOUT_SUBJECT = "access_token_without_subject";

    private static final int MAX_DESCRIPTION = 300;

    private SessionDiagnostics() {
    }

    /** The reason code for an access token that {@link TokenClaims} refused. */
    public static String tokenReason(IllegalArgumentException e) {
        return "no subject".equals(e.getMessage()) ? ACCESS_TOKEN_WITHOUT_SUBJECT : ACCESS_TOKEN_UNREADABLE;
    }

    public static void mark(HttpServletRequest request, String reason) {
        request.setAttribute(REASON, reason);
    }

    public static String reasonOf(HttpServletRequest request) {
        Object r = request.getAttribute(REASON);
        return r instanceof String s ? s : NOT_SIGNED_IN;
    }

    /** A failed sign-in, for the log: the OAuth2 error code and description, bounded and on one line. */
    public static String describe(AuthenticationException e) {
        if (e instanceof OAuth2AuthenticationException oauth) {
            OAuth2Error error = oauth.getError();
            String description = error.getDescription() == null ? "" : error.getDescription();
            return error.getErrorCode() + (description.isEmpty() ? "" : ": " + oneLine(description));
        }
        return e.getClass().getSimpleName().toLowerCase(Locale.ROOT);
    }

    private static String oneLine(String text) {
        String s = text.replaceAll("[\\r\\n\\t]+", " ").strip();
        return s.length() > MAX_DESCRIPTION ? s.substring(0, MAX_DESCRIPTION) + "…" : s;
    }
}
