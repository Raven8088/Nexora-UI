package com.nexora.frontend.bff.proxy;

import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.channels.UnresolvedAddressException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * One HTTP exchange with a Nexora service: no redirects, bounded time and size. It tells apart a call that was never
 * sent (the service could not be reached: safe to retry) from one whose outcome is unknown (it timed out or broke
 * after being sent: it may have been processed, so it is never repeated silently).
 */
public class UpstreamClient {

    /** A request to a service; {@code body} may be null. */
    public record Call(String method, URI uri, Map<String, String> headers, byte[] body, Duration timeout,
                       int maxResponseBytes) {
        public Call {
            Objects.requireNonNull(method, "method");
            Objects.requireNonNull(uri, "uri");
            headers = Map.copyOf(headers);
            Objects.requireNonNull(timeout, "timeout");
        }
    }

    /** The answer of a service. */
    public record Answer(int status, Map<String, List<String>> headers, byte[] body) {
        public Answer {
            headers = Map.copyOf(headers);
            Objects.requireNonNull(body, "body");
        }

        public String header(String name) {
            for (Map.Entry<String, List<String>> e : headers.entrySet()) {
                if (e.getKey().equalsIgnoreCase(name) && !e.getValue().isEmpty()) {
                    return e.getValue().getFirst();
                }
            }
            return null;
        }
    }

    /** Why there is no answer. */
    public static final class Failure extends Exception {
        public enum Kind { NOT_SENT, TIMEOUT, BROKEN, TOO_LARGE }

        private final Kind kind;

        public Failure(Kind kind) {
            super(kind.name(), null, false, false);
            this.kind = kind;
        }

        public Kind kind() {
            return kind;
        }
    }

    private final HttpClient http;

    public UpstreamClient(Duration connectTimeout) {
        this.http = HttpClient.newBuilder().connectTimeout(connectTimeout)
                .followRedirects(HttpClient.Redirect.NEVER).version(HttpClient.Version.HTTP_1_1).build();
    }

    public Answer exchange(Call call) throws Failure {
        HttpRequest.Builder builder = HttpRequest.newBuilder(call.uri()).timeout(call.timeout())
                .method(call.method(), call.body() == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofByteArray(call.body()));
        call.headers().forEach(builder::header);
        HttpResponse<InputStream> response;
        try {
            response = http.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (HttpConnectTimeoutException | ConnectException | UnresolvedAddressException e) {
            throw new Failure(Failure.Kind.NOT_SENT);
        } catch (HttpTimeoutException e) {
            throw new Failure(Failure.Kind.TIMEOUT);
        } catch (IOException e) {
            throw new Failure(e.getCause() instanceof ConnectException ? Failure.Kind.NOT_SENT : Failure.Kind.BROKEN);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new Failure(Failure.Kind.BROKEN);
        }
        byte[] body;
        try (InputStream in = response.body()) {
            body = in.readNBytes(call.maxResponseBytes() + 1);
        } catch (IOException e) {
            throw new Failure(Failure.Kind.BROKEN);
        }
        if (body.length > call.maxResponseBytes()) {
            throw new Failure(Failure.Kind.TOO_LARGE);
        }
        return new Answer(response.statusCode(), new LinkedHashMap<>(response.headers().map()), body);
    }
}
