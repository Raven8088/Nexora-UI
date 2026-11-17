package com.nexora.frontend.bff;

import com.nexora.frontend.bff.security.SecurityRules;
import com.nexora.frontend.bff.support.TestApp;
import com.nexora.frontend.bff.support.Tokens;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Authentication, CSRF, headers and session endpoints of the BFF (the same rules as production). */
class SecurityRulesTest {

    private MockMvc mvc;

    private static tools.jackson.databind.JsonNode json(org.springframework.test.web.servlet.MvcResult r)
            throws Exception {
        return tools.jackson.databind.json.JsonMapper.builder().build()
                .readTree(r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    @BeforeEach
    void setUp() {
        TestApp.TOKENS.put("ana", Tokens.human("REPORT_REQUESTER", "VIEWER", "EDITOR"));
        TestApp.TOKENS.put("admin", Tokens.human("REPORT_REQUESTER", "APPROVER", "AUDITOR", "PLATFORM_ADMIN"));
        mvc = TestApp.mvc();
    }

    @Test
    void theApiNeedsASessionAndAnswersJson401() throws Exception {
        assertThat(json(mvc.perform(get("/bff/session")).andExpect(status().isUnauthorized()).andReturn())
                .get("code").asString()).isEqualTo("session_required");
        mvc.perform(get("/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE + "/definitions"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/bff/health")).andExpect(status().isOk());
    }

    @Test
    void theSessionSaysWhyItIsNotUsableWithoutRevealingAnything() throws Exception {
        // Not signed in: the entry point's 401.
        assertThat(json(mvc.perform(get("/bff/session")).andReturn()).get("reason").asString())
                .isEqualTo("not_signed_in");
        // Signed in with an access token without sub (client scope nexora-semantic missing as a default scope).
        String payload = "{\"tenant\":\"" + Tokens.TENANT + "\",\"principal_type\":\"HUMAN\","
                + "\"roles\":[\"EDITOR\"]}";
        TestApp.TOKENS.put("nosub", "e30." + java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)) + ".c2ln");
        TestApp.TOKENS.put("garbage", "not-a-jwt");
        var noSub = mvc.perform(get("/bff/session").with(user("nosub"))).andExpect(status().isUnauthorized())
                .andReturn();
        assertThat(json(noSub).get("code").asString()).isEqualTo("session_required");
        assertThat(json(noSub).get("reason").asString()).isEqualTo("access_token_without_subject");
        assertThat(noSub.getResponse().getContentAsString()).doesNotContain(Tokens.TENANT).doesNotContain("e30.");
        assertThat(json(mvc.perform(get("/bff/session").with(user("garbage"))).andReturn()).get("reason")
                .asString()).isEqualTo("access_token_unreadable");
    }

    @Test
    void everyStateChangingCallNeedsTheCsrfToken() throws Exception {
        mvc.perform(post("/bff/api/report-requests").with(user("ana")).contentType("application/json")
                .content("{}")).andExpect(status().isForbidden());
        mvc.perform(post("/bff/logout").with(user("ana"))).andExpect(status().isForbidden());
        mvc.perform(post("/bff/logout").with(user("ana")).with(csrf())).andExpect(status().isOk());
    }

    /** Separate MockMvc: spring-security-test's csrf() replaces the token repository of the filter it touches. */
    @Test
    void theCsrfTokenCookieIsIssuedForTheSpa() throws Exception {
        var result = TestApp.mvc().perform(get("/bff/session").with(user("ana"))).andExpect(status().isOk())
                .andReturn();
        assertThat(result.getResponse().getCookie("XSRF-TOKEN")).isNotNull();
        assertThat(result.getResponse().getCookie("XSRF-TOKEN").isHttpOnly()).isFalse();
    }

    @Test
    void securityHeadersAreSet() throws Exception {
        var r = mvc.perform(get("/bff/health")).andReturn().getResponse();
        assertThat(r.getHeader("Content-Security-Policy")).isEqualTo(SecurityRules.CONTENT_SECURITY_POLICY);
        assertThat(r.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(r.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(r.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
    }

    @Test
    void theSessionTellsWhatTheConsoleOffersAndOnlyTheSourcesOfTheTenant() throws Exception {
        var result = mvc.perform(get("/bff/session").with(user("ana"))).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getHeader("Cache-Control")).isEqualTo("no-store");
        var session = json(result);
        assertThat(session.get("name").asString()).isEqualTo("Ana Prueba");
        assertThat(session.get("tenant").asString()).isEqualTo(Tokens.TENANT);
        assertThat(session.get("permissions").get("chat").asBoolean()).isTrue();
        assertThat(session.get("permissions").get("proposalWrite").asBoolean()).isTrue();
        assertThat(session.get("permissions").get("approve").asBoolean()).isFalse();
        assertThat(session.get("permissions").get("diagnostics").asBoolean()).isFalse();
        assertThat(session.get("sources").size()).isEqualTo(1);
        assertThat(session.get("sources").get(0).get("alias").asString()).isEqualTo("demo");
        assertThat(session.has("accessToken")).isFalse();
        // B1: the token subject, to recognise the user's own changes (Semantic records the same identifier)
        assertThat(session.get("subject").asString()).isEqualTo("subject-ana");
        String body = mvc.perform(get("/bff/session").with(user("admin"))).andReturn().getResponse()
                .getContentAsString();
        assertThat(body).contains("\"diagnostics\":true").doesNotContain(TestApp.TOKENS.get("admin"));
    }

    @Test
    void logoutEndsTheSessionAndReturnsTheIdentityProviderUrl() throws Exception {
        org.springframework.mock.web.MockHttpSession session = new org.springframework.mock.web.MockHttpSession();
        String body = mvc.perform(post("/bff/logout").session(session).with(user("ana")).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).contains("\"logoutUrl\":\"https://idp.example/logout");
        assertThat(session.isInvalid()).isTrue();
    }
}
