# D-006 · Plan de etapas de la versión administrativa

> Fuente canónica: `.factory/decisions/E1-D-006.md`. Este documento es su transcripción literal y no se edita a mano: solo cambia con una decisión nueva.

**Etapa:** E1 · **Estado:** aprobada en la puerta «arquitectura» de E1, 2026-11-11, huella `88155078cf9020fc`

## Contexto
La ficha pide proponer las etapas para construir la versión administrativa: gestión de reglas, tarjetas del diccionario semántico y chat para probar peticiones. Este plan aplica [D-001](./01-tecnologia.md) a [D-005](./05-base-visual.md).

Cómo están las API ([D-004](./04-consumo-de-api.md)):
- La del diccionario **existe**.
- La de reglas **no existe**.
- La del chat existe, pero **no se puede usar** desde el navegador fuera del entorno local.

El encargo de esta etapa no pide escribir `.factory/plan/plan.json`. Por eso el plan va aquí, con los campos de ese formato, para que el responsable lo vuelque con `factory.ps1 plan` cuando lo apruebe.

## Decisión

### Orden y dependencias
```
E1 ─▶ E2 ─┬─▶ E3 ─▶ E4 ─┬─▶ E6 ─▶ E7     (diccionario)
          │             ├─▶ E8           (reglas)
          └─▶ E5 ───────┴─▶ E9           (chat de pruebas)
```
- E5 va en paralelo con E3 y E4.
- E6, E8 y E9 van en paralelo entre sí.
- E3 → E4 es una cadena real: E4 añade el menú de usuario al shell que crea E3.

Prioridad de construcción: E2, E3 / E5, E4, E6, E7, E8, E9. El diccionario va antes porque es el único módulo con API real.

### E2 · Proyecto base y verificación de calidad
- **Depende de:** E1
- **Objetivo:** proyecto Angular creado según [D-001](./01-tecnologia.md), con las comprobaciones de [D-002](./02-estructura-y-capas.md) activas y sin pantallas de negocio.
- **Alcance:**
  - `ng new` con TypeScript estricto, *zoneless*, SCSS y Vitest.
  - ESLint con `angular-eslint`, `typescript-eslint` estricto, `eslint-plugin-boundaries` y `no-restricted-imports` de [D-002](./02-estructura-y-capas.md).
  - Prettier.
  - Presupuesto de *bundle*.
  - `environments/` con su interfaz tipada ([D-004](./04-consumo-de-api.md)).
  - `proxy.conf.json`.
  - Componente raíz vacío.
  - Prueba que demuestra que una importación entre módulos hace fallar el *lint*.
- **Fuera:** tema, shell, autenticación y cualquier módulo.
- **Criterios de aceptación:**
  - `ng build` termina sin errores ni avisos.
  - `ng lint --max-warnings=0` termina con 0 problemas.
  - `ng test` pasa.
  - La prueba de límites falla al importar `features/a` desde `features/b` y pasa sin esa importación.
  - `package.json` cumple todas las versiones mínimas de [D-001](./01-tecnologia.md), y Angular, Material, CDK y angular-eslint comparten *major*.
  - `tsconfig.json` tiene activas las opciones estrictas de [D-001](./01-tecnologia.md).
- **Rutas:** `package.json`, `package-lock.json`, `angular.json`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc*`, `.prettierignore`, `proxy.conf.json`, `src/**`, `tools/lint-fixtures/**`, `docs/**`, `.gitignore`, `.editorconfig`

### E3 · Tema visual, shell y componentes compartidos de interfaz
- **Depende de:** E2
- **Objetivo:** la aplicación muestra el marco definitivo (barra superior, menú lateral y área de contenido) con la paleta y la tipografía de [D-005](./05-base-visual.md).
- **Alcance:**
  - `styles/` (tokens, colores generados, tema y sobrescrituras).
  - Inter y Material Symbols servidos localmente.
  - `shell/` con el menú de tres entradas, que apuntan a rutas aún sin módulo y muestran «Próximamente».
  - Componentes de `shared/ui`: `page-header`, `loading-state`, `error-state`, `empty-state`, `simulated-data-notice` y `confirm-dialog`, con sus pruebas.
  - Página `/sin-permiso` (solo la vista).
- **Fuera:** autenticación (el menú de usuario es un hueco vacío) y cualquier llamada a API.
- **Criterios de aceptación:**
  - Los tokens del sistema `--mat-sys-primary` y `--mat-sys-on-primary` valen exactamente #7B1E34 y #FFFFFF; lo comprueba una prueba sobre los estilos calculados.
  - Ningún `.scss` fuera de `styles/` contiene colores literales.
  - Cada componente de `shared/ui` tiene pruebas de sus entradas y salidas.
  - La aplicación no hace peticiones a dominios externos al cargar (fuentes e iconos locales).
  - *Lint*, *build* y pruebas como en E2.
- **Rutas:** `src/styles/**`, `src/styles.scss`, `src/index.html`, `src/app/shell/**`, `src/app/shared/ui/**`, `src/app/app.routes.ts`, `src/app/app.ts`, `angular.json`, `package.json`, `package-lock.json`, `docs/**`

### E4 · Autenticación con Keycloak
- **Depende de:** E3
- **Objetivo:** nadie ve la aplicación sin sesión de Keycloak, y las peticiones a las API de Nexora llevan el token del usuario ([D-003](./03-autenticacion-keycloak.md)).
- **Alcance:**
  - Arranque con `keycloak-js` (`login-required`, PKCE) en `main.ts`.
  - Página estática «servicio de acceso no disponible».
  - `shared/auth`: `Session`, `permission.guard` y el *interceptor* limitado a `environment.apis`.
  - Menú de usuario con «Cerrar sesión».
  - Tratamiento de 401.
- **Fuera:** configuración del realm en Keycloak (tarea del backend, Duda 1 de [D-003](./03-autenticacion-keycloak.md)) y permisos por acción dentro de los módulos.
- **Criterios de aceptación:**
  - Sin sesión, ninguna ruta renderiza componentes de la aplicación; el navegador acaba en la URL de autorización de Keycloak con `code_challenge_method=S256`. Se prueba con un `keycloak-js` sustituido en las pruebas.
  - El *interceptor* añade `Authorization` solo a URL bajo `environment.apis.*.baseUrl`; una prueba lo verifica con una URL externa.
  - Ningún archivo del repositorio contiene `localStorage`/`sessionStorage` con tokens, ni secretos; lo comprueba una búsqueda en la revisión.
  - El *guard* redirige a `/sin-permiso` cuando falta el permiso; probado.
  - Con Keycloak caído aparece la página estática con «Reintentar».
- **Rutas:** `src/main.ts`, `src/index.html`, `src/app/app.config.ts`, `src/app/shared/auth/**`, `src/app/shell/**`, `src/environments/**`, `package.json`, `package-lock.json`, `docs/**`

### E5 · Acceso a datos común
- **Depende de:** E2
- **Objetivo:** existe la pieza común con la que todos los repositorios `http` convierten respuestas y errores de Nexora ([D-004](./04-consumo-de-api.md)).
- **Alcance:**
  - `shared/data`: tipo `NexoraError`, `toNexoraError()` (estado HTTP, *problem+json*, `X-Request-Id`), `Page<T>` y su conversión desde `PageResponse` de Semantic, y utilidades de `ETag`/`If-Match`.
- **Fuera:** repositorios de módulos y pantallas.
- **Criterios de aceptación:**
  - Cada variante de `NexoraError` tiene al menos una prueba que parte de una respuesta HTTP representativa: red caída, 401, 403, 404, 409, 412, 400 con *problem+json* con campos, 422, 500 y 503.
  - Cobertura de líneas de `shared/data` ≥ 90 %.
  - *Lint* y *build* sin avisos.
- **Rutas:** `src/app/shared/data/**`, `docs/**`

### E6 · Diccionario semántico: consulta de tarjetas
- **Depende de:** E4, E5
- **Objetivo:** el administrador elige una fuente de datos y consulta las tarjetas del diccionario (conceptos, métricas y dimensiones) con datos reales de Nexora Semantic.
- **Alcance:**
  - Módulo `features/dictionary` con sus tres capas.
  - Repositorio `http` (`GET /data-sources`, `GET …/definitions` con filtro por tipo y estado y paginación, `GET …/definitions/{id}`) y repositorio simulado.
  - Fachada.
  - Lista en forma de tarjetas, con filtro y paginación, y vista de detalle.
  - Ruta con `permission: semantic:catalog:read`.
- **Fuera:** crear, editar, aprobar y desactivar (E7), sugerencias y relaciones.
- **Criterios de aceptación:**
  - El módulo se carga bajo demanda: su *chunk* no está en el *bundle* inicial (informe de `ng build`).
  - La fachada tiene pruebas con el repositorio simulado: carga, filtro, paginación, error `unavailable` y lista vacía.
  - El repositorio `http` tiene pruebas con `HttpTestingController`.
  - Con la API parada, la sección muestra `error-state` con «Reintentar», y el resto de la aplicación sigue funcionando.
  - Con `data: 'simulated'`, aparece el aviso de datos de demostración.
  - Los componentes de `presentation/components` solo importan tipos de `application`; lo comprueba el *lint* de [D-002](./02-estructura-y-capas.md). Que no llamen a `inject()` lo verifica el revisor.
- **Rutas:** `src/app/features/dictionary/**`, `src/app/app.routes.ts`, `src/app/shell/**`, `src/environments/**`, `docs/**`

### E7 · Diccionario semántico: alta, edición, aprobación y desactivación
- **Depende de:** E6
- **Objetivo:** el administrador crea y edita tarjetas en borrador, y las aprueba o desactiva según sus permisos, con control de versiones.
- **Alcance:**
  - Formularios de alta y edición por tipo (concepto, métrica y dimensión).
  - `PUT` con `If-Match`.
  - `approve` y `deactivate` con diálogo de confirmación (y motivo en la desactivación).
  - Acciones visibles según `semantic:proposal:write` y `semantic:proposal:approve`.
  - Mensajes de `conflict` e `invalid`.
- **Fuera:** revisión de sugerencias automáticas y relaciones (se planificarán si el responsable las pide).
- **Criterios de aceptación:**
  - Pruebas de la fachada para crear, editar, aprobar, desactivar, `conflict` (412/409) e `invalid` con errores por campo.
  - Toda escritura envía `If-Match` con la versión cargada; una prueba de repositorio lo verifica.
  - Sin `semantic:proposal:approve`, no se muestran «Aprobar» ni «Desactivar».
  - Tras un error, el formulario conserva lo escrito.
- **Rutas:** `src/app/features/dictionary/**`, `docs/**`

### E8 · Gestión de reglas (con datos simulados)
- **Depende de:** E4, E5
- **Objetivo:** el administrador lista, crea, edita, activa y desactiva reglas sobre un repositorio simulado, listo para conectarse cuando exista la API.
- **Alcance:**
  - Módulo `features/rules` con sus tres capas.
  - Modelo provisional de [D-004](./04-consumo-de-api.md) (Duda 1).
  - Repositorio simulado con datos de ejemplo y el contrato `RulesRepository`.
  - Fachada.
  - Lista, detalle y formulario.
  - Aviso permanente de datos de demostración.
- **Fuera:** repositorio `http`, porque la API no existe (ver «En espera»).
- **Criterios de aceptación:**
  - El aviso «Datos de demostración…» está presente en todas las pantallas del módulo; probado.
  - Pruebas de la fachada para listar, crear, editar, activar, desactivar y validación.
  - El módulo no importa de `dictionary` ni de `test-chat` (*lint*).
  - Su *chunk* no está en el *bundle* inicial.
- **Rutas:** `src/app/features/rules/**`, `src/app/app.routes.ts`, `src/app/shell/**`, `src/environments/**`, `docs/**`

### E9 · Chat de pruebas de peticiones
- **Depende de:** E4, E5
- **Objetivo:** el administrador escribe una pregunta en lenguaje natural, elige la fuente de datos y ve la respuesta de Nexora: informe, aclaración pedida, no soportada o rechazo.
- **Alcance:**
  - Módulo `features/test-chat` con sus tres capas.
  - Contrato `TestChatRepository` con la forma de `POST /api/v1/questions`.
  - Repositorio simulado con respuestas de cada tipo.
  - Repositorio `http`, activable solo en `environment.development.ts` ([D-004](./04-consumo-de-api.md), Duda 2).
  - Historial de la conversación **solo en memoria**.
  - Vista de la respuesta: tabla de resultados y mensaje de aclaración.
- **Fuera:** guardar conversaciones, exportar resultados y uso del chat en entornos que no sean el local con la API real.
- **Criterios de aceptación:**
  - Pruebas de la fachada para cada tipo de respuesta y para `unavailable`.
  - El envío se bloquea mientras hay una pregunta en curso.
  - Una pregunta de más de la longitud máxima del backend se rechaza antes de enviarla.
  - `environment.ts` tiene `testChat.data = 'simulated'`; lo verifica una prueba.
  - El aviso de datos de demostración aparece en modo simulado.
- **Rutas:** `src/app/features/test-chat/**`, `src/app/app.routes.ts`, `src/app/shell/**`, `src/environments/**`, `docs/**`

### En espera (sin identificador)
- **Reglas conectadas a Nexora.** Espera a que exista una API de reglas en el backend con contrato publicado ([D-004](./04-consumo-de-api.md), Duda 1).
- **Chat de pruebas contra la API real fuera del entorno local.** Espera a que Nexora Intelligence publique un endpoint de preguntas que autentique al usuario con su token de Keycloak y sea accesible desde fuera de *loopback*.
- **Despliegue de Nexora UI** (*proxy* inverso del mismo origen, configuración por entorno). Espera a que el responsable abra el alcance de despliegue, que en E1 está fuera.

## Alternativas descartadas
- **Una etapa por módulo sin etapas de base (E2–E5 dentro de la primera funcionalidad).** La primera etapa de módulo cargaría con la creación del proyecto, el tema, la autenticación y los datos comunes. Sería demasiado grande para revisarla de una vez, y mezclaría decisiones transversales con un módulo concreto (**Limpio**).
- **Una sola etapa de diccionario con lectura y escritura.** La escritura añade versiones, permisos por acción y la regla de aprobación por otra persona. Separarla permite entregar antes la consulta con la API real, y cada etapa queda revisable por sí sola.
- **Esperar a que exista la API de reglas y la del chat autenticado.** Bloquearía dos de las tres funciones que pide la ficha. El criterio **Datos** prevé justamente el repositorio simulado para este caso.

## Consecuencias
- Las etapas de módulo (E6, E8 y E9) tocan `app.routes.ts` y el menú de `shell/` solo para añadir **su** entrada. Si se ejecutan en paralelo, puede haber conflictos de *merge* triviales en esas dos líneas, y los resuelve quien integra.
- `docs/**` está en las rutas de todas las etapas para que cada una deje su documentación. En E1, la propuesta transcribe [D-001](./01-tecnologia.md) a D-006 a `docs/arquitectura/` (única ruta permitida por `alcance.json`).
- No cambia ninguna decisión vigente.

## Dudas para el responsable
1. ¿Quieres que vuelque este plan a `.factory/plan/plan.json`? Recomiendo hacerlo después de aprobar la puerta «arquitectura», para que las etapas se creen sobre decisiones aprobadas.
2. ¿Hay que incluir en esta versión la revisión de **sugerencias automáticas** del diccionario (`/suggestions`, aceptar o rechazar)? El backend ya las tiene. Recomiendo dejarlas para una etapa posterior a E7, porque la ficha solo nombra las tarjetas.
