package com.nexora.frontend.bff.oidc;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;

/**
 * Reads the OIDC metadata of the realm through the <b>backchannel</b> (the Docker network address of Keycloak) and
 * checks that it is coherent with the <b>public issuer</b> the browser and every Nexora service use.
 * <p>
 * Why: in the Docker deployment the public issuer ({@code KEYCLOAK_PUBLIC_URL/realms/nexora}) is fixed by Keycloak
 * ({@code KC_HOSTNAME}) and is what the browser opens, while containers reach Keycloak at {@code http://keycloak:8180}
 * ({@code KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true}): through that address Keycloak answers with the same {@code issuer},
 * browser endpoints on the public origin and backchannel endpoints on the internal one. Spring's standard discovery
 * ({@code issuer-uri}) cannot be used, because it requires fetching the metadata <i>at</i> the issuer URL, which a
 * container may not reach. Nothing is relaxed: the metadata must declare exactly the configured issuer, the browser
 * endpoints must be on the issuer's origin and the backchannel ones on the issuer's or the backchannel's origin;
 * otherwise the BFF refuses to start. The issuer of every ID token is then validated against the same value.
 */
public final class ProviderDiscovery {

    /** A configuration error: retrying cannot fix it. */
    public static final class IncoherentProvider extends IllegalStateException {
        public IncoherentProvider(String message) {
            super(message);
        }
    }

    private final HttpClient http;
    private final Duration timeout;

    public ProviderDiscovery(Duration timeout) {
        this.timeout = Objects.requireNonNull(timeout, "timeout");
        this.http = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER)
                .version(HttpClient.Version.HTTP_1_1).build();
    }

    /**
     * @param issuer      the public issuer, exactly as in the {@code iss} of the tokens
     * @param backchannel the realm URL reachable from the BFF (e.g. {@code http://keycloak:8180/realms/nexora});
     *                    the issuer itself when the BFF can reach it
     * @param attempts    how many times an unreachable provider is retried (Keycloak may still be starting)
     * @param interval    pause between attempts
     */
    public ProviderEndpoints discover(URI issuer, URI backchannel, int attempts, Duration interval) {
        URI metadata = URI.create(withoutTrailingSlash(backchannel.toString()) + "/.well-known/openid-configuration");
        IOException last = null;
        for (int attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
            try {
                return coherent(issuer, backchannel, fetch(metadata));
            } catch (IOException e) {
                last = e;
                pause(interval);
            }
        }
        throw new IllegalStateException("OIDC provider metadata not reachable at " + metadata
                + " (" + (last == null ? "no answer" : last.getClass().getSimpleName()) + ")");
    }

    private JsonNode fetch(URI metadata) throws IOException {
        HttpRequest request = HttpRequest.newBuilder(metadata).timeout(timeout).header("Accept", "application/json")
                .GET().build();
        HttpResponse<byte[]> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted", e);
        }
        if (response.statusCode() != 200) {
            throw new IOException("status " + response.statusCode());
        }
        try {
            return JsonMapper.builder().build().readTree(response.body());
        } catch (RuntimeException e) {
            throw new IncoherentProvider("OIDC provider metadata is not JSON");
        }
    }

    /** The checks, separated from the network for the tests. */
    static ProviderEndpoints coherent(URI issuer, URI backchannel, JsonNode doc) {
        String declared = text(doc, "issuer");
        if (!issuer.toString().equals(declared)) {
            throw new IncoherentProvider("the OIDC provider declares issuer " + declared + " but the console is"
                    + " configured with " + issuer + " (NEXORA_KEYCLOAK_ISSUER must be KEYCLOAK_PUBLIC_URL/realms/<realm>)");
        }
        URI authorization = endpoint(doc, "authorization_endpoint", issuer, null);
        URI endSession = doc.has("end_session_endpoint") ? endpoint(doc, "end_session_endpoint", issuer, null) : null;
        URI token = endpoint(doc, "token_endpoint", issuer, backchannel);
        URI jwks = endpoint(doc, "jwks_uri", issuer, backchannel);
        URI userInfo = endpoint(doc, "userinfo_endpoint", issuer, backchannel);
        return new ProviderEndpoints(issuer, authorization, token, jwks, userInfo, endSession);
    }

    private static URI endpoint(JsonNode doc, String name, URI issuer, URI backchannel) {
        String value = text(doc, name);
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            throw new IncoherentProvider("invalid " + name);
        }
        boolean onIssuer = sameOrigin(uri, issuer);
        boolean onBackchannel = backchannel != null && sameOrigin(uri, backchannel);
        if (!onIssuer && !onBackchannel) {
            throw new IncoherentProvider(name + " " + uri + " is on neither the issuer's origin"
                    + (backchannel == null ? "" : " nor the backchannel's origin")
                    + (backchannel == null ? " (the browser must reach it)" : ""));
        }
        return uri;
    }

    private static String text(JsonNode doc, String name) {
        JsonNode node = doc == null ? null : doc.get(name);
        if (node == null || !node.isString() || node.asString().isBlank()) {
            throw new IncoherentProvider("OIDC provider metadata without " + name);
        }
        return node.asString();
    }

    static boolean sameOrigin(URI a, URI b) {
        return a.getScheme() != null && a.getHost() != null
                && a.getScheme().toLowerCase(Locale.ROOT).equals(String.valueOf(b.getScheme()).toLowerCase(Locale.ROOT))
                && a.getHost().equalsIgnoreCase(b.getHost()) && port(a) == port(b);
    }

    private static int port(URI u) {
        if (u.getPort() != -1) {
            return u.getPort();
        }
        return "https".equalsIgnoreCase(u.getScheme()) ? 443 : 80;
    }

    private static String withoutTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static void pause(Duration interval) {
        try {
            Thread.sleep(interval.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
