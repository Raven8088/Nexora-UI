package com.nexora.frontend.bff.security;

import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Who the user is, as the access token issued to this session says. It is only used by the BFF to offer the right
 * screens and sources and to restrict the diagnostics; every service validates the same token again.
 *
 * @param subject the token subject; sent to the console only to recognise the user's own changes, never displayed
 * @param name    display name ({@code name}, else {@code preferred_username}, else the subject)
 * @param tenant  the tenant claim; absent for a platform administrator without tenant
 * @param roles   the Nexora roles of the token
 */
public record UserIdentity(String subject, String name, Optional<String> username, Optional<UUID> tenant,
                           Set<String> roles, Optional<String> principalType) {

    public UserIdentity {
        Objects.requireNonNull(subject, "subject");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(username, "username");
        Objects.requireNonNull(tenant, "tenant");
        roles = Set.copyOf(roles);
        Objects.requireNonNull(principalType, "principalType");
    }

    public boolean hasAnyRole(Set<String> wanted) {
        return roles.stream().anyMatch(wanted::contains);
    }
}
