package com.nexora.frontend.bff;

import com.nexora.frontend.bff.semantic.SemanticRoutes;
import com.nexora.frontend.bff.support.FakeUpstream;
import com.nexora.frontend.bff.support.TestApp;
import com.nexora.frontend.bff.support.Tokens;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** The dictionary's calls to Semantic through the BFF: allowlist, D7, concurrency headers and errors. */
class SemanticProxyTest {

    static final String DEF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    private FakeUpstream semantic;
    private MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        semantic = new FakeUpstream();
        TestApp.semantic = semantic.url();
        TestApp.TOKENS.put("editor", Tokens.human("EDITOR"));
        TestApp.TOKENS.put("requester", Tokens.human("REPORT_REQUESTER"));
        TestApp.TOKENS.put("robot", Tokens.of("svc", Tokens.TENANT, "SERVICE", java.util.List.of("APPROVER")));
        mvc = TestApp.mvc();
    }

    @AfterEach
    void tearDown() {
        semantic.close();
    }

    private String base() {
        return "/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE;
    }

    @Test
    void anAllowedReadIsForwardedWithTheUsersTokenAndItsQuery() throws Exception {
        semantic.answer(200, Map.of("Content-Type", "application/json", "X-Request-Id", "s-1"),
                "{\"items\":[],\"page\":0,\"size\":200,\"totalItems\":0}".getBytes());

        MvcResult r = mvc.perform(get(base() + "/definitions?kind=METRIC&status=DRAFT&page=0&size=200")
                .with(user("editor"))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getHeader("X-Request-Id")).isEqualTo("s-1");
        FakeUpstream.Received sent = semantic.received().getFirst();
        assertThat(sent.method()).isEqualTo("GET");
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/data-sources/" + TestApp.DEMO_SOURCE
                + "/definitions?kind=METRIC&status=DRAFT&page=0&size=200");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("editor"));
    }

    @Test
    void editsCarryIfMatchAndTheEtagAndLocationComeBack() throws Exception {
        semantic.answer(200, Map.of("Content-Type", "application/json", "ETag", "\"4\""), "{\"version\":4}".getBytes())
                .answer(201, Map.of("Content-Type", "application/json", "ETag", "\"0\"", "Location",
                        "/api/v1/data-sources/" + TestApp.DEMO_SOURCE + "/definitions/" + DEF), "{}".getBytes())
                .answer(412, Map.of("Content-Type", "application/json"),
                        "{\"code\":\"PRECONDITION_FAILED\"}".getBytes());

        MvcResult updated = mvc.perform(put(base() + "/definitions/" + DEF).with(user("editor")).with(csrf())
                .header("If-Match", "\"3\"").contentType("application/json").content("{\"name\":\"X\"}")).andReturn();
        MvcResult created = mvc.perform(post(base() + "/definitions").with(user("editor")).with(csrf())
                .contentType("application/json").content("{}")).andReturn();
        MvcResult stale = mvc.perform(post(base() + "/definitions/" + DEF + "/approve").with(user("editor"))
                .with(csrf()).header("If-Match", "\"3\"")).andReturn();

        assertThat(semantic.received().getFirst().header("If-Match")).isEqualTo("\"3\"");
        assertThat(new String(semantic.received().getFirst().body())).isEqualTo("{\"name\":\"X\"}");
        assertThat(updated.getResponse().getHeader("ETag")).isEqualTo("\"4\"");
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        assertThat(created.getResponse().getHeader("Location"))
                .isEqualTo("/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE + "/definitions/" + DEF);
        assertThat(stale.getResponse().getStatus()).isEqualTo(412);
        assertThat(stale.getResponse().getContentAsString()).contains("PRECONDITION_FAILED");
    }

    @Test
    void onlyAllowlistedOperationsOfConfiguredSources() throws Exception {
        String[] refused = {
                "/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE + "/exposure-policy",
                "/bff/api/semantic/admin/tenants",
                "/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE + "/definitions/../../admin/tenants",
                "/bff/api/semantic/data-sources/" + TestApp.DEMO_SOURCE + "/report-plans"};
        for (String path : refused) {
            assertThat(mvc.perform(get(path).with(user("editor"))).andReturn().getResponse().getStatus())
                    .as(path).isIn(400, 404);
        }
        // DELETE does not exist in Semantic and is not offered
        assertThat(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete(base() + "/definitions/" + DEF).with(user("editor")).with(csrf()))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(get("/bff/api/semantic/data-sources/" + TestApp.FOREIGN + "/definitions")
                .with(user("editor"))).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get(base() + "/definitions?kind=METRIC%27").with(user("editor")))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(semantic.received()).isEmpty();
    }

    @Test
    void usersWithoutTheDictionaryOrNonHumanTokensAreRefusedByTheBffToo() throws Exception {
        assertThat(mvc.perform(get(base() + "/definitions").with(user("requester"))).andReturn().getResponse()
                .getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get(base() + "/definitions").with(user("robot"))).andReturn().getResponse()
                .getStatus()).isEqualTo(403);
        assertThat(semantic.received()).isEmpty();
    }

    @Test
    void relationshipsB3AreForwardedExactlyAndNothingElseIsOpened() throws Exception {
        String ds = "data-sources/" + TestApp.DEMO_SOURCE;
        String[][] allowed = {
                {"GET", ds + "/relationships"}, {"POST", ds + "/relationships"},
                {"POST", ds + "/relationships/from-foreign-key"}, {"GET", ds + "/relationships/" + DEF},
                {"PUT", ds + "/relationships/" + DEF}, {"POST", ds + "/relationships/" + DEF + "/approve"},
                {"POST", ds + "/relationships/" + DEF + "/deactivate"}, {"GET", ds + "/relationship-candidates"}};
        for (String[] a : allowed) {
            assertThat(SemanticRoutes.match(a[0], a[1])).as(a[0] + " " + a[1]).isPresent();
        }
        String[][] refused = {
                {"GET", ds + "/relationships/" + DEF + "/contract"}, {"DELETE", ds + "/relationships/" + DEF},
                {"PATCH", ds + "/relationships/" + DEF}, {"POST", ds + "/relationships/" + DEF + "/reject"},
                {"POST", ds + "/suggestion-runs"}, {"GET", ds + "/suggestion-runs"},
                {"GET", ds + "/suggestion-triggers"}, {"POST", ds + "/snapshots"}, {"GET", ds + "/snapshots"},
                {"GET", ds + "/relationships/not-a-uuid"}, {"PUT", ds + "/relationships"}};
        for (String[] r : refused) {
            assertThat(SemanticRoutes.match(r[0], r[1])).as(r[0] + " " + r[1]).isEmpty();
        }

        semantic.answer(200, Map.of("Content-Type", "application/json", "ETag", "\"2\""), "{\"version\":2}".getBytes());
        MvcResult approved = mvc.perform(post(base() + "/relationships/" + DEF + "/approve").with(user("editor"))
                .with(csrf()).header("If-Match", "\"1\"")).andReturn();
        assertThat(approved.getResponse().getStatus()).isEqualTo(200);
        assertThat(approved.getResponse().getHeader("ETag")).isEqualTo("\"2\"");
        FakeUpstream.Received sent = semantic.received().getFirst();
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/data-sources/" + TestApp.DEMO_SOURCE + "/relationships/"
                + DEF + "/approve");
        assertThat(sent.header("If-Match")).isEqualTo("\"1\"");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("editor"));
        // D7: another tenant's source is refused before Semantic, also for relationships
        assertThat(mvc.perform(get("/bff/api/semantic/data-sources/" + TestApp.FOREIGN + "/relationships")
                .with(user("editor"))).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(semantic.received()).hasSize(1);
    }

    @Test
    void f1TheAssistedProposalsAndConfirmationAreForwardedButNeverTheModelsContext() throws Exception {
        String ds = "data-sources/" + TestApp.DEMO_SOURCE;
        assertThat(SemanticRoutes.match("POST", ds + "/knowledge-proposals")).isPresent();
        assertThat(SemanticRoutes.match("POST", ds + "/knowledge-proposals/confirm")).isPresent();
        // The closed catalog with physical column names is only for Intelligence.
        assertThat(SemanticRoutes.match("GET", ds + "/knowledge-context")).isEmpty();
        assertThat(SemanticRoutes.match("GET", ds + "/knowledge-proposals")).isEmpty();
        assertThat(SemanticRoutes.match("PUT", ds + "/knowledge-proposals/confirm")).isEmpty();
        assertThat(SemanticRoutes.match("POST", ds + "/knowledge-proposals/approve")).isEmpty();

        semantic.answer(201, Map.of("Content-Type", "application/json"), "{\"created\":true}".getBytes());
        String body = "{\"intent\":{},\"proposal\":\"" + "a".repeat(64) + "\"}";
        MvcResult saved = mvc.perform(post(base() + "/knowledge-proposals/confirm").with(user("editor"))
                .with(csrf()).contentType("application/json").content(body)).andReturn();
        assertThat(saved.getResponse().getStatus()).isEqualTo(201);
        FakeUpstream.Received sent = semantic.received().getFirst();
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/" + ds + "/knowledge-proposals/confirm");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("editor"));
        assertThat(new String(sent.body(), java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(body);
        // D7: another tenant's source is refused before Semantic.
        assertThat(mvc.perform(post("/bff/api/semantic/data-sources/" + TestApp.FOREIGN + "/knowledge-proposals")
                .with(user("editor")).with(csrf()).contentType("application/json").content("{}")).andReturn()
                .getResponse().getStatus()).isEqualTo(403);
        assertThat(semantic.received()).hasSize(1);
    }

    @Test
    void dBAcceptingASuggestionFromTheConsoleIsAlwaysADraft() throws Exception {
        semantic.answer(200, Map.of("Content-Type", "application/json"), "{}".getBytes())
                .answer(200, Map.of("Content-Type", "application/json"), "{}".getBytes());
        String accept = base() + "/suggestions/" + DEF + "/accept";
        String[] refusedBodies = {
                "{\"name\":\"R\"}", "{\"result\":\"APPROVED\"}", "{\"result\":\"draft\"}", "{\"result\":null}",
                "[\"DRAFT\"]", "not json", ""};
        for (String body : refusedBodies) {
            MvcResult r = mvc.perform(post(accept).with(user("editor")).with(csrf()).header("If-Match", "\"1\"")
                    .contentType("application/json").content(body)).andReturn();
            assertThat(r.getResponse().getStatus()).as(body).isEqualTo(422);
            assertThat(r.getResponse().getContentAsString()).contains("bff_draft_required");
            MvcResult d = mvc.perform(post(accept + "-definition").with(user("editor")).with(csrf())
                    .header("If-Match", "\"1\"").contentType("application/json").content(body)).andReturn();
            assertThat(d.getResponse().getStatus()).as("definition " + body).isEqualTo(422);
        }
        assertThat(semantic.received()).isEmpty();

        String draft = "{\"name\":\"R\",\"declaredCardinality\":\"MANY_TO_ONE\",\"allowedJoinTypes\":[\"INNER\"],"
                + "\"result\":\"DRAFT\"}";
        assertThat(mvc.perform(post(accept).with(user("editor")).with(csrf()).header("If-Match", "\"1\"")
                .contentType("application/json").content(draft)).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post(accept + "-definition").with(user("editor")).with(csrf())
                .header("If-Match", "\"1\"").contentType("application/json")
                .content("{\"key\":\"k1\",\"name\":\"K\",\"result\":\"DRAFT\"}")).andReturn().getResponse()
                .getStatus()).isEqualTo(200);
        assertThat(semantic.received()).hasSize(2);
        assertThat(new String(semantic.received().getFirst().body())).isEqualTo(draft);
    }

    @Test
    void theRouteTableMatchesOnlyTheExactOperations() {
        assertThat(SemanticRoutes.match("GET", "data-sources/" + TestApp.DEMO_SOURCE + "/definitions")).isPresent();
        assertThat(SemanticRoutes.match("PATCH", "data-sources/" + TestApp.DEMO_SOURCE + "/definitions/" + DEF)).isEmpty();
        assertThat(SemanticRoutes.match("POST", "data-sources/" + TestApp.DEMO_SOURCE + "/suggestions/" + DEF
                + "/accept")).as("relationship acceptance (B3)").isPresent();
        assertThat(SemanticRoutes.match("GET", "audit-events")).isPresent();
        assertThat(SemanticRoutes.safeQuery("targetType=SEMANTIC_DEFINITION&targetId=" + DEF)).isTrue();
        assertThat(SemanticRoutes.safeQuery("a=b c")).isFalse();
    }
}
