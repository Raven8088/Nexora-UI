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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * {@code POST /bff/api/report-requests} → Nexora Intelligence {@code POST /api/v1/report-requests}, the synchronous
 * report request of the chat: a question or the answer to a clarification. The body and the {@code Idempotency-Key}
 * travel unchanged; the answer (a clarification, a problem or the Excel file) reaches the console unchanged, except
 * that the ids of plans and runs are only given to users with diagnostics (D9).
 * <p>
 * A timeout or a broken connection after sending is an <b>unknown outcome</b>, never a failure: the console keeps the
 * same key and the user decides whether to ask again (Intelligence answers {@code request_in_progress},
 * {@code request_completed} or {@code request_unresolved} for a key it knows).
 */
@RestController
public class ReportRequestProxyController {

    public static final String PATH = "/bff/api/report-requests";
    static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    static final String ACCEPT = "application/json, application/problem+json, " + XLSX;
    /** D9: the fields of an answer that only the diagnostics show. */
    static final List<String> DIAGNOSTIC_FIELDS = List.of("reportPlanId", "runId", "originalCorrelationId");

    private static final Logger log = LoggerFactory.getLogger(ReportRequestProxyController.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final CurrentUser users;
    private final SourceRegistry sources;
    private final UpstreamClient upstream;
    private final BffProperties properties;

    public ReportRequestProxyController(CurrentUser users, SourceRegistry sources, UpstreamClient upstream,
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
        if (!user.get().permissions().chat()) {
            return BffProblem.of(403, "bff_forbidden", "This user cannot request reports.");
        }
        Optional<byte[]> body = Forwarding.body(request, properties.upstream().maxRequestBytes());
        if (body.isEmpty()) {
            return BffProblem.of(413, "bff_payload_too_large", "The request body is too large.");
        }
        // D7: only a configured source of the user's tenant. Intelligence validates the body and the tenant again.
        Optional<String> alias = dataSource(body.get());
        if (alias.isPresent() && sources.byAlias(alias.get(), user.get().identity().tenant()).isEmpty()) {
            return BffProblem.of(403, "bff_source_not_configured", "This data source is not offered to this user.");
        }
        Map<String, String> headers = new LinkedHashMap<>(Forwarding.requestHeaders(request));
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + user.get().accessToken());
        headers.put(HttpHeaders.ACCEPT, ACCEPT);
        long started = System.nanoTime();
        UpstreamClient.Answer answer;
        try {
            answer = upstream.exchange(new UpstreamClient.Call("POST", URI.create(base() + "/api/v1/report-requests"),
                    headers, body.get(), properties.upstream().intelligenceReadTimeout(),
                    Math.max(properties.upstream().maxResponseBytes(), properties.upstream().maxArtifactBytes())));
        } catch (UpstreamClient.Failure f) {
            log.warn("report request failed: failure={} keyPresent={}", f.kind(),
                    request.getHeader("Idempotency-Key") != null);
            return Forwarding.failure(f, "Nexora Intelligence");
        }
        long elapsed = (System.nanoTime() - started) / 1_000_000;
        boolean diagnostics = user.get().permissions().diagnostics();
        log.info("report request: status={} contentType={} correlationId={} elapsedMs={}", answer.status(),
                answer.header(HttpHeaders.CONTENT_TYPE), answer.header("X-Request-Id"), elapsed);
        byte[] out = answer.body();
        String type = answer.header(HttpHeaders.CONTENT_TYPE);
        if (!diagnostics && type != null && type.contains("json")) {
            out = withoutDiagnosticFields(out);
        }
        Map<String, String> extra = diagnostics ? Map.of("X-Nexora-Bff-Elapsed-Ms", Long.toString(elapsed))
                : Map.of();
        return Forwarding.toBrowser(answer, out, diagnostics, Optional.empty(), "", extra);
    }

    /** The {@code dataSource} of a request body; empty when absent or unreadable (Intelligence answers then). */
    static Optional<String> dataSource(byte[] body) {
        try {
            JsonNode node = JSON.readTree(body);
            JsonNode ds = node == null ? null : node.get("dataSource");
            return ds != null && ds.isString() ? Optional.of(ds.asString()) : Optional.empty();
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    /** D9: removes the ids of plans and runs from a JSON answer; anything unreadable is passed unchanged. */
    static byte[] withoutDiagnosticFields(byte[] json) {
        try {
            JsonNode node = JSON.readTree(json);
            if (node instanceof ObjectNode object) {
                boolean changed = false;
                for (String field : DIAGNOSTIC_FIELDS) {
                    changed |= object.remove(field) != null;
                }
                return changed ? JSON.writeValueAsString(object).getBytes(StandardCharsets.UTF_8) : json;
            }
            return json;
        } catch (RuntimeException e) {
            return json;
        }
    }

    private String base() {
        String b = properties.intelligenceUrl().toString();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }
}
