package com.nexora.frontend.bff;

import com.nexora.frontend.bff.support.FakeUpstream;
import com.nexora.frontend.bff.support.TestApp;
import com.nexora.frontend.bff.support.Tokens;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * F1 (AD-ASIS-5): the interpretation of the assisted creation through the BFF (Intelligence
 * {@code POST /api/v1/knowledge-requests}, controlled answers): only people who may propose knowledge, only configured
 * sources of their tenant, the person's own token, nothing of the browser's cookies or forwarding headers.
 */
class KnowledgeRequestProxyTest {

    static final String REQUEST = "{\"request\":\"Quiero contar cuántos envíos tiene cada transportista\","
            + "\"language\":\"es\",\"dataSource\":\"demo\"}";

    private FakeUpstream intelligence;
    private MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        intelligence = new FakeUpstream();
        TestApp.intelligence = intelligence.url();
        TestApp.intelligenceTimeout = Duration.ofSeconds(2);
        TestApp.TOKENS.put("editor", Tokens.human("EDITOR"));
        TestApp.TOKENS.put("approver", Tokens.human("APPROVER", "VIEWER"));
        TestApp.TOKENS.put("viewer", Tokens.human("VIEWER", "REPORT_REQUESTER"));
        mvc = TestApp.mvc();
    }

    @AfterEach
    void tearDown() {
        intelligence.close();
    }

    private MvcResult ask(String userName, String body) throws Exception {
        return mvc.perform(post("/bff/api/knowledge-requests").with(user(userName)).with(csrf())
                .contentType("application/json").header("Cookie", "NEXORA_CONSOLE_SESSION=secreto")
                .header("X-Forwarded-For", "10.0.0.1").content(body.getBytes(StandardCharsets.UTF_8))).andReturn();
    }

    @Test
    void anEditorsRequestReachesIntelligenceWithTheirTokenAndTheIntentComesBackUnchanged() throws Exception {
        String intent = "{\"intent\":{\"format\":\"nexora-knowledge-intent/1\"},\"correlationId\":\"c1\"}";
        intelligence.answer(200, Map.of("Content-Type", "application/json", "X-Request-Id", "c1"),
                intent.getBytes(StandardCharsets.UTF_8));
        MvcResult r = ask("editor", REQUEST);
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo(intent);
        FakeUpstream.Received sent = intelligence.received().getFirst();
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/knowledge-requests");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("editor"));
        assertThat(new String(sent.body(), StandardCharsets.UTF_8)).isEqualTo(REQUEST);
        assertThat(sent.header("Cookie")).isNull();
        assertThat(sent.header("X-Forwarded-For")).isNull();
        assertThat(sent.header("Origin")).isNull();
        intelligence.answer(200, Map.of("Content-Type", "application/json"), "{}".getBytes(StandardCharsets.UTF_8));
        assertThat(ask("approver", REQUEST).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void whoCannotProposeKnowledgeOrAnotherSourceIsRefusedBeforeIntelligence() throws Exception {
        MvcResult viewer = ask("viewer", REQUEST);
        assertThat(viewer.getResponse().getStatus()).isEqualTo(403);
        assertThat(viewer.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("bff_forbidden");
        MvcResult other = ask("editor", REQUEST.replace("\"demo\"", "\"other\""));
        assertThat(other.getResponse().getStatus()).isEqualTo(403);
        assertThat(other.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("bff_source_not_configured");
        assertThat(intelligence.received()).isEmpty();
    }

    @Test
    void intelligencesProblemsReachTheConsoleAsTheyAre() throws Exception {
        intelligence.answer(422, Map.of("Content-Type", "application/problem+json"),
                "{\"code\":\"interpretation_failed\"}".getBytes(StandardCharsets.UTF_8));
        MvcResult r = ask("editor", REQUEST);
        assertThat(r.getResponse().getStatus()).isEqualTo(422);
        assertThat(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("interpretation_failed");
    }

    @Test
    void f2ConceptCandidatesFollowExactlyTheSameChecks() throws Exception {
        String match = "{\"match\":{\"format\":\"nexora-concept-match/1\"},\"correlationId\":\"c2\"}";
        intelligence.answer(200, Map.of("Content-Type", "application/json", "X-Request-Id", "c2"),
                match.getBytes(StandardCharsets.UTF_8));
        String request = REQUEST;
        MvcResult r = mvc.perform(post("/bff/api/knowledge-requests/concept-candidates").with(user("editor"))
                .with(csrf()).contentType("application/json").header("Cookie", "NEXORA_CONSOLE_SESSION=secreto")
                .content(request.getBytes(StandardCharsets.UTF_8))).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo(match);
        FakeUpstream.Received sent = intelligence.received().getFirst();
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/knowledge-requests/concept-candidates");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("editor"));
        assertThat(sent.header("Cookie")).isNull();
        // A viewer or another source never reaches Intelligence.
        assertThat(mvc.perform(post("/bff/api/knowledge-requests/concept-candidates").with(user("viewer"))
                .with(csrf()).contentType("application/json").content(request)).andReturn().getResponse()
                .getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/bff/api/knowledge-requests/concept-candidates").with(user("editor"))
                .with(csrf()).contentType("application/json").content(request.replace("\"demo\"", "\"other\"")))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(intelligence.received()).hasSize(1);
    }
}
