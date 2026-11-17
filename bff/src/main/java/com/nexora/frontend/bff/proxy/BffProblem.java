package com.nexora.frontend.bff.proxy;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Errors produced by the BFF itself, in the same shape as the services' problems ({@code status}, {@code code},
 * {@code title}) plus {@code origin: "bff"}, so the console can tell them apart from Semantic's and Intelligence's.
 * Fixed texts only: never a token, a body of a service or an exception message.
 */
public final class BffProblem {

    /** The outcome of a call the BFF could not complete; {@code UNKNOWN} means it may have been processed. */
    public enum Outcome { NOT_SENT, UNKNOWN, REFUSED }

    private BffProblem() {
    }

    public static ResponseEntity<byte[]> of(int status, String code, String title) {
        return of(status, code, title, Outcome.REFUSED);
    }

    public static ResponseEntity<byte[]> of(int status, String code, String title, Outcome outcome) {
        String id = UUID.randomUUID().toString();
        String json = "{\"status\":" + status + ",\"code\":\"" + code + "\",\"title\":\"" + title
                + "\",\"origin\":\"bff\",\"outcome\":\"" + outcome.name() + "\",\"bffRequestId\":\"" + id + "\"}";
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(json.getBytes(StandardCharsets.UTF_8));
    }

    public static ResponseEntity<byte[]> sessionRequired() {
        return of(401, "session_required", "Sign in to continue.");
    }

    /**
     * The 401 of {@code /bff/session} with the reason the session is not usable ({@code SessionDiagnostics} codes:
     * fixed words, never a value of the request or the token).
     */
    public static ResponseEntity<byte[]> sessionRequired(String reason) {
        String safe = reason != null && reason.matches("[a-z_]{1,40}") ? reason : "not_signed_in";
        String id = UUID.randomUUID().toString();
        String json = "{\"status\":401,\"code\":\"session_required\",\"reason\":\"" + safe
                + "\",\"title\":\"Sign in to continue.\",\"origin\":\"bff\",\"outcome\":\"REFUSED\","
                + "\"bffRequestId\":\"" + id + "\"}";
        return ResponseEntity.status(401)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(json.getBytes(StandardCharsets.UTF_8));
    }
}
