package com.nexora.frontend.bff.security;

import java.util.Set;

/**
 * What the console offers to a user, derived from the roles of its token with the role model of the services
 * (Semantic {@code Role}, Intelligence {@code REPORT_REQUESTER}). It hides screens and actions; it never replaces the
 * checks of Semantic and Intelligence, which receive the same token.
 *
 * @param chat         report requests (Intelligence: {@code REPORT_REQUESTER})
 * @param catalogRead  the dictionary (Semantic {@code semantic:catalog:read})
 * @param proposalWrite create and edit drafts, review suggestions ({@code semantic:proposal:write})
 * @param approve      approve and deactivate definitions ({@code semantic:proposal:approve})
 * @param audit        the audit history ({@code semantic:audit:read})
 * @param diagnostics  D9: the administrative diagnostics of the chat (BFF policy, enforced by the BFF too)
 */
public record Permissions(boolean chat, boolean catalogRead, boolean proposalWrite, boolean approve, boolean audit,
                          boolean diagnostics) {

    static final Set<String> CATALOG_READ = Set.of("VIEWER", "EDITOR", "APPROVER", "STEWARD", "AUDITOR",
            "REPORTS_CLIENT", "AI_AGENT");
    static final Set<String> PROPOSAL_WRITE = Set.of("EDITOR", "APPROVER", "AI_AGENT");
    static final Set<String> APPROVE = Set.of("APPROVER");
    static final Set<String> AUDIT = Set.of("AUDITOR");
    static final Set<String> CHAT = Set.of("REPORT_REQUESTER");

    /**
     * Only people use the console: an identity whose {@code principal_type} is present and not HUMAN gets nothing
     * (Semantic and Intelligence refuse those tokens for these operations anyway).
     */
    public static Permissions of(UserIdentity user, Set<String> diagnosticRoles) {
        if (user.principalType().isPresent() && !"HUMAN".equals(user.principalType().get())) {
            return new Permissions(false, false, false, false, false, false);
        }
        boolean hasTenant = user.tenant().isPresent();
        return new Permissions(
                hasTenant && user.hasAnyRole(CHAT),
                hasTenant && user.hasAnyRole(CATALOG_READ),
                hasTenant && user.hasAnyRole(PROPOSAL_WRITE),
                hasTenant && user.hasAnyRole(APPROVE),
                hasTenant && user.hasAnyRole(AUDIT),
                !diagnosticRoles.isEmpty() && user.hasAnyRole(diagnosticRoles));
    }
}
