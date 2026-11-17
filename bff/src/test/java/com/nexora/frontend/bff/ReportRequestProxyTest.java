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
 * The chat's report request through the BFF (contract of Intelligence {@code POST /api/v1/report-requests}, with
 * controlled answers): identity, idempotency, correlation, the Excel binary, clarifications, problems, D7 and D9.
 */
class ReportRequestProxyTest {

    static final String KEY = "6f1d3c1e-5a43-4f0b-9b55-0c1d2e3f4a5b";
    static final String QUESTION = "{\"request\":\"¿Cuántos registros tiene cada pozo?\",\"language\":\"es\","
            + "\"dataSource\":\"demo\"}";
    static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private FakeUpstream intelligence;
    private MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        intelligence = new FakeUpstream();
        TestApp.intelligence = intelligence.url();
        TestApp.intelligenceTimeout = Duration.ofSeconds(2);
        TestApp.TOKENS.put("ana", Tokens.human("REPORT_REQUESTER", "VIEWER"));
        TestApp.TOKENS.put("admin", Tokens.human("REPORT_REQUESTER", "VIEWER", "PLATFORM_ADMIN"));
        TestApp.TOKENS.put("viewer", Tokens.human("VIEWER"));
        mvc = TestApp.mvc();
    }

    @AfterEach
    void tearDown() {
        intelligence.close();
    }

    @Test
    void theBffNeverClaimsToBeLocalTheHostIsTheOneOfTheIntelligenceUrlAndNothingComesFromTheBrowser()
            throws Exception {
        intelligence.answer(200, Map.of("Content-Type", "application/json"),
                "{\"status\":\"NEEDS_CLARIFICATION\"}".getBytes(StandardCharsets.UTF_8));

        mvc.perform(post("/bff/api/report-requests").with(user("ana")).with(csrf())
                .contentType("application/json").header("Idempotency-Key", KEY)
                .header("Origin", "http://127.0.0.1:8085").header("Host", "127.0.0.1:8101")
                .content(QUESTION.getBytes(StandardCharsets.UTF_8))).andReturn();

        FakeUpstream.Received sent = intelligence.received().getFirst();
        assertThat(sent.header("Host")).isEqualTo(intelligence.url().getAuthority());
        assertThat(sent.header("Origin")).isNull();
    }

    private MvcResult ask(String userName, String body) throws Exception {
        return mvc.perform(post("/bff/api/report-requests").with(user(userName)).with(csrf())
                .contentType("application/json").header("Idempotency-Key", KEY)
                .header("Cookie", "NEXORA_CONSOLE_SESSION=secreto").header("X-Forwarded-For", "10.0.0.1")
                .content(body.getBytes(StandardCharsets.UTF_8))).andReturn();
    }

    @Test
    void f2TheClarificationReachesTheConsoleWithTheUsersTokenAndTheSameKey() throws Exception {
        intelligence.answer(200, Map.of("Content-Type", "application/json", "X-Request-Id", "corr-1"),
                ("{\"status\":\"NEEDS_CLARIFICATION\",\"correlationId\":\"corr-1\",\"question\":\"Tu pregunta no "
                        + "indica qué quieres contar.\",\"options\":[\"Log curve\",\"Ninguna de estas\"],"
                        + "\"clarificationId\":\"c1\",\"optionIds\":[\"o1\",\"none\"],\"expiresAt\":"
                        + "\"2026-11-11T12:15:00Z\"}").getBytes(StandardCharsets.UTF_8));

        MvcResult r = ask("ana", QUESTION);

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("NEEDS_CLARIFICATION")
                .contains("\"optionIds\":[\"o1\",\"none\"]");
        assertThat(r.getResponse().getHeader("X-Request-Id")).isEqualTo("corr-1");
        assertThat(r.getResponse().getHeader("Cache-Control")).isEqualTo("no-store");
        FakeUpstream.Received sent = intelligence.received().getFirst();
        assertThat(sent.pathAndQuery()).isEqualTo("/api/v1/report-requests");
        assertThat(sent.header("Authorization")).isEqualTo("Bearer " + TestApp.TOKENS.get("ana"));
        assertThat(sent.header("Idempotency-Key")).isEqualTo(KEY);
        assertThat(new String(sent.body(), StandardCharsets.UTF_8)).isEqualTo(QUESTION);
        assertThat(sent.header("Cookie")).isNull();
        assertThat(sent.header("X-Forwarded-For")).isNull();
    }

    @Test
    void f3TheExcelIsForwardedByteForByteWithItsHeaders() throws Exception {
        byte[] file = new byte[200_000];
        for (int i = 0; i < file.length; i++) {
            file[i] = (byte) (i * 31);
        }
        intelligence.answer(200, Map.of("Content-Type", XLSX, "Content-Disposition",
                "attachment; filename=\"nexora-report-r1.xlsx\"", "X-Nexora-Completeness", "COMPLETED",
                "X-Nexora-Warnings", "", "X-Nexora-Artifact-Sha256", "ab".repeat(32), "X-Nexora-Run-Id", "r1",
                "X-Nexora-Report-Plan-Id", "p1", "X-Request-Id", "corr-3", "Set-Cookie", "x=y"), file);

        MvcResult r = ask("ana", "{\"clarification\":{\"id\":\"c1\",\"option\":\"o1\"},\"language\":\"es\","
                + "\"dataSource\":\"demo\"}");

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentType()).isEqualTo(XLSX);
        assertThat(r.getResponse().getContentAsByteArray()).isEqualTo(file);
        assertThat(r.getResponse().getHeader("Content-Disposition")).contains("nexora-report-r1.xlsx");
        assertThat(r.getResponse().getHeader("X-Nexora-Artifact-Sha256")).isEqualTo("ab".repeat(32));
        assertThat(r.getResponse().getHeader("X-Nexora-Completeness")).isEqualTo("COMPLETED");
        // D9: ids only for diagnostics; nothing of the service's cookies
        assertThat(r.getResponse().getHeader("X-Nexora-Run-Id")).isNull();
        assertThat(r.getResponse().getHeader("X-Nexora-Report-Plan-Id")).isNull();
        assertThat(r.getResponse().getHeader("Set-Cookie")).isNull();
    }

    @Test
    void d9DiagnosticsGetTheIdsAndTheElapsedTimeOthersDoNot() throws Exception {
        String problem = "{\"type\":\"https://nexora.ai/problems/compilation_failed\",\"status\":502,\"code\":"
                + "\"compilation_failed\",\"correlationId\":\"corr-9\",\"stage\":\"COMPILATION\",\"reason\":"
                + "\"CLARIFICATION_EXPIRED\",\"reportPlanId\":\"p9\",\"runId\":\"r9\"}";
        intelligence.answer(502, Map.of("Content-Type", "application/problem+json"), problem.getBytes())
                .answer(502, Map.of("Content-Type", "application/problem+json", "X-Nexora-Run-Id", "r9"),
                        problem.getBytes());

        MvcResult plain = ask("ana", QUESTION);
        MvcResult diag = ask("admin", QUESTION);

        String p = plain.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(plain.getResponse().getStatus()).isEqualTo(502);
        assertThat(p).contains("\"reason\":\"CLARIFICATION_EXPIRED\"").contains("\"stage\":\"COMPILATION\"")
                .doesNotContain("p9").doesNotContain("r9");
        assertThat(plain.getResponse().getHeader("X-Nexora-Bff-Elapsed-Ms")).isNull();
        assertThat(diag.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("\"reportPlanId\":\"p9\"");
        assertThat(diag.getResponse().getHeader("X-Nexora-Run-Id")).isEqualTo("r9");
        assertThat(diag.getResponse().getHeader("X-Nexora-Bff-Elapsed-Ms")).isNotNull();
    }

    @Test
    void f4AndIdempotencyProblemsOfIntelligencePassUnchanged() throws Exception {
        intelligence.answer(422, Map.of("Content-Type", "application/problem+json"),
                ("{\"status\":422,\"code\":\"not_answerable\",\"title\":\"The request could not be answered; no "
                        + "report was generated.\",\"explanation\":\"Elegiste «Ninguna de estas».\",\"gapCodes\":"
                        + "[\"NONE_SELECTED\"]}").getBytes(StandardCharsets.UTF_8))
                .answer(409, Map.of("Content-Type", "application/problem+json"),
                        "{\"status\":409,\"code\":\"request_completed\"}".getBytes());

        MvcResult f4 = ask("ana", "{\"clarification\":{\"id\":\"c1\",\"option\":\"none\"},\"language\":\"es\","
                + "\"dataSource\":\"demo\"}");
        MvcResult again = ask("ana", QUESTION);

        assertThat(f4.getResponse().getStatus()).isEqualTo(422);
        assertThat(f4.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("NONE_SELECTED")
                .contains("Ninguna de estas");
        assertThat(again.getResponse().getStatus()).isEqualTo(409);
        assertThat(again.getResponse().getContentAsString()).contains("request_completed");
    }

    @Test
    void aTimeoutIsAnUnknownOutcomeAndAnUnreachableServiceANotSentOne() throws Exception {
        intelligence.answerAfter(Duration.ofSeconds(4), 200, Map.of("Content-Type", "application/json"),
                "{}".getBytes());
        MvcResult timeout = ask("ana", QUESTION);
        assertThat(timeout.getResponse().getStatus()).isEqualTo(504);
        assertThat(timeout.getResponse().getContentAsString()).contains("\"outcome\":\"UNKNOWN\"")
                .contains("bff_upstream_timeout");

        intelligence.close();
        MvcResult down = ask("ana", QUESTION);
        assertThat(down.getResponse().getStatus()).isEqualTo(503);
        assertThat(down.getResponse().getContentAsString()).contains("\"outcome\":\"NOT_SENT\"");
    }

    @Test
    void onlyConfiguredSourcesOfTheTenantAndOnlyRequesters() throws Exception {
        MvcResult foreign = ask("ana", QUESTION.replace("demo", "otra"));
        MvcResult unknown = ask("ana", QUESTION.replace("demo", "nadie"));
        MvcResult viewer = ask("viewer", QUESTION);

        assertThat(foreign.getResponse().getStatus()).isEqualTo(403);
        assertThat(foreign.getResponse().getContentAsString()).contains("bff_source_not_configured");
        assertThat(unknown.getResponse().getStatus()).isEqualTo(403);
        assertThat(viewer.getResponse().getStatus()).isEqualTo(403);
        assertThat(intelligence.received()).isEmpty();
    }
}
