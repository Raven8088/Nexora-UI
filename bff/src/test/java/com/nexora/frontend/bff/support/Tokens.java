package com.nexora.frontend.bff.support;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

/** Synthetic, unsigned access tokens for tests only (the BFF reads claims; the services verify signatures). */
public final class Tokens {

    public static final String TENANT = "11111111-1111-4111-8111-111111111111";
    public static final String OTHER_TENANT = "22222222-2222-4222-8222-222222222222";

    private Tokens() {
    }

    public static String of(String subject, String tenant, String principalType, List<String> roles) {
        String header = enc("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        String roleList = roles.stream().map(r -> "\"" + r + "\"").collect(Collectors.joining(","));
        String payload = enc("{\"sub\":\"" + subject + "\",\"name\":\"Ana Prueba\",\"preferred_username\":\"ana\""
                + (tenant == null ? "" : ",\"tenant\":\"" + tenant + "\"")
                + (principalType == null ? "" : ",\"principal_type\":\"" + principalType + "\"")
                + ",\"roles\":[" + roleList + "]}");
        return header + "." + payload + ".c2lnbmF0dXJl";
    }

    public static String human(String... roles) {
        return of("subject-ana", TENANT, "HUMAN", List.of(roles));
    }

    private static String enc(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }
}
