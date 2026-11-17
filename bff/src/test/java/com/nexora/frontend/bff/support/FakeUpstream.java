package com.nexora.frontend.bff.support;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;

/** A loopback HTTP server that stands for Semantic or Intelligence: queued answers, recorded requests. */
public final class FakeUpstream implements AutoCloseable {

    public record Received(String method, String pathAndQuery, Map<String, String> headers, byte[] body) {
        public String header(String name) {
            return headers.entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase(name))
                    .map(Map.Entry::getValue).findFirst().orElse(null);
        }
    }

    public record Answer(int status, Map<String, String> headers, byte[] body, Duration delay) {
    }

    private final HttpServer server;
    private final ConcurrentLinkedQueue<Answer> answers = new ConcurrentLinkedQueue<>();
    private final List<Received> received = new ArrayList<>();

    public FakeUpstream() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", exchange -> {
            Map<String, String> headers = new LinkedHashMap<>();
            exchange.getRequestHeaders().forEach((k, v) -> headers.put(k, String.join(",", v)));
            byte[] body = exchange.getRequestBody().readAllBytes();
            String uri = exchange.getRequestURI().getRawPath()
                    + (exchange.getRequestURI().getRawQuery() == null ? "" : "?" + exchange.getRequestURI().getRawQuery());
            synchronized (received) {
                received.add(new Received(exchange.getRequestMethod(), uri, headers, body));
            }
            Answer a = answers.poll();
            if (a == null) {
                a = new Answer(500, Map.of("Content-Type", "application/json"), "{}".getBytes(), Duration.ZERO);
            }
            if (!a.delay().isZero()) {
                try {
                    Thread.sleep(a.delay().toMillis());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            a.headers().forEach((k, v) -> exchange.getResponseHeaders().add(k, v));
            exchange.sendResponseHeaders(a.status(), a.body().length == 0 ? -1 : a.body().length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(a.body());
            }
        });
        server.start();
    }

    public URI url() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    public FakeUpstream answer(int status, Map<String, String> headers, byte[] body) {
        answers.add(new Answer(status, headers, body, Duration.ZERO));
        return this;
    }

    public FakeUpstream answerAfter(Duration delay, int status, Map<String, String> headers, byte[] body) {
        answers.add(new Answer(status, headers, body, delay));
        return this;
    }

    public List<Received> received() {
        synchronized (received) {
            return List.copyOf(received);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
