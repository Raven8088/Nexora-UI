package com.nexora.frontend.bff.intelligence;

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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * F1 (AD-ASIS-5): {@code POST /bff/api/knowledge-requests} → Nexora Intelligence {@code POST /api/v1/knowledge-requests},
 * the interpretation of the assisted creation of knowledge. Only for a person who may propose knowledge
 * ({@code EDITOR} or {@code APPROVER}) and only for a configured source of their tenant; the body travels unchanged
 * with the person's own access token, and Intelligence checks token, roles, tenant and source again (and Semantic,
 * which it reads with the same token). The answer ({@code nexora-knowledge-intent/1} or a problem) reaches the console
 * unchanged. Nothing is created by this call: proposals and the confirmation go to Semantic through the allowlist.
 */
@RestController
public class KnowledgeRequestProxyController {

    public static final String PATH = "/bff/api/knowledge-requests";
    static final String ACCEPT = "application/json, application/problem+json";

    private static final Logger log = LoggerFactory.getLogger(KnowledgeRequestProxyController.class);

    private final CurrentUser users;
    private final SourceRegistry sources;
    private final UpstreamClient upstream;
    private final BffProperties properties;

    public KnowledgeRequestProxyController(CurrentUser users, SourceRegistry sources, UpstreamClient upstream,
                                           BffProperties properties) {
        this.users = users;
        this.sources = sources;
        this.upstream = upstream;
        this.properties = properties;
    }

    @PostMapping(PATH)
    public ResponseEntity<byte[]> request(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Optional<CurrentUser.Context> user = users.of(request, response);
        if (user.isEmpty()) {
            return BffProblem.sessionRequired();
        }
        if (!user.get().permissions().proposalWrite()) {
            return BffProblem.of(403, "bff_forbidden", "This user cannot propose knowledge.");
        }
        Optional<byte[]> body = Forwarding.body(request, properties.upstream().maxRequestBytes());
        if (body.isEmpty()) {
            return BffProblem.of(413, "bff_payload_too_large", "The request body is too large.");
        }
        // D7: only a configured source of the user's tenant. Intelligence validates the body and the tenant again.
        Optional<String> alias = ReportRequestProxyController.dataSource(body.get());
        if (alias.isPresent() && sources.byAlias(alias.get(), user.get().identity().tenant()).isEmpty()) {
            return BffProblem.of(403, "bff_source_not_configured", "This data source is not offered to this user.");
        }
        Map<String, String> headers = new LinkedHashMap<>(Forwarding.requestHeaders(request));
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + user.get().accessToken());
        headers.put(HttpHeaders.ACCEPT, ACCEPT);
        long started = System.nanoTime();
        UpstreamClient.Answer answer;
        try {
            answer = upstream.exchange(new UpstreamClient.Call("POST",
                    URI.create(base() + "/api/v1/knowledge-requests"), headers, body.get(),
                    properties.upstream().intelligenceReadTimeout(), properties.upstream().maxResponseBytes()));
        } catch (UpstreamClient.Failure f) {
            log.warn("knowledge request failed: failure={}", f.kind());
            return Forwarding.failure(f, "Nexora Intelligence");
        }
        long elapsed = (System.nanoTime() - started) / 1_000_000;
        log.info("knowledge request: status={} correlationId={} elapsedMs={}", answer.status(),
                answer.header("X-Request-Id"), elapsed);
        return Forwarding.toBrowser(answer, answer.body(), user.get().permissions().diagnostics(), Optional.empty(),
                "", Map.of());
    }

    private String base() {
        String b = properties.intelligenceUrl().toString();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }
}
