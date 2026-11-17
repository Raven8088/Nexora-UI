package com.nexora.frontend.bff.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Liveness of the BFF only (it does not call the services and reveals nothing). */
@RestController
public class HealthController {

    @GetMapping("/bff/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
