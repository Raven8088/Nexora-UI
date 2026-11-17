# 1. Arquitectura

```
Navegador (SPA React)                BFF (Spring Boot, 127.0.0.1:8085)                 Servicios existentes
────────────────────                 ─────────────────────────────────                 ────────────────────
 /            (SPA estática)  ───▶   SpaWebConfig (index.html + assets)
 /oauth2/authorization/keycloak ──▶  oauth2Login (Authorization Code + PKCE S256) ───▶  Keycloak realm nexora
 /login/oauth2/code/keycloak  ◀───   (cliente confidencial nexora-console)
 /bff/session  /bff/logout   ───▶   SessionController (identidad, permisos, fuentes)
 /bff/api/semantic/**         ───▶   SemanticProxyController ── Bearer token USUARIO ─▶  Nexora Semantic
 /bff/api/report-requests     ───▶   ReportRequestProxyController ─ Bearer USUARIO ──▶  Nexora Intelligence (HAProxy)
   cookie NEXORA_CONSOLE_SESSION (HttpOnly) + XSRF-TOKEN / X-XSRF-TOKEN
```

## Decisiones aplicadas

| Id | Decisión | Dónde |
|---|---|---|
| D1 | SPA + BFF | `web/`, `bff/` |
| D2 | React 18, TS estricto, Vite, Mantine 7, TanStack Query/Table, RHF, Zod, i18next, Vitest, Testing Library, MSW, Playwright; Java 21, Spring Boot, Spring Security, OIDC | `web/package.json`, `bff/pom.xml` |
| D3 | Authorization Code + PKCE; tokens solo en el BFF; cookie de sesión segura; CSRF; mismo origen | `security/OidcSecurityConfig`, `security/SecurityRules`, `api/http.ts` |
| D4 | Definición APPROVED: edición deshabilitada con motivo; DRAFT editable; revisión paralela documentada como mejora futura | `features/dictionary/lifecycle.ts`, doc 07 |
| D5 | Rechazar borrador = desactivar con motivo obligatorio | `DefinitionDrawer`, `ConfirmDialog` |
| D6 | Sin DELETE ni botones que lo parezcan | `lifecycle.ts`, `SemanticRoutes` (no hay ruta DELETE) |
| D7 | Fuentes configuradas en el BFF por tenant; el selector solo muestra las autorizadas | `sources/SourceRegistry`, `SourceContext` |
| D8 | Excel en memoria durante la sesión, con aviso discreto | `ChatProvider`, `SessionReportsPage` |
| D9 | Diagnóstico solo para `PLATFORM_ADMIN` (configurable), aplicado también en el BFF; sin tokens | `Permissions`, `ReportRequestProxyController`, `DiagnosticsPanel` |
| D10 | Aceptar sugerencia → siempre `result: DRAFT` | `acceptSuggestionAsDraft` |
| D11 | Pruebas con datos sintéticos; E2E real solo con claves controladas | `src/test/fixtures.ts`, `e2e/` |
| D12 | Correcciones de evidencia de otros repos registradas aquí, no aplicadas | doc 10 |

## BFF

- **Identidad.** `TokenClaims` lee del access token del usuario `roles`, `tenant` y `principal_type` (nombres
  configurables). Solo `principal_type=HUMAN` obtiene permisos en la consola; sin `tenant` no hay acceso a datos.
- **Permisos** (`security/Permissions`), derivados de los roles reales de Semantic/Intelligence:

  | Permiso de consola | Roles |
  |---|---|
  | chat | `REPORT_REQUESTER` |
  | catalogRead | `VIEWER`, `EDITOR`, `APPROVER`, `STEWARD`, `AUDITOR`, `REPORTS_CLIENT`, `AI_AGENT` |
  | proposalWrite | `EDITOR`, `APPROVER`, `AI_AGENT` |
  | approve | `APPROVER` |
  | audit | `AUDITOR` |
  | diagnostics | `nexora.bff.diagnostics.roles` (por defecto `PLATFORM_ADMIN`) |

  Son un filtro previo: Semantic e Intelligence vuelven a decidir con el mismo token.
- **Proxy con lista cerrada** (`SemanticRoutes`): solo las operaciones de la tabla del doc 02; rechaza `..`, `%`,
  `//` y consultas con caracteres fuera de `[A-Za-z0-9_=&.-]`. La fuente (`dataSourceId`) debe estar configurada
  para el tenant del usuario.
- **Cabeceras.** Petición: solo `Content-Type`, `Accept`, `If-Match`, `Idempotency-Key` (+ `Authorization` del
  usuario). Respuesta: `Content-Type`, `ETag`, `X-Request-Id`, `Content-Disposition`, `X-Nexora-Completeness`,
  `X-Nexora-Warnings`, `X-Nexora-Artifact-Sha256`; `X-Nexora-Run-Id` y `X-Nexora-Report-Plan-Id` solo para
  diagnóstico. Siempre `Cache-Control: no-store`.
- **Fallos sin respuesta.** `BffProblem` con `origin: "bff"` y `outcome`: `NOT_SENT` (503, la petición no salió:
  se puede reintentar), `UNKNOWN` (504/502, pudo procesarse: se reintenta con la **misma** clave de idempotencia),
  `REFUSED` (403/400 del propio BFF).
- **Cabeceras de seguridad**: CSP `default-src 'self'` (sin scripts externos), `frame-ancestors 'none'`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.

## Web

- `src/app` — proveedores, rutas, marco (`Shell`) y **sistema de diseño** (`theme/tokens.ts` es el único lugar con
  colores).
- `src/api` — cliente del BFF (`http.ts`), Intelligence (`intelligence.ts`) y Semantic (`semantic.ts`, validado con
  Zod en `semanticTypes.ts`; los campos desconocidos se conservan).
- `src/auth`, `src/context` — sesión (pantalla de acceso y de sesión terminada) y fuente seleccionada.
- `src/features` — `chat`, `reports`, `dictionary`, `suggestions`, `home`, `settings`.
- `src/i18n` — español completo; inglés y francés preparados (sin traducir, caen a español).
- Nada se guarda en `localStorage` salvo preferencias (idioma, tema, alias de fuente). Nunca tokens.
