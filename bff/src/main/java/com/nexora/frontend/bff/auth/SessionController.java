package com.nexora.frontend.bff.auth;

import com.nexora.frontend.bff.config.BffProperties;
import com.nexora.frontend.bff.proxy.BffProblem;
import com.nexora.frontend.bff.security.CurrentUser;
import com.nexora.frontend.bff.security.SessionDiagnostics;
import com.nexora.frontend.bff.security.Permissions;
import com.nexora.frontend.bff.sources.SourceRegistry;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * The session of the console: who is signed in, what the console offers to it, its data sources (D7); and signing
 * out, which also ends the Keycloak session (RP-initiated logout).
 */
@RestController
public class SessionController {

    /** Nexora roles shown to the user (identity-provider defaults are left out). */
    static final Set<String> NEXORA_ROLES = Set.of("VIEWER", "EDITOR", "APPROVER", "STEWARD", "AUDITOR",
            "REPORT_REQUESTER", "PLATFORM_ADMIN", "REPORT_RUNNER", "REPORTS_TENANCY_ADMIN");

    public record SourceView(String alias, String label, String dataSourceId) {
    }

    /**
     * @param subject the token subject, the same identifier Semantic records as author, editor, approver and audit
     *                actor: the console uses it only to recognise the user's own changes (B1: self-approval notice,
     *                «you» in histories), never to authorize anything and never displayed. It is not a credential.
     */
    public record SessionView(String name, String username, String subject, String tenant, List<String> roles,
                              Permissions permissions, List<SourceView> sources) {
    }

    public record LogoutView(String logoutUrl) {
    }

    private final CurrentUser users;
    private final SourceRegistry sources;
    private final LogoutUrls logoutUrls;

    public SessionController(CurrentUser users, SourceRegistry sources, LogoutUrls logoutUrls) {
        this.users = users;
        this.sources = sources;
        this.logoutUrls = logoutUrls;
    }

    @GetMapping("/bff/session")
    public ResponseEntity<?> session(HttpServletRequest request, HttpServletResponse response) {
        Optional<CurrentUser.Context> user = users.of(request, response);
        if (user.isEmpty()) {
            return BffProblem.sessionRequired(SessionDiagnostics.reasonOf(request));
        }
        var id = user.get().identity();
        List<SourceView> offered = sources.forTenant(id.tenant()).stream()
                .map((BffProperties.Source s) -> new SourceView(s.alias(), s.label(), s.dataSourceId().toString()))
                .toList();
        SessionView view = new SessionView(id.name(), id.username().orElse(null), id.subject(),
                id.tenant().map(Object::toString).orElse(null),
                id.roles().stream().filter(NEXORA_ROLES::contains).sorted().toList(),
                user.get().permissions(), offered);
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(view);
    }

    /** Ends the console session and returns where to end the Keycloak session (CSRF-protected POST). */
    @PostMapping("/bff/logout")
    public ResponseEntity<LogoutView> logout(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String home = ServletUriComponentsBuilder.fromContextPath(request).path("/").build().toUriString();
        String target = authentication == null ? home : logoutUrls.endSession(authentication, home).orElse(home);
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(new LogoutView(target));
    }
}
