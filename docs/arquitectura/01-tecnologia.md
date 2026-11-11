# D-001 · Tecnología base de Nexora UI

> Fuente canónica: `.factory/decisions/E1-D-001.md`. Este documento es su transcripción literal y no se edita a mano: solo cambia con una decisión nueva.

**Etapa:** E1 · **Estado:** aprobada en la puerta «arquitectura» de E1, 2026-11-11, huella `88155078cf9020fc`

## Contexto
Nexora UI es una aplicación web solo para administradores. Debe gestionar reglas, tarjetas del diccionario semántico y un chat para probar peticiones contra Nexora. El repositorio solo contiene la configuración de la fábrica: no hay código ni dependencias, y no hay decisiones vigentes en `.factory/decisions/`.

Los criterios del proyecto (`.factory/criteria.md`) piden cosas muy concretas:
- **Estructura:** módulos por funcionalidad, cada uno con presentación, aplicación y datos.
- **Escalable:** los módulos se cargan bajo demanda.
- **Estado:** una fachada por módulo.
- **Datos:** el repositorio se puede sustituir por una implementación simulada.
- **Visual:** los componentes salen de una sola librería.
- **Profesional:** tipado estricto, cero avisos del analizador y pruebas de la lógica.
- **Simple:** ninguna pieza que la etapa no necesite.

Leído en modo consulta, el backend de Nexora (`D:\desarrollo\java\Nexora AI`) muestra:
- Usa Spring Boot y Keycloak (realm `nexora`).
- Expone API REST JSON bajo `/api/v1`, con documentos de error *problem+json*.
- Controla la concurrencia optimista con `ETag`/`If-Match`.
- Pagina con `page`/`size`.

## Decisión

| Pieza | Elección | Versión mínima | Motivo frente a los criterios |
|---|---|---|---|
| Entorno de ejecución de herramientas | Node.js LTS | 22.12 | Es la versión que exige Angular 21. Solo se usa para construir; la aplicación no tiene servidor propio. |
| Framework | Angular, con componentes *standalone*, sin Zone.js (*zoneless*) y con `ChangeDetectionStrategy.OnPush` en todos los componentes | 21.0 | **Estructura/Escalable:** las rutas con `loadChildren` cargan cada módulo bajo demanda sin librerías extra. **Datos:** la inyección de dependencias nativa permite declarar el repositorio como clase abstracta y elegir la implementación real o la simulada en el proveedor de la ruta, sin tocar pantallas ni fachadas. **Estado:** las *signals* nativas bastan para la fachada, sin librería de estado. **Simple:** router, HTTP, formularios, DI y pruebas vienen en el mismo framework. |
| Lenguaje | TypeScript con `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`, y en Angular `strictTemplates`, `strictInjectionParameters` y `strictInputAccessModifiers` | 5.9 | **Profesional:** tipado estricto también en las plantillas. 5.9 es la versión que admite Angular 21. |
| Librería de componentes | Angular Material + Angular CDK (tema Material 3) | 21.0, el mismo *major* que Angular | **Visual:** una sola librería, mantenida por el equipo de Angular y con el mismo calendario de versiones. La paleta y la tipografía se definen con tokens (`mat.theme`), sin hojas de estilo paralelas. Incluye tabla, paginador, formularios y diálogos accesibles, que es lo que piden las tres funciones. |
| Pruebas | Vitest con el *builder* `@angular/build:unit-test` (por defecto en Angular 21) y entorno `jsdom`. En los componentes se usan los *harnesses* de Angular CDK. | Vitest 4.0, jsdom 26 | **Profesional:** pruebas automáticas de la lógica (fachadas, repositorios y mapeo de errores) y de los componentes. Es la herramienta integrada del framework, así que no hace falta configuración aparte de Karma ni de Jest. |
| Analizador | ESLint (*flat config*) con `angular-eslint` y `typescript-eslint` en su conjunto `strictTypeChecked` + `stylisticTypeChecked`. Se ejecuta con `--max-warnings=0`. | ESLint 9.0, angular-eslint 21.0, typescript-eslint 8.0 | **Profesional:** sin errores ni avisos, con reglas que usan el tipado. Incluye las reglas de plantillas Angular, entre ellas la accesibilidad (`templateAccessibility`). |
| Reglas de dependencia entre capas | `eslint-plugin-boundaries` más la regla nativa `no-restricted-imports` (ver [D-002](./02-estructura-y-capas.md)) | eslint-plugin-boundaries 5.0 | **Limpio:** la dirección de las dependencias se comprueba automáticamente en el mismo paso de *lint*, sin otra herramienta. |
| Formato | Prettier | 3.3 | **Profesional/nombres consistentes:** un único formato sin discusión. ESLint no lleva reglas de formato (se usa `eslint-config-prettier`, 9.0) para que las dos herramientas no se pisen. |
| Autenticación | `keycloak-js` (ver [D-003](./03-autenticacion-keycloak.md)) | 26.0 | **Seguridad:** el adaptador oficial de Keycloak, con PKCE y tokens en memoria. |
| Tipografía | `@fontsource-variable/inter` (ver [D-005](./05-base-visual.md)) | 5.0 | **Visual:** la misma fuente en todos los sistemas, servida desde la propia aplicación y sin CDN externos. |
| Iconos | `material-symbols` (variante *Outlined*), servidos desde la propia aplicación | 0.27 | **Visual:** el mismo lenguaje visual que Angular Material, sin CDN externos. |

Reglas de uso:
1. No se añade **ninguna otra dependencia de ejecución** sin una decisión escrita. En concreto, quedan fuera de esta versión NgRx, Tailwind, librerías de gráficos, i18n y pruebas *end-to-end*.
2. Al crear el proyecto (E2) se instala la **última versión estable** de cada pieza que cumpla la mínima. Angular, Angular Material, Angular CDK y angular-eslint van siempre en el **mismo *major***.
3. Estilos en SCSS, porque es el que exige el sistema de temas de Angular Material. No se usa CSS-in-JS.
4. Se sigue la guía de estilo oficial de Angular de la versión instalada: nombres de archivo, `inject()` en lugar de constructor, `input()`/`output()` y control de flujo `@if`/`@for`.

## Alternativas descartadas
- **React 19 + Vite + MUI.** Es un buen ecosistema, pero React es solo la capa de vista. El enrutado con carga bajo demanda, la inyección del repositorio sustituible y la fachada de estado obligarían a elegir e integrar varias librerías (router, contexto o contenedor de DI, gestor de estado, formularios). Eso son más piezas y más decisiones, y choca con **Simple**. Además, el criterio **Estado** quedaría a convención en lugar de apoyarse en el framework.
- **Vue 3 + Vite + Vuetify.** Está más cerca de Angular en lo que trae de serie (router, Pinia), pero no tiene inyección de dependencias por ruta. Sustituir un repositorio por su simulado exigiría un mecanismo propio, lo que perjudica a **Datos** y a **Simple**.
- **PrimeNG como librería de componentes.** Tiene más componentes, pero su calendario de versiones es independiente del de Angular y su sistema de temas es otro paralelo. Las tres funciones de esta versión se cubren con Angular Material, así que la amplitud extra no se usaría (**Eficiente**, **Simple**).
- **Jest o Karma/Jasmine para pruebas.** Karma está retirado del flujo por defecto de Angular. Jest necesita un preset de la comunidad. Vitest es lo que el framework integra.
- **dependency-cruiser para las capas.** Es más potente para analizar grafos, pero sería una segunda herramienta con su propia configuración y su propio paso en la verificación. `eslint-plugin-boundaries` cubre las reglas de [D-002](./02-estructura-y-capas.md) dentro del *lint* que ya es obligatorio.

## Consecuencias
- E2 crea el proyecto con `ng new` usando estas piezas. Ninguna etapa posterior puede añadir dependencias de ejecución sin una decisión nueva.
- Con *zoneless* y `OnPush`, el estado de la interfaz va siempre en *signals*. No funcionan los patrones que dependen de la detección de cambios automática de Zone.js.
- Las versiones mínimas se comprueban en E2 contra el `package.json` generado.
- No cambia ninguna decisión vigente: no había ninguna.
