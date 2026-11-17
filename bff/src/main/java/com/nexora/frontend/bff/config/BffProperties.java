package com.nexora.frontend.bff.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Configuration of the BFF ({@code nexora.bff.*}). Nothing here is a credential: the OIDC client secret is a standard
 * Spring property read from the environment ({@code spring.security.oauth2.client.registration.keycloak.client-secret}).
 *
 * @param semanticUrl     base URL of Nexora Semantic (its {@code /api/v1})
 * @param intelligenceUrl base URL of Nexora Intelligence (its {@code /api/v1}), usually the local edge
 * @param upstream        timeouts and size limits of the calls to the services
 * @param identity        names of the access token claims (the same as Semantic's defaults)
 * @param diagnostics     who may see the administrative diagnostics (D9)
 * @param sources         D7: the data sources offered by the console; a listed source is never an authorization by
 *                        itself, Semantic and Intelligence check every call
 * @param oidc            the identity provider (public issuer and backchannel address, see {@link Oidc})
 */
@Validated
@ConfigurationProperties(prefix = "nexora.bff")
public record BffProperties(@NotNull URI semanticUrl, @NotNull URI intelligenceUrl, @NotNull @Valid Upstream upstream,
                            @NotNull @Valid Identity identity, @NotNull @Valid Diagnostics diagnostics,
                            @NotNull List<@Valid Source> sources, @NotNull @Valid Oidc oidc) {

    public BffProperties {
        sources = List.copyOf(sources);
    }

    /**
     * The identity provider. The client secret is not here: it is read only by the OIDC configuration, from the
     * Docker secret file {@code /run/secrets/nexora_console_client_secret} (or, outside Docker, the environment).
     *
     * @param issuer            public issuer, exactly the {@code iss} of the tokens
     *                          ({@code KEYCLOAK_PUBLIC_URL/realms/nexora}); the browser is sent to its origin
     * @param backchannelUrl    the realm URL the BFF can reach (Docker: {@code http://keycloak:8180/realms/nexora});
     *                          the issuer itself when reachable
     * @param clientId          the confidential client of the console ({@code nexora-console})
     * @param discoveryAttempts how many times the metadata is requested while Keycloak is starting
     * @param discoveryInterval the pause between those attempts
     */
    public record Oidc(@NotNull URI issuer, @NotNull URI backchannelUrl, @NotBlank String clientId,
                       @Min(1) @Max(120) int discoveryAttempts, @NotNull Duration discoveryInterval) {
    }

    /**
     * @param intelligenceReadTimeout a report request is synchronous (interpretation, compilation, run and file); its
     *                                answer may take minutes
     * @param maxRequestBytes         largest body forwarded to a service
     * @param maxResponseBytes        largest JSON answer forwarded to the browser
     * @param maxArtifactBytes        largest Excel file forwarded to the browser
     */
    public record Upstream(@NotNull Duration connectTimeout, @NotNull Duration semanticReadTimeout,
                           @NotNull Duration intelligenceReadTimeout,
                           @Min(1024) @Max(1_048_576) int maxRequestBytes,
                           @Min(1024) @Max(16_777_216) int maxResponseBytes,
                           @Min(1024) @Max(209_715_200) int maxArtifactBytes) {
    }

    /** Claims of the access token, as Nexora Semantic reads them. */
    public record Identity(@NotBlank String rolesClaim, @NotBlank String tenantClaim,
                           @NotBlank String principalTypeClaim) {
    }

    /** @param roles a user with at least one of these roles sees the diagnostics (default {@code PLATFORM_ADMIN}) */
    public record Diagnostics(@NotNull Set<@NotBlank String> roles) {
        public Diagnostics {
            roles = Set.copyOf(roles);
        }
    }

    /**
     * @param alias        the data source alias configured in Nexora Intelligence for report requests
     * @param label        the name shown to the user
     * @param dataSourceId the id of the same data source in Nexora Semantic
     * @param tenantId     its tenant: the source is offered only to users of that tenant
     */
    public record Source(@NotBlank @Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,62}") String alias, @NotBlank String label,
                         @NotNull UUID dataSourceId, @NotNull UUID tenantId) {
    }
}
