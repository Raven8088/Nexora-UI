package com.nexora.frontend.bff.oidc;

import com.nexora.frontend.bff.support.FakeUpstream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issuer coherence in the Docker deployment: the metadata is read through the backchannel (Keycloak's internal
 * address) and must declare exactly the public issuer; browser endpoints on the public origin, backchannel endpoints
 * on the internal one. Synthetic metadata shaped like Keycloak's with KC_HOSTNAME + KC_HOSTNAME_BACKCHANNEL_DYNAMIC.
 */
class ProviderDiscoveryTest {

    static final URI ISSUER = URI.create("http://host.docker.internal:8180/realms/nexora");

    private FakeUpstream keycloak;
    private URI backchannel;

    @BeforeEach
    void setUp() throws Exception {
        keycloak = new FakeUpstream();
        backchannel = URI.create(keycloak.url() + "/realms/nexora");
    }

    @AfterEach
    void tearDown() {
        keycloak.close();
    }

    private String metadata(String issuer, String browserBase, String backBase) {
        return "{\"issuer\":\"" + issuer + "\","
                + "\"authorization_endpoint\":\"" + browserBase + "/protocol/openid-connect/auth\","
                + "\"end_session_endpoint\":\"" + browserBase + "/protocol/openid-connect/logout\","
                + "\"token_endpoint\":\"" + backBase + "/protocol/openid-connect/token\","
                + "\"jwks_uri\":\"" + backBase + "/protocol/openid-connect/certs\","
                + "\"userinfo_endpoint\":\"" + backBase + "/protocol/openid-connect/userinfo\"}";
    }

    private void serve(String json) {
        keycloak.answer(200, Map.of("Content-Type", "application/json"), json.getBytes(StandardCharsets.UTF_8));
    }

    private ProviderEndpoints discover() {
        return new ProviderDiscovery(Duration.ofSeconds(2)).discover(ISSUER, backchannel, 2, Duration.ofMillis(10));
    }

    @Test
    void browserEndpointsOnThePublicIssuerBackchannelOnTheDockerNetwork() {
        serve(metadata(ISSUER.toString(), ISSUER.toString(), backchannel.toString()));

        ProviderEndpoints e = discover();

        assertThat(keycloak.received().getFirst().pathAndQuery()).isEqualTo("/realms/nexora/.well-known/openid-configuration");
        assertThat(e.issuer()).isEqualTo(ISSUER);
        assertThat(e.authorization().toString()).startsWith("http://host.docker.internal:8180/");
        assertThat(e.endSession().toString()).startsWith("http://host.docker.internal:8180/");
        assertThat(e.token().toString()).startsWith(keycloak.url().toString());
        assertThat(e.jwks().toString()).startsWith(keycloak.url().toString());
        assertThat(e.userInfo().toString()).startsWith(keycloak.url().toString());
    }

    @Test
    void anotherIssuerIsRefusedNeverAccepted() {
        serve(metadata("http://keycloak:8180/realms/nexora", ISSUER.toString(), backchannel.toString()));

        assertThatThrownBy(this::discover).isInstanceOf(ProviderDiscovery.IncoherentProvider.class)
                .hasMessageContaining("declares issuer http://keycloak:8180/realms/nexora");
    }

    @Test
    void aBrowserEndpointOnTheInternalAddressIsRefused() {
        serve(metadata(ISSUER.toString(), backchannel.toString(), backchannel.toString()));

        assertThatThrownBy(this::discover).isInstanceOf(ProviderDiscovery.IncoherentProvider.class)
                .hasMessageContaining("authorization_endpoint");
    }

    @Test
    void aBackchannelEndpointOnAThirdOriginIsRefused() {
        serve(metadata(ISSUER.toString(), ISSUER.toString(), "http://elsewhere.example:8180/realms/nexora"));

        assertThatThrownBy(this::discover).isInstanceOf(ProviderDiscovery.IncoherentProvider.class)
                .hasMessageContaining("token_endpoint");
    }

    @Test
    void whileKeycloakStartsTheMetadataIsRetriedThenAnUnreachableProviderStopsTheBff() {
        keycloak.answer(503, Map.of(), new byte[0]);
        serve(metadata(ISSUER.toString(), ISSUER.toString(), backchannel.toString()));
        assertThat(discover().issuer()).isEqualTo(ISSUER);

        URI nowhere = URI.create("http://127.0.0.1:1/realms/nexora");
        assertThatThrownBy(() -> new ProviderDiscovery(Duration.ofMillis(500))
                .discover(ISSUER, nowhere, 2, Duration.ofMillis(10)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("not reachable");
    }

    @Test
    void outsideDockerTheIssuerIsItsOwnBackchannel() {
        URI issuer = backchannel;
        serve(metadata(issuer.toString(), issuer.toString(), issuer.toString()));

        ProviderEndpoints e = new ProviderDiscovery(Duration.ofSeconds(2)).discover(issuer, issuer, 1, Duration.ZERO);

        assertThat(e.token().toString()).startsWith(issuer.toString());
    }
}
