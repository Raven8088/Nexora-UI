package com.nexora.frontend.bff.sources;

import com.nexora.frontend.bff.config.BffProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * D7: the data sources configured in the BFF. A user only sees, and may only address through the BFF, the sources of
 * its own tenant. Being listed here is not an authorization: Intelligence and Semantic check each call with the
 * user's token (tenant, roles, exposure).
 */
@Component
public class SourceRegistry {

    private final List<BffProperties.Source> sources;

    public SourceRegistry(BffProperties properties) {
        this.sources = properties.sources();
    }

    public List<BffProperties.Source> forTenant(Optional<UUID> tenant) {
        return tenant.map(t -> sources.stream().filter(s -> s.tenantId().equals(t)).toList()).orElse(List.of());
    }

    public Optional<BffProperties.Source> byAlias(String alias, Optional<UUID> tenant) {
        return forTenant(tenant).stream().filter(s -> s.alias().equals(alias)).findFirst();
    }

    public Optional<BffProperties.Source> byDataSourceId(UUID dataSourceId, Optional<UUID> tenant) {
        return forTenant(tenant).stream().filter(s -> s.dataSourceId().equals(dataSourceId)).findFirst();
    }
}
