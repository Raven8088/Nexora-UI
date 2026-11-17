package com.nexora.frontend.bff;

import com.nexora.frontend.bff.config.BffProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Backend for frontend of the Nexora AI web console. It owns the user's OIDC session (the tokens never reach the
 * browser), protects every state-changing call with CSRF, and forwards an allowlisted set of calls to Nexora Semantic
 * and Nexora Intelligence with the <b>user's own</b> access token. It holds no business rule: Semantic and
 * Intelligence keep the authority over permissions, tenants, definitions and reports.
 */
@SpringBootApplication
@EnableConfigurationProperties(BffProperties.class)
public class NexoraBffApplication {

    public static void main(String[] args) {
        SpringApplication.run(NexoraBffApplication.class, args);
    }
}
