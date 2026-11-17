package com.nexora.frontend.bff.proxy;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * What crosses the BFF, in each direction, besides the body. Only listed headers pass: cookies, the browser's
 * {@code Authorization}, forwarding headers and anything else are dropped on the way in; {@code Set-Cookie},
 * {@code WWW-Authenticate} and server details are dropped on the way out.
 */
public final class Forwarding {

    /** From the browser to a service. {@code Idempotency-Key} and {@code If-Match} keep their exact value. */
    static final List<String> REQUEST_HEADERS = List.of("Content-Type", "Accept", "If-Match", "Idempotency-Key");

    /** From a service to the browser, for every user. {@code X-Request-Id} is the service's correlation id. */
    static final List<String> RESPONSE_HEADERS = List.of("Content-Type", "ETag", "X-Request-Id",
            "Content-Disposition", "X-Nexora-Completeness", "X-Nexora-Warnings", "X-Nexora-Artifact-Sha256");

    /** D9: identifiers of plans and runs, only for the diagnostics. */
    static final List<String> DIAGNOSTIC_HEADERS = List.of("X-Nexora-Run-Id", "X-Nexora-Report-Plan-Id");

    private static final Pattern SAFE_HEADER_VALUE = Pattern.compile("[\\x20-\\x7E]{1,512}");

    private Forwarding() {
    }

    /** The allowed request headers of the browser, with printable values only. */
    public static Map<String, String> requestHeaders(HttpServletRequest request) {
        Map<String, String> headers = new LinkedHashMap<>();
        for (String name : REQUEST_HEADERS) {
            String value = request.getHeader(name);
            if (value != null && SAFE_HEADER_VALUE.matcher(value).matches()) {
                headers.put(name, value);
            }
        }
        return headers;
    }

    /**
     * The answer of a service as the browser receives it.
     *
     * @param locationFrom a {@code Location} starting with this upstream prefix is rewritten to {@code locationTo};
     *                     any other {@code Location} is dropped
     */
    public static ResponseEntity<byte[]> toBrowser(UpstreamClient.Answer answer, byte[] body, boolean diagnostics,
                                                   Optional<String> locationFrom, String locationTo,
                                                   Map<String, String> extra) {
        HttpHeaders headers = new HttpHeaders();
        copy(answer, RESPONSE_HEADERS, headers);
        if (diagnostics) {
            copy(answer, DIAGNOSTIC_HEADERS, headers);
        }
        String location = answer.header(HttpHeaders.LOCATION);
        if (location != null && locationFrom.isPresent() && location.startsWith(locationFrom.get())) {
            headers.set(HttpHeaders.LOCATION, locationTo + location.substring(locationFrom.get().length()));
        }
        headers.set(HttpHeaders.CACHE_CONTROL, "no-store");
        extra.forEach(headers::set);
        return ResponseEntity.status(answer.status()).headers(headers).body(body);
    }

    private static void copy(UpstreamClient.Answer answer, List<String> names, HttpHeaders to) {
        for (String name : names) {
            String value = answer.header(name);
            if (value != null && SAFE_HEADER_VALUE.matcher(value).matches()) {
                to.set(name, value);
            }
        }
    }

    /** The body of a browser request, or empty when it exceeds {@code limit} bytes. */
    public static Optional<byte[]> body(HttpServletRequest request, int limit) throws IOException {
        if (request.getContentLengthLong() > limit) {
            return Optional.empty();
        }
        try (InputStream in = request.getInputStream()) {
            byte[] body = in.readNBytes(limit + 1);
            return body.length > limit ? Optional.empty() : Optional.of(body);
        }
    }

    /** Methods that change state and carry a body. */
    public static final Set<String> WITH_BODY = Set.of("POST", "PUT", "PATCH");

    /** Maps a failed exchange to the BFF problem the console understands. */
    public static ResponseEntity<byte[]> failure(UpstreamClient.Failure failure, String service) {
        return switch (failure.kind()) {
            case NOT_SENT -> BffProblem.of(503, "bff_upstream_unavailable", service + " could not be reached; "
                    + "the request was not sent.", BffProblem.Outcome.NOT_SENT);
            case TIMEOUT -> BffProblem.of(504, "bff_upstream_timeout", service + " did not answer in time; the "
                    + "request may still have been processed.", BffProblem.Outcome.UNKNOWN);
            case BROKEN -> BffProblem.of(502, "bff_upstream_broken", "The connection to " + service + " broke; the "
                    + "request may have been processed.", BffProblem.Outcome.UNKNOWN);
            case TOO_LARGE -> BffProblem.of(502, "bff_upstream_too_large", "The answer of " + service + " exceeds the "
                    + "configured limit.", BffProblem.Outcome.UNKNOWN);
        };
    }
}
