package com.nexora.frontend.bff.security;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import java.nio.charset.StandardCharsets;

/**
 * The web security rules of the BFF, shared by the production chain ({@link OidcSecurityConfig}, which adds the OIDC
 * login) and by the tests, so that what is tested is what runs:
 * <ul>
 *   <li>{@code /bff/**} (the API of the console) needs a signed-in session and answers a JSON 401 instead of
 *       redirecting; the SPA files and routes are public (they hold no data);</li>
 *   <li>CSRF for every state-changing call: the SPA reads the {@code XSRF-TOKEN} cookie and sends it back in
 *       {@code X-XSRF-TOKEN} (Spring Security's SPA support); the session cookie itself is HttpOnly;</li>
 *   <li>a strict Content Security Policy (only this origin; no inline script), no framing, no referrer, no
 *       caching of API answers.</li>
 * </ul>
 */
public final class SecurityRules {

    /** The API of the console. */
    public static final String API = "/bff/**";
    /** Starts the OIDC login (Spring Security's endpoint for the {@code keycloak} registration). */
    public static final String LOGIN = "/oauth2/authorization/keycloak";

    /** No script, style or connection outside this origin; Mantine needs inline styles, never inline scripts. */
    public static final String CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; "
            + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; "
            + "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    private SecurityRules() {
    }

    public static HttpSecurity apply(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PathPatternRequestMatcher.withDefaults().matcher("/bff/health"))
                        .permitAll()
                        .requestMatchers(PathPatternRequestMatcher.withDefaults().matcher(API)).authenticated()
                        .anyRequest().permitAll())
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(f -> f.changeSessionId()))
                .exceptionHandling(e -> e.defaultAuthenticationEntryPointFor(jsonUnauthorized(),
                        PathPatternRequestMatcher.withDefaults().matcher(API))
                        .defaultAuthenticationEntryPointFor(new LoginUrlAuthenticationEntryPoint(LOGIN),
                                request -> true))
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CONTENT_SECURITY_POLICY))
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
                .logout(l -> l.disable())
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable());
    }

    /** A JSON 401 for the API: the SPA shows «your session ended» and offers to sign in again. */
    static AuthenticationEntryPoint jsonUnauthorized() {
        return (request, response, exception) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"status\":401,\"code\":\"session_required\",\"reason\":\""
                    + SessionDiagnostics.NOT_SIGNED_IN + "\",\"title\":\"Sign in to continue.\"}");
        };
    }
}
