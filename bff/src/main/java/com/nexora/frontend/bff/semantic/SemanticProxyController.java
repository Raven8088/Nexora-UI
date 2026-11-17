package com.nexora.frontend.bff.semantic;

import com.nexora.frontend.bff.config.BffProperties;
import com.nexora.frontend.bff.proxy.BffProblem;
import com.nexora.frontend.bff.proxy.Forwarding;
import com.nexora.frontend.bff.proxy.UpstreamClient;
import com.nexora.frontend.bff.security.CurrentUser;
import com.nexora.frontend.bff.sources.SourceRegistry;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * {@code /bff/api/semantic/**} → Nexora Semantic {@code /api/v1/**}, for the allowlisted operations of
 * {@link SemanticRoutes} only, with the user's own access token. Semantic keeps every decision (permissions, tenant,
 * states, versions): its answers, including its errors and {@code ETag}s, reach the console unchanged.
 */
@RestController
public class SemanticProxyController {

    public static final String PREFIX = "/bff/api/semantic/";
    private static final Logger log = LoggerFactory.getLogger(SemanticProxyController.class);

    private final CurrentUser users;
    private final SourceRegistry sources;
    private final UpstreamClient upstream;
    private final BffProperties properties;

    public SemanticProxyController(CurrentUser users, SourceRegistry sources, UpstreamClient upstream,
                                   BffProperties properties) {
        this.users = users;
        this.sources = sources;
        this.upstream = upstream;
        this.properties = properties;
    }

    @RequestMapping(PREFIX + "**")
    public ResponseEntity<byte[]> proxy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Optional<CurrentUser.Context> user = users.of(request, response);
        if (user.isEmpty()) {
            return BffProblem.sessionRequired();
        }
        if (!user.get().permissions().catalogRead()) {
            return BffProblem.of(403, "bff_forbidden", "This user cannot use the semantic dictionary.");
        }
        String path = request.getRequestURI().substring(request.getContextPath().length() + PREFIX.length());
        Optional<SemanticRoutes.Match> match = SemanticRoutes.match(request.getMethod(), path);
        if (match.isEmpty() || !SemanticRoutes.safeQuery(request.getQueryString())) {
            return BffProblem.of(404, "bff_route_not_allowed", "This operation is not available in the console.");
        }
        if (match.get().dataSourceId().isPresent() && sources.byDataSourceId(match.get().dataSourceId().get(),
                user.get().identity().tenant()).isEmpty()) {
            return BffProblem.of(403, "bff_source_not_configured", "This data source is not offered to this user.");
        }
        byte[] body = null;
        if (Forwarding.WITH_BODY.contains(request.getMethod())) {
            Optional<byte[]> read = Forwarding.body(request, properties.upstream().maxRequestBytes());
            if (read.isEmpty()) {
                return BffProblem.of(413, "bff_payload_too_large", "The request body is too large.");
            }
            body = read.get();
        }
        if (SemanticRoutes.acceptsSuggestion(match.get()) && !SemanticRoutes.asksForDraft(body)) {
            // D-B: from the console an accepted suggestion is always a DRAFT; Semantic would otherwise approve it
            // at once for an approver when "result" is missing.
            return BffProblem.of(422, "bff_draft_required", "Accepting a suggestion from the console creates a draft.");
        }
        Map<String, String> headers = new LinkedHashMap<>(Forwarding.requestHeaders(request));
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + user.get().accessToken());
        headers.putIfAbsent(HttpHeaders.ACCEPT, "application/json");
        URI uri = URI.create(base() + "/api/v1/" + path
                + (request.getQueryString() == null ? "" : "?" + request.getQueryString()));
        UpstreamClient.Answer answer;
        try {
            answer = upstream.exchange(new UpstreamClient.Call(request.getMethod(), uri, headers, body,
                    properties.upstream().semanticReadTimeout(), properties.upstream().maxResponseBytes()));
        } catch (UpstreamClient.Failure f) {
            log.warn("semantic call failed: method={} route={} failure={}", request.getMethod(),
                    routeOf(path), f.kind());
            return Forwarding.failure(f, "Nexora Semantic");
        }
        log.info("semantic call: method={} route={} status={} correlationId={}", request.getMethod(), routeOf(path),
                answer.status(), answer.header("X-Request-Id"));
        return Forwarding.toBrowser(answer, answer.body(), false, Optional.of("/api/v1/"), PREFIX, Map.of());
    }

    private String base() {
        String b = properties.semanticUrl().toString();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }

    /** The route without ids, for logs. */
    static String routeOf(String path) {
        return path.replaceAll("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "{id}");
    }
}
