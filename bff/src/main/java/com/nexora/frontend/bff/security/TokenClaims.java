package com.nexora.frontend.bff.security;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Reads the claims of the access token that Keycloak issued to this session through the back channel (token
 * endpoint). The signature is not checked here: the token never came from the browser, and the services that act on it
 * verify it. The claims only decide what the console shows and the BFF diagnostics policy.
 */
public final class TokenClaims {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Pattern CANONICAL_UUID =
            Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private TokenClaims() {
    }

    /** @throws IllegalArgumentException when the value is not a JWT with a JSON payload and a subject */
    public static UserIdentity identity(String accessToken, String rolesClaim, String tenantClaim,
                                        String principalTypeClaim) {
        String[] parts = accessToken == null ? new String[0] : accessToken.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("not a JWT");
        }
        JsonNode claims;
        try {
            claims = JSON.readTree(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("unreadable JWT payload");
        }
        String subject = text(claims, "sub").orElseThrow(() -> new IllegalArgumentException("no subject"));
        Optional<String> username = text(claims, "preferred_username");
        String name = text(claims, "name").or(() -> username).orElse(subject);
        Optional<UUID> tenant = text(at(claims, tenantClaim), null)
                .filter(t -> CANONICAL_UUID.matcher(t).matches()).map(UUID::fromString);
        Set<String> roles = new LinkedHashSet<>();
        JsonNode r = at(claims, rolesClaim);
        if (r != null && r.isArray()) {
            r.forEach(n -> {
                if (n.isString()) {
                    roles.add(n.asString());
                }
            });
        } else if (r != null && r.isString()) {
            roles.add(r.asString());
        }
        return new UserIdentity(subject, name, username, tenant, roles, text(at(claims, principalTypeClaim), null));
    }

    /** A dotted name reaches a nested claim ({@code realm_access.roles}), as in Semantic. */
    private static JsonNode at(JsonNode claims, String name) {
        JsonNode node = claims;
        for (String part : name.split("\\.")) {
            if (node == null || !node.isObject()) {
                return null;
            }
            node = node.get(part);
        }
        return node;
    }

    private static Optional<String> text(JsonNode node, String field) {
        JsonNode value = field == null ? node : node == null ? null : node.get(field);
        return value != null && value.isString() && !value.asString().isBlank() ? Optional.of(value.asString())
                : Optional.empty();
    }
}
