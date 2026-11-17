package com.nexora.frontend.bff.support;

import com.nexora.frontend.bff.auth.LogoutUrls;
import com.nexora.frontend.bff.auth.SessionController;
import com.nexora.frontend.bff.config.BffProperties;
import com.nexora.frontend.bff.intelligence.KnowledgeRequestProxyController;
import com.nexora.frontend.bff.intelligence.ReportRequestProxyController;
import com.nexora.frontend.bff.proxy.UpstreamClient;
import com.nexora.frontend.bff.security.AccessTokens;
import com.nexora.frontend.bff.security.CurrentUser;
import com.nexora.frontend.bff.security.SecurityRules;
import com.nexora.frontend.bff.semantic.SemanticProxyController;
import com.nexora.frontend.bff.sources.SourceRegistry;
import com.nexora.frontend.bff.web.HealthController;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.mock.web.MockServletContext;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

/**
 * The BFF as it runs, without the OIDC login: the same {@link SecurityRules}, controllers and proxy, with a test
 * {@link AccessTokens} that gives each signed-in test user the token registered for its name. The OIDC login itself
 * (Spring Security's OAuth2 client with PKCE) is configuration, verified with Keycloak (docs/06-pruebas.md).
 */
public final class TestApp {

    public static final UUID DEMO_SOURCE = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    public static final UUID FOREIGN = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    /** Tokens by authenticated user name. */
    public static final Map<String, String> TOKENS = new ConcurrentHashMap<>();

    public static URI semantic = URI.create("http://127.0.0.1:1");
    public static URI intelligence = URI.create("http://127.0.0.1:1");
    public static Duration intelligenceTimeout = Duration.ofSeconds(5);

    private TestApp() {
    }

    public static BffProperties properties() {
        return new BffProperties(semantic, intelligence,
                new BffProperties.Upstream(Duration.ofSeconds(2), Duration.ofSeconds(5), intelligenceTimeout,
                        65_536, 4_194_304, 10_485_760),
                new BffProperties.Identity("roles", "tenant", "principal_type"),
                new BffProperties.Diagnostics(Set.of("PLATFORM_ADMIN")),
                List.of(new BffProperties.Source("demo", "Fuente demo", DEMO_SOURCE, UUID.fromString(Tokens.TENANT)),
                        new BffProperties.Source("otra", "Otra", FOREIGN, UUID.fromString(Tokens.OTHER_TENANT))),
                new BffProperties.Oidc(URI.create("http://idp.example:8180/realms/nexora"),
                        URI.create("http://keycloak:8180/realms/nexora"), "nexora-console", 1, Duration.ofMillis(10)));
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    public static class Config {

        @Bean
        SecurityFilterChain chain(HttpSecurity http) throws Exception {
            return SecurityRules.apply(http).build();
        }

        @Bean
        BffProperties bffProperties() {
            return properties();
        }

        @Bean
        AccessTokens accessTokens() {
            return (request, response) -> {
                Authentication a = SecurityContextHolder.getContext().getAuthentication();
                return a == null || !a.isAuthenticated() ? Optional.empty() : Optional.ofNullable(TOKENS.get(a.getName()));
            };
        }

        @Bean
        CurrentUser currentUser(AccessTokens tokens, BffProperties properties) {
            return new CurrentUser(tokens, properties);
        }

        @Bean
        SourceRegistry sourceRegistry(BffProperties properties) {
            return new SourceRegistry(properties);
        }

        @Bean
        UpstreamClient upstreamClient() {
            return new UpstreamClient(Duration.ofSeconds(2));
        }

        @Bean
        LogoutUrls logoutUrls() {
            return (authentication, home) -> Optional.of("https://idp.example/logout?post_logout_redirect_uri=" + home);
        }

        @Bean
        SessionController sessionController(CurrentUser users, SourceRegistry sources, LogoutUrls urls) {
            return new SessionController(users, sources, urls);
        }

        @Bean
        SemanticProxyController semanticProxy(CurrentUser users, SourceRegistry sources, UpstreamClient upstream,
                                              BffProperties properties) {
            return new SemanticProxyController(users, sources, upstream, properties);
        }

        @Bean
        ReportRequestProxyController reportProxy(CurrentUser users, SourceRegistry sources, UpstreamClient upstream,
                                                 BffProperties properties) {
            return new ReportRequestProxyController(users, sources, upstream, properties);
        }

        @Bean
        KnowledgeRequestProxyController knowledgeProxy(CurrentUser users, SourceRegistry sources,
                                                       UpstreamClient upstream, BffProperties properties) {
            return new KnowledgeRequestProxyController(users, sources, upstream, properties);
        }

        @Bean
        HealthController health() {
            return new HealthController();
        }
    }

    public static MockMvc mvc() {
        AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(Config.class);
        context.refresh();
        return MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }
}
