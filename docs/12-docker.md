# 12. Despliegue con Docker (requisito arquitectónico permanente)

Nexora Frontend se construye, configura, inicia y detiene **solo con Docker Compose**, dentro del despliegue existente
`nexora-deploy`, igual que Discovery, Semantic, Intelligence y Reports. `java -jar` y `npm run dev` **no** son
mecanismos de despliegue: el segundo queda solo para desarrollar la interfaz.

Estado (2026-11-11): **integración aplicada en `nexora-deploy` (D-FE-3, autorizada)**; construcción y arranque en
Windows pendientes (se harán paso a paso, §9–§10). Bloqueos con propuesta única en [13](13-propuesta-intelligence-y-oidc.md):
acceso a Intelligence (D-FE-1) y alcance del issuer desde el navegador (D-FE-2).

## 1. Imagen (`Dockerfile`, `.dockerignore`)

| Etapa | Base (sustituible por `--build-arg`) | Hace |
|---|---|---|
| `web` | `NODE_IMAGE=node:22-bookworm-slim` | `npm ci` con `package-lock.json`, comprobación de tipos y build de Vite |
| `bff` | `BUILD_IMAGE=maven:3.9-eclipse-temurin-21` | `mvn -Pwith-web package`: el jar del BFF con la SPA dentro (`static/`); falla si falta `index.html` |
| ejecución | `RUNTIME_IMAGE=eclipse-temurin:21-jre` | solo el jar (0444, root), usuario 10001, `EXPOSE 8085`, `HEALTHCHECK` sobre `/bff/health` |

- Mismas convenciones que las imágenes de los motores: bases sin fijar a digest (se puede fijar por argumento),
  pruebas fuera de la imagen (`npm test`, `mvn clean verify`), usuario 10001, `-XX:MaxRAMPercentage=75.0`.
- `.dockerignore` es una lista blanca: solo `web/` (sin pruebas) y `bff/pom.xml` + `bff/src/main`. Nunca entran
  `.env`, `secrets/`, claves, `node_modules`, `dist`, `target`, documentación ni pruebas.
- Dentro del contenedor el BFF escucha en `0.0.0.0:8085`; Compose lo publica solo en `127.0.0.1`.

## 2. Arquitectura en Docker

```
 Navegador (Windows)
   │ http://127.0.0.1:8085 (consola)                   │ KEYCLOAK_PUBLIC_URL (login de Keycloak)
   ▼                                                   ▼
 ┌──────────── frontend (perfil "frontend") ─────────────┐        keycloak :8180 (publicado en 127.0.0.1)
 │ BFF + SPA, read-only, sin capacidades, uid 10001      │
 │ /run/secrets/nexora_console_client_secret (Docker secret)
 └──┬───────────────────────────────┬────────────────────┘
    │ red "nexora"                  │ red "nexora-intelligence-edge" (IP fija NEXORA_FRONTEND_EDGE_IP)
    ├─▶ keycloak:8180  (token, JWKS, userinfo, metadatos)
    ├─▶ semantic:8080  (token del USUARIO)
    │                               └─▶ intelligence-edge:8101 ──▶ intelligence (red interna, sin cambios)
```

- El frontend **no** se une a `nexora-intelligence` (red interna de Intelligence): llega a Intelligence solo por la
  API publicada de `intelligence-edge`, igual que un cliente local.
- IP fija en `nexora-intelligence-edge`: comprobado en Docker 29 que un contenedor con dirección automática en esa
  subred toma `.18`, la dirección fija de `intelligence-edge`, y entonces `intelligence-edge` no arranca. Con IP fija
  (por defecto `.29`, fuera de la de `intelligence-edge`) no puede ocurrir.

## 3. Cambios aplicados en `nexora-deploy` (D-FE-3)

Aplicados el 2026-11-11 tras comprobar que los archivos no habían cambiado desde su lectura. Copia previa de los tres
archivos en `Nexora AI\Claude outputs\frontend-docker\respaldo-nexora-deploy-20261111\`. `.env` **no** se modificó (las
variables nuevas tienen valor por defecto). Diferencias exactas en `deploy/nexora-deploy/`; Compose efectivo del
servicio en `deploy/evidence/compose-efectivo-frontend.json`.

| Archivo existente | Cambio |
|---|---|
| `compose.yaml` (`compose.yaml.diff`) | Etapa 7 en la cabecera; servicio `frontend` (perfil `frontend`); secreto `nexora_console_client_secret` (archivo) |
| `.env.example` (`env.example.diff`) | `NEXORA_FRONTEND_EDGE_IP`, `FRONTEND_HOST_PORT`, `NEXORA_DATA_SOURCE_LABEL` (opcional), `NEXORA_FRONTEND_DIR` (comentado) |
| `.gitignore` (`gitignore.diff`) | `secrets/*` y `!secrets/README.md` |
| nuevo `secrets/README.md` (`secrets-README.md`) | Qué es y cómo se crea el archivo del secreto |

No cambia ningún motor, ninguna imagen existente, ninguna red ni el volumen. **Evidencia (VERIFICADO con
`docker compose config --hash`, valores no secretos de la instalación):** con los perfiles explícitos y con el
`COMPOSE_PROFILES` de `.env` (los comandos sin `--profile`), los 8 servicios existentes tienen exactamente el mismo hash
de configuración antes y después (Compose solo recrea un contenedor cuando su hash cambia); redes y volumen idénticos;
sin `--profile frontend` el servicio no aparece. El `.env` actual sirve sin cambios.

**IP `10.250.1.29`:** dentro de `NEXORA_INTELLIGENCE_EDGE_SUBNET=10.250.1.16/28` (valor real comprobado), distinta de la
red (.16), la puerta de enlace (.17), `intelligence-edge` (.18, valor real comprobado) y la difusión (.31); fuera de
`nexora` y `nexora-intelligence`. La red no tiene `ip_range` y en Compose solo `intelligence-edge` la usa: añadir un
miembro con IP fija no recrea ni modifica la red. Antes del primer arranque, comprobar que nada externo la ocupa
(§9, paso 2).

## 4. Variables

| Variable (`.env`) | Por defecto | Uso en el contenedor |
|---|---|---|
| `KEYCLOAK_PUBLIC_URL` | (ya existe) | `NEXORA_KEYCLOAK_ISSUER = …/realms/nexora`: issuer validado y destino del navegador |
| `KEYCLOAK_INTERNAL_URL` | `http://keycloak:8180` (ya existe) | `NEXORA_KEYCLOAK_BACKCHANNEL_URL`: metadatos, token, JWKS, userinfo |
| `SEMANTIC_INTERNAL_URL` | `http://semantic:8080` (ya existe) | `NEXORA_SEMANTIC_URL` |
| `INTELLIGENCE_HOST_PORT` | `8101` (ya existe) | `NEXORA_INTELLIGENCE_URL=http://intelligence-edge:<puerto>` |
| `NEXORA_DATA_SOURCE_ALIAS`, `NEXORA_DATA_SOURCE_ID`, `NEXORA_TENANT_ID` | (ya existen, etapa 4) | La fuente de la consola (`primary` en esta instalación) = la de Intelligence |
| `NEXORA_DATA_SOURCE_LABEL` | el alias | Nombre visible de la fuente |
| `NEXORA_FRONTEND_EDGE_IP` | `10.250.1.29` | IP fija en `nexora-intelligence-edge` |
| `FRONTEND_HOST_PORT` | `8085` | Puerto en `127.0.0.1` |
| `NEXORA_FRONTEND_DIR` | `../../../Front-end/Nexora-front-end` | Carpeta de este repositorio (contexto de build) |
| `NEXORA_CONSOLE_SECURE_COOKIE` | `false` | `true` solo detrás de HTTPS |

La consola no queda atada a Wellnode: la fuente es configuración de la instalación (los mismos valores de etapa 4 que
usa Intelligence). Para más fuentes se añaden `NEXORA_BFF_SOURCES_<n>_*`. El BFF no arranca sin una fuente completa
y válida, y Semantic e Intelligence siguen validando tenant y permisos en cada llamada.

## 5. Secreto del cliente

- Archivo `nexora-deploy/secrets/nexora_console_client_secret` (no versionado), entregado por Compose como
  `/run/secrets/nexora_console_client_secret` (montaje de solo lectura). El BFF lo lee con `configtree`.
- No está en la imagen, ni en el entorno del contenedor (`docker inspect` no lo muestra), ni en los logs.
- **VERIFICADO aquí:** los secretos `environment:` de Compose **no** se admiten en servicios `read_only`
  (*"`file` is the sole supported option"*); con `file:` el contenedor read-only, uid 10001, lo lee y no aparece en
  su entorno.
- Crear el archivo sin mostrar el valor: `deploy\Set-NexoraConsoleSecret.ps1 -DeployDir <nexora-deploy>`.
- Sin secreto, el BFF no arranca y lo dice sin imprimir nada.

## 6. OIDC: coherencia del issuer

El `iss` de todos los tokens es `KEYCLOAK_PUBLIC_URL/realms/nexora`, que Keycloak fija con `KC_HOSTNAME`. Hoy vale
`http://host.docker.internal:8180/realms/nexora` (comprobado en `.env` sin mostrar otros valores).

| Quién | URL | Para qué |
|---|---|---|
| Navegador | issuer público (`authorization_endpoint`, `end_session_endpoint`) | login y logout |
| BFF | `http://keycloak:8180/realms/nexora` (backchannel, `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`) | metadatos, token, JWKS, userinfo |
| Validación | issuer público | `iss` del ID token (Spring lo compara con `issuerUri`) |

Al arrancar, el BFF lee los metadatos por el backchannel y **se niega a arrancar** si declaran otro issuer, si un
endpoint del navegador no está en el origen público, o si un endpoint del backchannel no está ni en el origen público
ni en el interno (`ProviderDiscovery`, 6 pruebas). No se desactiva ninguna comprobación (issuer, firma, PKCE, CSRF,
autorización). Es el mismo esquema que ya usan Semantic y Reports (issuer público + claves internas).

**D-FE-2:** falta comprobar que el navegador de Windows abre `http://host.docker.internal:8180`. Comprobación de solo
lectura `deploy\Test-NexoraOidcReachability.ps1` y propuesta (issuer `http://keycloak.localhost:8180`, sin archivo
hosts) en [13](13-propuesta-intelligence-y-oidc.md) §B. Nada aplicado.

## 7. Intelligence (D-FE-1 → DEC-D-FE-1)

Causa confirmada con el log real de Intelligence (`correlationId=a0fc0d22-… rejected code=local_only peer=10.250.1.2`).
El BFF **no** se presenta como local (opción rechazada y retirada): envía `Host: intelligence-edge:8101`, sin `Origin`,
con el token del usuario. **DEC-D-FE-1** (aprobada e implementada, pendiente de Windows y despliegue): Intelligence
acepta a `nexora-console` como **cliente confiable** solo si, a la vez, el par es `intelligence-edge`, el `Host` es
exactamente `intelligence-edge:<puerto>`, no hay `Origin`, el token supera todas las comprobaciones (emisor, audiencia
`nexora-intelligence`, `HUMAN`, `REPORT_REQUESTER`, tenant) **y** su `azp` es `nexora-console`. Configuración en
`nexora-deploy/config/intelligence/application-deploy.yml` (`trusted-clients`); la política local no cambia. Detalle:
[13](13-propuesta-intelligence-y-oidc.md) §A y el Documento Maestro (A1 §38, A2 §16).

Despliegue (lo coordina el usuario): construir Intelligence y recrear **solo** `intelligence`; reconstruir y recrear
`frontend` (lleva la mejora de mensajes). Después, F2–F4 desde la consola con Wellnode: hasta entonces D-FE-1 **no**
está validado.

## 8. Keycloak (sin cambios aplicados)

El cliente `nexora-console` se crea a mano (doc 03) con, para este despliegue:

- Valid redirect URIs: `http://127.0.0.1:8085/login/oauth2/code/keycloak`
- Valid post logout redirect URIs: `http://127.0.0.1:8085/`
- Web origins: `http://127.0.0.1:8085`
- Client scopes **Default**: `nexora-semantic`, `nexora-intelligence`
- Mapper `principal_type=HUMAN` si no lo aporta ya un scope

Después se copia el secreto con `Set-NexoraConsoleSecret.ps1`. Opcionalmente, la página de login de Keycloak con la identidad Nexora (DEC-FE-LOGIN-1): imagen `nexora/keycloak:26.4.0-nexora.<n>` y `Set-NexoraLoginTheme.ps1`, solo para `nexora-console` (doc 03 §3.6; `nexora-deploy/docs/CONFIGURATION.md` §13). El BFF y esta imagen no cambian. Para instalaciones nuevas, un `Set-NexoraKeycloakConsole.ps1`
análogo a `Set-NexoraKeycloakIntelligence.ps1` puede proponerse aparte.

## 9. Construir y arrancar en Windows (paso a paso, desde `nexora-deploy`)

Ninguno de estos pasos recrea, detiene ni modifica contenedores existentes.

1. Revisar el Compose efectivo del servicio (sin ejecutar nada):
   `docker compose --profile frontend config frontend` (comparar con `deploy/evidence/compose-efectivo-frontend.json`).
2. Comprobar la red y la IP: `docker network inspect nexora_nexora-intelligence-edge --format "{{range .Containers}}{{.Name}} {{.IPv4Address}} {{end}}"`
   → solo `nexora-intelligence-edge-1 10.250.1.18/28` (o vacío si el perfil `intelligence` no está en marcha).
   Puerto libre: `Get-NetTCPConnection -LocalPort 8085 -State Listen -ErrorAction SilentlyContinue` → nada.
3. Diagnóstico OIDC (solo lectura): `Test-NexoraOidcReachability.ps1 -DeployDir . -Containers` (doc 13 §B).
4. Crear el cliente `nexora-console` en Keycloak (doc 03, §8) — **cuando lo autorices** (D-FE-3 no cubre Keycloak).
5. Secreto: `powershell -NoProfile -ExecutionPolicy Bypass -File "D:\desarrollo\Front-end\Nexora-front-end\deploy\Set-NexoraConsoleSecret.ps1" -DeployDir .`
6. Construir solo la imagen nueva: `docker compose --profile frontend build frontend`
7. Arrancar solo el frontend: `docker compose --profile tenant --profile intelligence --profile frontend up -d --no-deps frontend`
8. Estado y logs: `docker compose --profile frontend ps frontend` · `docker compose --profile frontend logs -f frontend`
9. Detener o retirar solo el frontend: `docker compose --profile frontend stop frontend` · `docker compose --profile frontend rm -s -f frontend`

`--no-deps` evita que Compose toque `keycloak`, `semantic` o `intelligence-edge`. Sin él, Compose solo arrancaría los
que estén parados (sus hashes no cambian, no se recrean), pero con `--no-deps` es explícito.

## 10. Verificación con evidencias (Windows)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\desarrollo\Front-end\Nexora-front-end\deploy\Test-NexoraFrontend.ps1" -DeployDir "D:\desarrollo\java\Nexora AI\nexora-deploy"
```

Comprueba y deja en un archivo de evidencias, sin mostrar secretos ni tokens:

- issuer accesible desde Windows;
- build de la imagen; ningún secreto en la imagen; usuario 10001;
- arranque, healthcheck y publicación solo en `127.0.0.1`;
- interfaz, `/bff/health` y 401 sin sesión;
- redirección a Keycloak: issuer público, `nexora-console`, PKCE S256 y `redirect_uri` exacta, con la página de login abriendo;
- desde el contenedor: metadatos internos con el mismo issuer, Semantic 401 sin token, Intelligence por el edge
  (`403 local_only` mientras no se aplique doc 13 §A; `401` después);
- logs sin secreto ni tokens.

Quedan para una persona: el login real, revisar identidad, roles y tenant en `/bff/session`, y F2–F4.

## 11. Evidencias

| Comprobación | Estado |
|---|---|
| Etapa `web` del Dockerfile ejecutada (npm ci 289 paquetes + tipos + Vite) con el contexto de la lista blanca, sin pruebas en la imagen | VERIFICADO aquí (base Node sustituta local, sin acceso a Docker Hub) |
| Etapas `bff` y ejecución | PENDIENTE-WINDOWS (Maven Central y Docker Hub no accesibles aquí) |
| Compose: sintaxis, perfiles, hashes idénticos de los 8 servicios existentes (perfiles explícitos y `COMPOSE_PROFILES`), `.env` actual válido, IP sin colisión en la configuración | VERIFICADO aquí; ocupación real de la red → §9 paso 2 |
| Archivos aplicados en `nexora-deploy` idénticos a los validados | VERIFICADO (SHA-256) |
| Secreto por archivo en contenedor read-only/uid 10001, ausente del entorno; `environment:` rechazado | VERIFICADO aquí (contenedor de prueba) |
| Colisión de IP sin dirección fija en `nexora-intelligence-edge` | VERIFICADO aquí (Docker 29) |
| Coherencia OIDC (issuer, endpoints) | VERIFICADO con pruebas unitarias; INFERIDO el formato real de Keycloak 26.4 → comprobación 6.1 |
| Build, arranque, health, interfaz, redirección, conectividad, logs | PENDIENTE-WINDOWS (`Test-NexoraFrontend.ps1`) |
| Identidad, roles, tenant tras login real; F2–F4 desde la interfaz | PENDIENTE (persona + cuenta autorizada) |

## 12. Diagnóstico del inicio de sesión

Desde 2026-11-11 el BFF deja evidencia de cada punto del retorno OAuth2 (sin tokens, cookies, ids de sesión ni
secretos):

| Punto | Evidencia en `docker compose --profile frontend logs frontend` | En el navegador |
|---|---|---|
| Callback aceptado (código canjeado, ID token válido, sesión creada) | `oidc login: callback accepted, session established` | redirección a `/` |
| Callback rechazado | `oidc login: callback refused: <código OAuth2>: <descripción>` (p. ej. `invalid_id_token`, `invalid_token_response`, `authorization_request_not_found`) | `/?login=failed` y aviso rojo en la pantalla de acceso |
| `/bff/session` sin sesión | — | `401` con `"reason":"not_signed_in"` |
| Sesión sin tokens (cliente no autorizado en la sesión) | `session not usable: reason=no_authorized_client` | `"reason":"no_authorized_client"` |
| Refresco o autorización fallidos | `session not usable: reason=authorization_failed error=<código>` | `"reason":"authorization_failed"` |
| Access token sin `sub` | `session not usable: reason=access_token_without_subject (... nexora-semantic must be a DEFAULT client scope ...)` | `"reason":"access_token_without_subject"` |
| Access token ilegible | `session not usable: reason=access_token_unreadable` | `"reason":"access_token_unreadable"` |

La razón se lee en las herramientas de desarrollo del navegador (Red → `/bff/session` → Respuesta) o abriendo
`http://127.0.0.1:8085/bff/session` tras el login. En el realm `nexora` (sin los scopes por defecto de Keycloak:
`profile`, `basic`…), `sub`, `tenant` y `roles` del access token **solo** los aporta el scope `nexora-semantic`: debe ser
scope **Default** de `nexora-console` (Keycloak → Clients → nexora-console → Client scopes → *Assigned type* = Default;
comprobable en la pestaña *Evaluate* → *Generated access token*).
