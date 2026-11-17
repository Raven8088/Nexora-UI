# Nexora Frontend: multi-stage image (web console = React SPA + Spring Boot BFF in one process).
#
# Build (from this folder):  docker build -t nexora/frontend:dev .
# From nexora-deploy it is built by "docker compose --profile frontend build frontend" (docs/12-docker.md).
# Stage 1 compiles the SPA with Node (npm ci from package-lock.json, type check + Vite build).
# Stage 2 compiles the BFF with Maven and JDK 21 and puts the SPA inside the jar (profile with-web).
#   Tests are not run here, as in the other Nexora images: they run with "npm test" and "mvn clean verify".
# Stage 3 keeps only a Java 21 runtime and the executable jar, and runs as an unprivileged user (UID 10001).
# Configuration comes from the environment and from Docker secrets (/run/secrets), never from the image: no .env,
# no client secret, no data source or tenant is copied into any layer (.dockerignore is a whitelist).
# The base images can be replaced (e.g. pinned by digest) with --build-arg NODE_IMAGE=... BUILD_IMAGE=...
# RUNTIME_IMAGE=...

ARG NODE_IMAGE=node:22-bookworm-slim
ARG BUILD_IMAGE=maven:3.9-eclipse-temurin-21
ARG RUNTIME_IMAGE=eclipse-temurin:21-jre

FROM ${NODE_IMAGE} AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY web/index.html web/tsconfig.json web/vite.config.ts web/postcss.config.cjs ./
COPY web/public ./public
COPY web/src ./src
RUN npm run build

FROM ${BUILD_IMAGE} AS bff
WORKDIR /build/bff
COPY bff/pom.xml ./
COPY bff/src/main ./src/main
COPY --from=web /build/web/dist /build/web/dist
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Pwith-web -Dmaven.test.skip=true package \
    && cp target/nexora-front-end-bff-*.jar /build/app.jar \
    && jar tf /build/app.jar | grep -q '^BOOT-INF/classes/static/index.html$'

FROM ${RUNTIME_IMAGE}
LABEL org.opencontainers.image.title="Nexora Frontend" \
      org.opencontainers.image.description="Nexora AI web console (React SPA + Spring Boot BFF)" \
      org.opencontainers.image.vendor="Nexora AI"
RUN groupadd --system --gid 10001 nexora \
    && useradd --system --uid 10001 --gid nexora --no-create-home --home-dir /nonexistent \
       --shell /usr/sbin/nologin nexora
WORKDIR /app
COPY --from=bff --chown=root:root --chmod=0444 /build/app.jar /app/app.jar
USER 10001:10001
# Inside the container the BFF listens on all interfaces of the container; compose publishes it on 127.0.0.1 only.
ENV NEXORA_CONSOLE_BIND_ADDRESS=0.0.0.0 \
    NEXORA_CONSOLE_PORT=8085
EXPOSE 8085
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8085 && printf 'GET /bff/health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q '\"UP\"' <&3"]
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
