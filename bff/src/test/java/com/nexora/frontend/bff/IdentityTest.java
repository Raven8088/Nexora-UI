package com.nexora.frontend.bff;

import com.nexora.frontend.bff.security.Permissions;
import com.nexora.frontend.bff.security.TokenClaims;
import com.nexora.frontend.bff.security.UserIdentity;
import com.nexora.frontend.bff.support.Tokens;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The permissions the console derives from a token (the services decide again with the same token). */
class IdentityTest {

    private static Permissions of(String token) {
        UserIdentity id = TokenClaims.identity(token, "roles", "tenant", "principal_type");
        return Permissions.of(id, Set.of("PLATFORM_ADMIN"));
    }

    @Test
    void rolesGiveTheMatchingScreensAndActions() {
        assertThat(of(Tokens.human("VIEWER"))).isEqualTo(new Permissions(false, true, false, false, false, false));
        assertThat(of(Tokens.human("EDITOR"))).isEqualTo(new Permissions(false, true, true, false, false, false));
        assertThat(of(Tokens.human("APPROVER"))).isEqualTo(new Permissions(false, true, true, true, false, false));
        assertThat(of(Tokens.human("AUDITOR"))).isEqualTo(new Permissions(false, true, false, false, true, false));
        assertThat(of(Tokens.human("REPORT_REQUESTER")))
                .isEqualTo(new Permissions(true, false, false, false, false, false));
    }

    @Test
    void d9DiagnosticsNeedAnAdministrativeRoleNotJustTheChat() {
        assertThat(of(Tokens.human("REPORT_REQUESTER", "APPROVER")).diagnostics()).isFalse();
        assertThat(of(Tokens.human("REPORT_REQUESTER", "PLATFORM_ADMIN")).diagnostics()).isTrue();
    }

    @Test
    void onlyPeopleOfATenantUseTheConsole() {
        assertThat(of(Tokens.of("svc", Tokens.TENANT, "SERVICE", List.of("APPROVER", "REPORT_REQUESTER"))))
                .isEqualTo(new Permissions(false, false, false, false, false, false));
        assertThat(of(Tokens.of("x", null, "HUMAN", List.of("EDITOR", "REPORT_REQUESTER"))).catalogRead()).isFalse();
    }

    @Test
    void withoutTheProfileScopeTheIdentityAndPermissionsAreComplete() {
        // scope=openid only: no name, preferred_username, given_name or email in the token.
        String payload = "{\"sub\":\"f0c3a1d2-0000-4000-8000-000000000001\",\"tenant\":\"" + Tokens.TENANT
                + "\",\"principal_type\":\"HUMAN\",\"roles\":[\"REPORT_REQUESTER\",\"EDITOR\"]}";
        String token = "e30." + java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)) + ".c2ln";

        UserIdentity id = TokenClaims.identity(token, "roles", "tenant", "principal_type");

        assertThat(id.name()).isEqualTo("f0c3a1d2-0000-4000-8000-000000000001");
        assertThat(id.username()).isEmpty();
        assertThat(id.tenant()).isPresent();
        assertThat(Permissions.of(id, Set.of("PLATFORM_ADMIN")))
                .isEqualTo(new Permissions(true, true, true, false, false, false));
    }

    @Test
    void anUnreadableTokenIsNoIdentity() {
        assertThatThrownBy(() -> TokenClaims.identity("abc", "roles", "tenant", "principal_type"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TokenClaims.identity("a.%%%.c", "roles", "tenant", "principal_type"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
