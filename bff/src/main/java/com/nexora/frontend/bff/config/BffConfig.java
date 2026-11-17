package com.nexora.frontend.bff.config;

import com.nexora.frontend.bff.proxy.UpstreamClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Shared infrastructure of the BFF. */
@Configuration
public class BffConfig {

    @Bean
    UpstreamClient upstreamClient(BffProperties properties) {
        return new UpstreamClient(properties.upstream().connectTimeout());
    }
}
