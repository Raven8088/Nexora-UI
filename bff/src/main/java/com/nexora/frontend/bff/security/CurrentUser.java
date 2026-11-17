package com.nexora.frontend.bff.security;

import com.nexora.frontend.bff.config.BffProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Optional;

/** The signed-in user of a request: its token, identity and permissions. */
@Component
public class CurrentUser {

    private static final Logger log = LoggerFactory.getLogger(CurrentUser.class);

    /** A user of a request. {@code accessToken} only travels to the services. */
    public record Context(String accessToken, UserIdentity identity, Permissions permissions) {
        public Context {
            Objects.requireNonNull(accessToken, "accessToken");
            Objects.requireNonNull(identity, "identity");
            Objects.requireNonNull(permissions, "permissions");
        }

        @Override
        public String toString() {
            return "Context[identity=" + identity.subject() + ", permissions=" + permissions + "]";
        }
    }

    private final AccessTokens tokens;
    private final BffProperties properties;

    public CurrentUser(AccessTokens tokens, BffProperties properties) {
        this.tokens = tokens;
        this.properties = properties;
    }

    public Optional<Context> of(HttpServletRequest request, HttpServletResponse response) {
        Optional<String> token = tokens.current(request, response);
        if (token.isEmpty()) {
            return Optional.empty();
        }
        UserIdentity identity;
        try {
            BffProperties.Identity names = properties.identity();
            identity = TokenClaims.identity(token.get(), names.rolesClaim(), names.tenantClaim(),
                    names.principalTypeClaim());
        } catch (IllegalArgumentException e) {
            // Evidence for operators (SessionDiagnostics): the reason only, never the token.
            String reason = SessionDiagnostics.tokenReason(e);
            SessionDiagnostics.mark(request, reason);
            log.warn("session not usable: reason={}{}", reason,
                    SessionDiagnostics.ACCESS_TOKEN_WITHOUT_SUBJECT.equals(reason)
                            ? " (the access token has no sub claim: client scope nexora-semantic must be a DEFAULT"
                            + " client scope of the console's client)" : "");
            return Optional.empty();
        }
        return Optional.of(new Context(token.get(), identity,
                Permissions.of(identity, properties.diagnostics().roles())));
    }
}
