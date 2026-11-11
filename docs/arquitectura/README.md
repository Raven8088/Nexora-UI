# Arquitectura de Nexora UI

Nexora UI es la aplicación web administrativa de Nexora. Esta versión es solo para administradores y cubre tres
funciones: gestión de reglas, tarjetas del diccionario semántico y un chat para probar peticiones contra Nexora.

Esta carpeta recoge la arquitectura decidida en la etapa E1 y aprobada en la puerta «arquitectura» el 2026-11-11
(huella `88155078cf9020fc`). Cada documento es la transcripción literal de una decisión de `.factory/decisions/`, que es
la fuente canónica. Los documentos no se editan a mano: solo cambian con una decisión nueva.

## Decisiones

| Documento | Decisión | Resumen |
|---|---|---|
| [01-tecnologia.md](./01-tecnologia.md) | D-001 · Tecnología base | Angular 21 *standalone* y *zoneless*, TypeScript 5.9 estricto, Angular Material/CDK 21, Vitest 4, ESLint 9 con angular-eslint, typescript-eslint y eslint-plugin-boundaries, y Prettier 3.3. Cada pieza tiene versión mínima y motivo. |
| [02-estructura-y-capas.md](./02-estructura-y-capas.md) | D-002 · Estructura de carpetas, capas y reglas de dependencia | Organización por funcionalidades en `features/<module>/` con capas `presentation`, `application` y `data`, más `shell/` y `shared/`. Las dependencias se comprueban con `ng lint`. |
| [03-autenticacion-keycloak.md](./03-autenticacion-keycloak.md) | D-003 · Autenticación con Keycloak | Cliente público `nexora-ui` con Authorization Code y PKCE (`S256`), `login-required` y tokens solo en memoria. Sin sesión no se ve la aplicación. |
| [04-consumo-de-api.md](./04-consumo-de-api.md) | D-004 · Consumo de las API de Nexora | Un repositorio por módulo con implementación `http` y simulada, errores normalizados en `NexoraError` y los mensajes que ve el administrador cuando una API no existe o no responde. |
| [05-base-visual.md](./05-base-visual.md) | D-005 · Base visual | Paleta blanco y vino tinto (#7B1E34) con sus tokens, Inter Variable, escala de espaciado, composición del shell y accesibilidad mínima. |
| [06-plan-de-etapas.md](./06-plan-de-etapas.md) | D-006 · Plan de etapas | Etapas E2 a E9, cada una con objetivo y criterios de aceptación: diccionario (E6, E7), reglas (E8) y chat de pruebas (E9). |

## Criterios de arquitectura y dónde se cumplen

Los criterios son los de `.factory/criteria.md`.

| Criterio | Dónde se cumple |
|---|---|
| Limpio | [D-002](./02-estructura-y-capas.md), «Capas y sentido de las dependencias» y «Comprobación automática»; [D-001](./01-tecnologia.md), fila «Reglas de dependencia entre capas» de la tabla «Decisión». |
| Escalable | [D-002](./02-estructura-y-capas.md), «Añadir un módulo nuevo»; [D-001](./01-tecnologia.md), fila «Framework» (carga con `loadChildren`). |
| Eficiente | [D-002](./02-estructura-y-capas.md), «Comprobación automática» (`no-restricted-imports` y presupuesto de compilación); [D-001](./01-tecnologia.md), «Reglas de uso»; [D-003](./03-autenticacion-keycloak.md), «Alternativas descartadas» (`keycloak-angular`). |
| Profesional | [D-001](./01-tecnologia.md), filas «Lenguaje», «Pruebas», «Analizador» y «Formato» de la tabla «Decisión». |
| Visual | [D-005](./05-base-visual.md), «Paleta», «Tema de Angular Material», «Tipografía» y «Espaciado y forma»; [D-001](./01-tecnologia.md), fila «Librería de componentes». |
| Seguridad | [D-003](./03-autenticacion-keycloak.md), «Cliente y flujo» (tokens solo en memoria, cliente sin secreto); [D-004](./04-consumo-de-api.md), «Rutas y origen» (`environment` sin secretos). |
| Simple | [D-001](./01-tecnologia.md), «Alternativas descartadas»; [D-002](./02-estructura-y-capas.md), «Alternativas descartadas» (Nx, capa `domain/`); [D-004](./04-consumo-de-api.md), «Alternativas descartadas» (servidor de *mocks*). |
| Estructura | [D-002](./02-estructura-y-capas.md), «Árbol» y «Reglas entre carpetas de primer nivel». |
| Componentes | [D-002](./02-estructura-y-capas.md), «Capas y sentido de las dependencias» (`presentation/containers` y `presentation/components`). |
| Estado | [D-002](./02-estructura-y-capas.md), «Árbol» (`<module>.facade.ts`); [D-004](./04-consumo-de-api.md), «Repositorio por módulo» y «Errores normalizados». |
| Datos | [D-004](./04-consumo-de-api.md), «Repositorio por módulo» y «Modo de cada módulo al empezar». |

## Criterios de aceptación de la etapa E1 y dónde se cubren

| # | Criterio de aceptación | Dónde se cubre |
|---|---|---|
| 1 | Framework, lenguaje, librería de componentes, herramienta de pruebas y herramientas de calidad, con versión mínima y motivo | [D-001](./01-tecnologia.md), tabla «Decisión» |
| 2 | Estructura de carpetas, reglas de dependencia entre capas y herramienta que las comprueba | [D-002](./02-estructura-y-capas.md), «Árbol», «Capas y sentido de las dependencias», «Reglas entre carpetas de primer nivel» y «Comprobación automática» |
| 3 | Flujo de autenticación con Keycloak y qué ve un usuario sin sesión | [D-003](./03-autenticacion-keycloak.md), «Cliente y flujo» y «Qué ve cada usuario» |
| 4 | Qué muestra la interfaz cuando una API de Nexora no está disponible | [D-004](./04-consumo-de-api.md), «Qué muestra la interfaz» |
| 5 | Paleta con sus códigos de color, incluido #7B1E34, y tipografía | [D-005](./05-base-visual.md), «Paleta» y «Tipografía» |
| 6 | Plan de etapas con reglas, tarjetas del diccionario y chat de pruebas, cada una con objetivo y criterios | [D-006](./06-plan-de-etapas.md), E6 y E7 (diccionario), E8 (reglas) y E9 (chat de pruebas) |
| 7 | Cada elección justificada contra los criterios de arquitectura | Columna «Motivo frente a los criterios» de [D-001](./01-tecnologia.md); contexto y «Alternativas descartadas» de [D-002](./02-estructura-y-capas.md) a [D-005](./05-base-visual.md); tabla «Criterios de arquitectura y dónde se cumplen» de este documento |

## Pendientes conocidos

1. **Un valor de contraste de D-005 es erróneo.** En la tabla «Paleta» de [D-005](./05-base-visual.md), el contraste de
   `--nx-color-on-primary-container` (#3D0F1A sobre #F6E7EB) dice 13,3:1. Con la fórmula WCAG 2.1 da **13,69:1**. El
   13,0:1 de `--nx-color-primary-hover` (#5E1627 sobre #FFFFFF) es correcto (12,96:1) y se mantiene. La conclusión no
   cambia: los dos superan AA. Lo corrige la etapa E3, que recalcula y documenta la tabla de contrastes.
2. **Las dudas de D-003, D-004 y D-006 ya están contestadas.** Los documentos conservan la sección «Dudas para el
   responsable» porque son transcripción literal de lo aprobado, pero las respuestas constan en las fichas de las
   etapas que las aplican:
   - D-003, Duda 1 (alta del cliente `nexora-ui` en Keycloak) y Duda 2 (un inquilino por sesión): ficha de E4.
   - D-004, Duda 1 (qué son las «reglas»): ficha de E8. Son reglas de negocio, distintas de las tarjetas del
     diccionario.
   - D-004, Duda 2 (chat de pruebas contra Intelligence): ficha de E9.
   - D-006, Duda 2 (sugerencias automáticas del diccionario): ficha de E7. Quedan para una etapa posterior.
   - D-006, Duda 1 (volcar el plan): el plan ya se aplicó y las etapas E2 a E9 existen en `.factory/stages/`.
