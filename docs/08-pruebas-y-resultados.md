# 8. Pruebas y resultados

Resultados **reales** obtenidos el 2026-11-11 en el entorno de trabajo de Claude (Linux, Node 22, Java 21). No son
pruebas contra los servicios reales ni contra Wellnode.

## 8.000 Creación asistida de conceptos (F2), 2026-11-17

Entorno de Claude, datos sintéticos; **no** son pruebas contra Semantic, Intelligence ni el modelo reales.

| Comprobación | Antes | Después |
|---|---|---|
| `tsc --noEmit` | 0 errores | **0 errores** |
| `vitest run` | 15 archivos, 84 pruebas | **16 archivos, 89 pruebas, 89 superadas** (`features/concepts/ConceptAssistPage.test.tsx`, 5) |
| `vite build` | correcto | **correcto** |
| BFF, JUnit | 38/38 | **40/40** (`KnowledgeRequestProxyTest` +1, `SemanticProxyTest` +1: `relation-context` no accesible) |
| Accesibilidad (axe-core 4.10.2, claro y oscuro) | — | **14/14** pantallas nuevas sin infracciones (corregidos el contraste de una insignia y de tres avisos); **14/14** de F1 y **26/26** del diccionario siguen sin infracciones |

## 8.00 Creación asistida (F1), 2026-11-17

Resultados reales en el entorno de Claude con datos sintéticos (D11); **no** son pruebas contra Semantic, Intelligence
ni el modelo reales: la validación funcional con Wellnode la coordina el usuario.

| Comprobación | Antes | Después |
|---|---|---|
| `tsc --noEmit` | 0 errores | **0 errores** |
| `vitest run` | 14 archivos, 78 pruebas | **15 archivos, 84 pruebas, 84 superadas** (`features/assisted/AssistedPage.test.tsx`, 6) |
| `vite build` | correcto | **correcto** |
| BFF, JUnit (mismas bibliotecas que §8.0) | 34/34 | **38/38** (`KnowledgeRequestProxyTest` 3, `SemanticProxyTest` +1) |
| Accesibilidad (axe-core 4.10.2, build de producción, claro y oscuro) | 26/26 | **26/26 + 14/14** pantallas nuevas sin infracciones (petición, aclaración, propuestas, guardado y existente, error, entrada en el diccionario, sugerencia asistida); corregido el contraste de dos insignias y dos avisos |

Qué comprueban las pruebas nuevas:

- `AssistedPage.test.tsx`: el caso de aceptación con datos sintéticos (concepto nombrado → reutilizado; «cada …» →
  pregunta con «Ninguna de estas»; conteo propuesto; nombre y descripción de plantilla; confirmación obligatoria; cuerpo
  exacto de `confirm`; borrador con enlace; la repetición dice «ya existe»; ninguna clave ni nombre físico en pantalla);
  una agrupación elegida por el modelo exige la confirmación expresa; errores de interpretación; propuesta bloqueada
  por un rechazo anterior; entrada solo para quien puede proponer; un `VIEWER` no ve ni la entrada ni la página.
- `KnowledgeRequestProxyTest`: solo `EDITOR`/`APPROVER`, solo fuentes configuradas del tenant, token de la persona, sin
  cookies ni cabeceras de reenvío; problemas de Intelligence sin cambios.
- `SemanticProxyTest`: `knowledge-proposals` y `confirm` se reenvían; `knowledge-context` **no** es accesible desde el
  navegador.

## 8.0 Administración del diccionario (B1–B4), 2026-11-17

Resultados reales en el entorno de Claude (Linux, Node 22, Java 21), con datos sintéticos (D11). **No** son pruebas
contra Semantic real: la validación funcional (B6) la coordina el usuario tras el despliegue.

| Comprobación | Antes | Después |
|---|---|---|
| `tsc --noEmit` | 0 errores | **0 errores** |
| `vitest run` | 11 archivos, 52 pruebas | **14 archivos, 78 pruebas, 78 superadas** (2 pruebas de la conducta anterior sustituidas: «APPROVED no editable» → B4; «relaciones no aceptables» → B3) |
| `vite build` | correcto | **correcto** |
| BFF, JUnit 5 compilado y ejecutado contra las bibliotecas del propio JAR del BFF (Spring Boot 4.1.1, Spring Security 7.1.1, incluido `spring-security-oauth2-client`) y las de prueba del repositorio Maven local (JUnit 6.0.3, spring-test 7.0.9, spring-security-test 7.1.1, AssertJ 3.27.7), sin *stubs* | 32/32 (línea base repetida) | **34/34** |
| Accesibilidad: axe-core 4.10.2 (WCAG 2.0/2.1 A y AA) sobre el **build de producción** servido con un BFF simulado en el navegador, tema claro y oscuro | — | **26/26 pantallas sin infracciones** (tras corregir: pestañas sin panel → enlaces con `aria-current`; contraste de los textos de ayuda → token `text-secondary`) |
| Revisión visual de capturas | — | corregidos: lista de consecuencias recortada en el diálogo; insignias truncadas en la tabla |

Pantallas de la comprobación de accesibilidad (×2 temas): lista de relaciones; detalle (resumen, estructura,
problemas, historial); aprobar con aviso de autoaprobación; nueva relación manual y desde candidatas; consecuencias de
corregir una relación y una definición aprobadas; lista de definiciones; detalle de una sugerencia de relación;
aceptarla con corrección.

Pruebas nuevas o ampliadas:

- `shared/ProblemAlert.test.tsx` — los 24 códigos reales de Semantic (en minúsculas) y los 9 del BFF tienen texto
  propio; mayúsculas equivalentes; desconocido → genérico; `422` lista cada problema con el código traducido.
- `features/dictionary/lifecycle.test.ts` — B4: `correct` en APPROVED; separación editor/aprobador como SEC-1/SEC-2.
- `features/dictionary/DictionaryPage.test.tsx` — corregir una aprobada exige confirmar las cuatro consecuencias y
  envía `PUT` con `If-Match`; aviso de autoaprobación solo para lo propio («Tú»); crear con exactamente los campos de
  `CreateDefinitionRequest`; `412` → recargar; `422` con problemas; un `VIEWER` sin acciones ni historial.
- `features/relationships/model.test.ts` — límites de Semantic (1–16 parejas completas y distintas, nombre, tipos de
  unión); cuerpos exactos de crear, crear desde FK (nombre omitido) y editar; candidata FK → `DECLARED_FK`.
- `features/relationships/RelationshipsPage.test.tsx` — listar, buscar y filtrar; crear manual y desde FK; editar
  (solo campos editables, `If-Match`), aprobar, rechazar con motivo; corregir una aprobada con confirmación; `412`,
  `409 relationship_equivalent_exists`, `403`; un `VIEWER` sin acciones.
- `features/suggestions/SuggestionsPage.test.tsx` — aceptar una relación envía siempre `result: "DRAFT"`, la
  declaración y los pendientes; con corrección (origen fijo); concepto solo de la tabla de la sugerencia; corrección
  de dimensión (tipo solo si cambia, granularidades, zona); motivo de rechazo hasta 2000; historial de auditoría solo
  con `AUDIT_READ` y «Tú» en la decisión.
- BFF `SemanticProxyTest` — rutas de relaciones permitidas y las bloqueadas (`contract`, `suggestion-runs`,
  `snapshots`, `DELETE`, `PATCH`…); `If-Match`/`ETag` y token del usuario; fuente de otro tenant → 403; **D-B**:
  aceptar una sugerencia sin `"result":"DRAFT"` exacto (falta, `APPROVED`, minúsculas, `null`, no JSON, vacío) →
  `422 bff_draft_required` sin llegar a Semantic. `SecurityRulesTest` — la sesión incluye `subject`.

## 8.1 Web (`web/`)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` (TypeScript estricto) | 0 errores |
| `vitest run` | **11 archivos, 52 pruebas, 52 superadas** (2026-11-11, DEC-D-FE-1: textos de `local_only` y `authentication_required`, causa solo para diagnóstico, y un 401 de un servicio ya no cierra la sesión) |
| `vite build` | correcto; chunks: mantine 410 kB, data 244 kB, index 93 kB, react 23 kB, icons 15 kB (sin aviso de tamaño) |
| Accesibilidad automática (axe-core 4.10, reglas WCAG 2 A/AA) sobre el build servido con datos sintéticos: inicio, diccionario, detalle, sugerencias, chat con aclaración | **0 infracciones** (tras corregir contraste de insignias/botones, nombre del botón de cerrar y foco en bloques desplazables) |
| Vista móvil 390 px | sin desplazamiento horizontal |

Pruebas (todas con datos sintéticos y MSW, D11):

- `api/http.test.ts` — CSRF solo en escrituras; 401 → sesión terminada; problema → `ApiError`; ETag.
- `api/intelligence.test.ts` — clave de idempotencia; Excel con cabeceras; aclaración; 422 con explicación;
  resultado desconocido (BFF y red).
- `features/chat/chatModel.test.ts` — ocupado/pendiente; reinicio conserva reportes; estados de aclaración; caducidad.
- `features/chat/ChatPage.test.tsx` — **F2** (aclaración → opción con clave nueva → Excel), **F3/F4** (explicación
  de negocio), reintento con **misma clave y cuerpo**, caducidad informada por Intelligence, reportes de la sesión (D8).
- `features/dictionary/lifecycle.test.ts`, `formModel.test.ts` — D4/D5/D6, validaciones iguales a Semantic.
- `features/dictionary/DictionaryPage.test.tsx` — búsqueda; aprobar con `If-Match`; rechazar exige motivo y
  desactiva; APPROVED no editable y sin borrado.
- `features/suggestions/SuggestionsPage.test.tsx` — aceptar envía `result: "DRAFT"` y `acknowledgedPending` (D10) y
  abre el borrador; relaciones no aceptables.
- `app/Shell.test.tsx` — navegación según permisos, diagnóstico oculto (D9), pantalla de acceso, sesión terminada sin
  bucle de 401.
- `app/theme/contrast.test.ts` — 18 pares de color ≥ 4.5:1 (claro y oscuro).
- `app/theme/noHardcodedColors.test.ts` — ningún color fuera de `src/app/theme`.

## 8.2 BFF (`bff/`)

| Comprobación | Resultado |
|---|---|
| Compilación Java 21 del código principal y de pruebas | correcta |
| JUnit 5 (32 pruebas: `SecurityRulesTest`, `ReportRequestProxyTest`, `SemanticProxyTest`, `IdentityTest`, `ProviderDiscoveryTest`, `SessionDiagnosticsTest`) | **32 superadas, 0 fallos** (2026-11-11, tras `scope=openid` y el diagnóstico del inicio de sesión) |

**Limitación del entorno:** Maven Central no es accesible desde el entorno de trabajo, por lo que **no se ejecutó
`mvn verify`**. Se compiló y probó con `javac` y JUnit Platform contra los jars de Spring Boot 4.1.1 / Spring
Security 7.1.1 disponibles localmente; las clases de `spring-security-oauth2-client` (no disponibles localmente) se
compilaron contra *stubs* que **no forman parte del entregable**. Por eso:

- `OidcSecurityConfig` y `OidcLogout` (las dos únicas clases que usan el cliente OAuth2) no se ejecutaron en pruebas.
- Los nombres de los *starters* de Spring Boot 4 en `pom.xml` (`spring-boot-starter-webmvc`,
  `spring-boot-starter-security-oauth2-client`, `spring-boot-starter-webmvc-test`) son **INFERIDOS** y deben
  confirmarse con `mvn -B clean verify -Pwith-web` en Windows (doc 05). Si Maven no los resuelve, el ajuste se limita
  al `pom.xml`.

Pruebas del BFF: sesión y 401 JSON, CSRF obligatorio y cookie emitida, cabeceras de seguridad, permisos por rol,
D9, solo principales humanos con tenant, F2/F3/F4 reenviados con el token del usuario y la misma clave, Excel byte a
byte con sus cabeceras, timeout = `UNKNOWN`, servicio caído = `NOT_SENT`, fuentes por tenant (D7), lista cerrada de
rutas de Semantic, `If-Match`/`ETag`/`Location`.

## 8.3 Docker

Ver doc 12 §11: etapa `web` del Dockerfile ejecutada; Compose validado y aplicado en `nexora-deploy` (hashes
idénticos de los servicios existentes, `deploy/evidence/`); secreto por archivo y colisión de IP comprobados con
contenedores de prueba. Etapas `bff`/ejecución,
arranque real, healthcheck, redirección y conectividad: pendientes en Windows (`deploy\Test-NexoraFrontend.ps1`).

## 8.4 No ejecutado

- **F1 con Wellnode** (Semantic, Intelligence y el modelo reales; prueba de aceptación «contar cuántos logs tiene cada
  pozo»): pendiente del usuario tras desplegar las imágenes. No se declara validada hasta superarla.

- **B6 (administración del diccionario contra Semantic real en Docker)**: pendiente del usuario tras el despliegue.
  No se declara la integración funcional completada hasta superarla.
- `mvn -B clean verify` del BFF en Windows (los 34 JUnit se ejecutaron aquí con las mismas bibliotecas, pero no con
  Maven).
- Flujo real con Keycloak, Semantic e Intelligence (requiere el cliente `nexora-console` y configuración).
- E2E Playwright reales (`web/e2e/chat-real.spec.ts`): preparados, **no ejecutados**.
- Ninguna prueba con Wellnode.
