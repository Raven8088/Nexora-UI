package com.nexora.frontend.bff;

import com.nexora.frontend.bff.proxy.BffProblem;
import com.nexora.frontend.bff.security.SessionDiagnostics;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** The evidence a failed sign-in or an unusable session leaves: error codes and fixed words, nothing secret. */
class SessionDiagnosticsTest {

    @Test
    void aRefusedCallbackIsDescribedByItsOAuth2ErrorOnOneBoundedLine() {
        var invalidIdToken = new OAuth2AuthenticationException(new OAuth2Error("invalid_id_token",
                "The ID Token contains invalid claims: {iss=http://other/realms/nexora}", null));
        assertThat(SessionDiagnostics.describe(invalidIdToken))
                .isEqualTo("invalid_id_token: The ID Token contains invalid claims: {iss=http://other/realms/nexora}");

        var tokenEndpoint = new OAuth2AuthenticationException(new OAuth2Error("invalid_token_response",
                "line one\r\nline two " + "x".repeat(400), null));
        String d = SessionDiagnostics.describe(tokenEndpoint);
        assertThat(d).startsWith("invalid_token_response: line one line two").doesNotContain("\n").endsWith("…");
        assertThat(d.length()).isLessThan(340);

        assertThat(SessionDiagnostics.describe(new OAuth2AuthenticationException("authorization_request_not_found")))
                .isEqualTo("authorization_request_not_found");
        assertThat(SessionDiagnostics.describe(new BadCredentialsException("secret detail")))
                .isEqualTo("badcredentialsexception");
    }

    @Test
    void theReasonOfAnUnusableAccessTokenAndItsSafeRendering() {
        assertThat(SessionDiagnostics.tokenReason(new IllegalArgumentException("no subject")))
                .isEqualTo("access_token_without_subject");
        assertThat(SessionDiagnostics.tokenReason(new IllegalArgumentException("not a JWT")))
                .isEqualTo("access_token_unreadable");
        String body = new String(BffProblem.sessionRequired("no_authorized_client").getBody(), StandardCharsets.UTF_8);
        assertThat(body).contains("\"code\":\"session_required\"").contains("\"reason\":\"no_authorized_client\"");
        String injected = new String(BffProblem.sessionRequired("x\",\"evil\":\"1").getBody(), StandardCharsets.UTF_8);
        assertThat(injected).contains("\"reason\":\"not_signed_in\"").doesNotContain("evil");
    }
}
