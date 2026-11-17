package com.nexora.frontend.bff.oidc;

import java.net.URI;
import java.util.Objects;

/**
 * The OIDC endpoints of the realm, split by who uses them:
 * <ul>
 *   <li><b>browser</b>: {@code authorization} and {@code endSession} (the user's browser is redirected there), always
 *       on the public origin of the issuer;</li>
 *   <li><b>backchannel</b>: {@code token}, {@code jwks} and {@code userInfo}, called by the BFF over the Docker
 *       network (Keycloak's {@code KC_HOSTNAME_BACKCHANNEL_DYNAMIC}), never by the browser.</li>
 * </ul>
 * {@code issuer} is always the public issuer: the {@code iss} of every token is checked against it.
 */
public record ProviderEndpoints(URI issuer, URI authorization, URI token, URI jwks, URI userInfo, URI endSession) {

    public ProviderEndpoints {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(authorization, "authorization");
        Objects.requireNonNull(token, "token");
        Objects.requireNonNull(jwks, "jwks");
        Objects.requireNonNull(userInfo, "userInfo");
        // endSession is optional in OIDC; Keycloak always publishes it.
    }
}
