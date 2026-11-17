package com.nexora.frontend.bff.semantic;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The calls to Nexora Semantic the console may make through the BFF: exactly the operations of the dictionary,
 * relationships, suggestions and audit screens (UI-1 contract matrix; relationships added by B3 of the dictionary
 * administration). Anything else (exposure policy, sources, tenants, metadata imports, suggestion runs, report plans,
 * resolutions, the relationship contract for S4…) is not reachable from the browser. Paths are relative to
 * Semantic's {@code /api/v1}.
 */
public final class SemanticRoutes {

    private static final String UUID_RE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    private static final String DS = "data-sources/(" + UUID_RE + ")";

    /** One allowed operation. */
    record Route(String method, Pattern path) {
    }

    /** An allowed call: its data source, when the path has one. */
    public record Match(String method, String path, Optional<UUID> dataSourceId) {
    }

    static final List<Route> ROUTES = List.of(
            // dictionary
            route("GET", DS + "/definitions"),
            route("POST", DS + "/definitions"),
            route("GET", DS + "/definitions/" + UUID_RE),
            route("PUT", DS + "/definitions/" + UUID_RE),
            route("POST", DS + "/definitions/" + UUID_RE + "/approve"),
            route("POST", DS + "/definitions/" + UUID_RE + "/deactivate"),
            // semantic relationships (B3): list, read, create (manual or from a foreign key), edit, approve,
            // deactivate, and the on-demand candidates (nothing is stored by the candidates)
            route("GET", DS + "/relationships"),
            route("POST", DS + "/relationships"),
            route("POST", DS + "/relationships/from-foreign-key"),
            route("GET", DS + "/relationships/" + UUID_RE),
            route("PUT", DS + "/relationships/" + UUID_RE),
            route("POST", DS + "/relationships/" + UUID_RE + "/approve"),
            route("POST", DS + "/relationships/" + UUID_RE + "/deactivate"),
            route("GET", DS + "/relationship-candidates"),
            // physical objects, for the editor (tables and columns by name)
            route("GET", DS + "/objects"),
            route("GET", DS + "/objects/" + UUID_RE),
            // suggestions (concepts, metrics, dimensions, relationships)
            route("GET", DS + "/suggestions"),
            route("GET", DS + "/suggestions/" + UUID_RE),
            route("GET", DS + "/suggestions/" + UUID_RE + "/history"),
            route("POST", DS + "/suggestions/" + UUID_RE + "/accept-definition"),
            // relationship suggestions (B3); the console always sends result=DRAFT (D-B)
            route("POST", DS + "/suggestions/" + UUID_RE + "/accept"),
            route("POST", DS + "/suggestions/" + UUID_RE + "/reject"),
            route("POST", DS + "/suggestions/" + UUID_RE + "/reopen"),
            // audit history (tenant-wide; Semantic filters by the token's tenant)
            route("GET", "audit-events"));

    /** Query parameters are plain values (ids, enums, numbers): nothing that could change the path. */
    private static final Pattern SAFE_QUERY = Pattern.compile("[A-Za-z0-9_=&.\\-]{0,512}");

    private SemanticRoutes() {
    }

    private static Route route(String method, String path) {
        return new Route(method, Pattern.compile(path));
    }

    /** @param path the path after the BFF prefix, without query, never decoded */
    public static Optional<Match> match(String method, String path) {
        if (path == null || path.contains("..") || path.contains("%") || path.contains("//")) {
            return Optional.empty();
        }
        for (Route r : ROUTES) {
            Matcher m = r.path().matcher(path);
            if (r.method().equals(method) && m.matches()) {
                Optional<UUID> ds = m.groupCount() >= 1 && m.group(1) != null
                        ? Optional.of(UUID.fromString(m.group(1))) : Optional.empty();
                return Optional.of(new Match(method, path, ds));
            }
        }
        return Optional.empty();
    }

    public static boolean safeQuery(String query) {
        return query == null || SAFE_QUERY.matcher(query).matches();
    }

    private static final Pattern ACCEPT = Pattern.compile(DS + "/suggestions/" + UUID_RE + "/accept(-definition)?");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    /** Whether the call accepts a suggestion (definition or relationship). */
    public static boolean acceptsSuggestion(Match match) {
        return "POST".equals(match.method()) && ACCEPT.matcher(match.path()).matches();
    }

    /**
     * D-B: the body is a JSON object whose {@code result} is exactly {@code "DRAFT"}. Anything else (missing,
     * {@code APPROVED}, unreadable) is refused by the BFF before Semantic sees it.
     */
    public static boolean asksForDraft(byte[] body) {
        if (body == null || body.length == 0) {
            return false;
        }
        try {
            JsonNode node = JSON.readTree(body);
            JsonNode result = node == null || !node.isObject() ? null : node.get("result");
            return result != null && result.isString() && "DRAFT".equals(result.asString());
        } catch (RuntimeException e) {
            return false;
        }
    }
}
