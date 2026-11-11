# Propuesta de implementación · etapa E1

**Etapa:** E1 · Arquitectura inicial de la interfaz
**Base:** decisiones D-001 a D-006, aprobadas en la puerta «arquitectura» el 2026-11-11 (huella `88155078cf9020fc`),
y la decisión de enmienda que saldrá de la etapa E1b (ver «Dependencia de E1b»)
**Alcance permitido:** `docs/**` (alcance.json)

## Cambios respecto a la versión anterior

Esta versión aplica lo que pidió el responsable en `orquestador/respuestas.md` y lo que señaló el veredicto
`veredictos/propuesta-revisor.md`:

- **Respuesta del responsable.** Los hallazgos menores de la arquitectura y las preguntas abiertas de D-003, D-004 y
  D-006 ya no se quedan como «pendientes por etapa» en `docs/`. Los resuelve una decisión de enmienda de la etapa E1b, y
  E1 la transcribe junto con las demás (Plan, pasos 2 y 3). El plan pasa a `.factory/plan/plan.json` en E1b, no en E1.
- **R-1 del revisor.** La comprobación de CA-7 cita también las secciones donde está la justificación: la tabla
  «Decisión», columna «Motivo», de D-001, y el contexto y las alternativas descartadas de D-002 a D-005 (Pruebas, CA-7).
- **R-2 del revisor.** P-1 dice cuál es la base (`main`), separa lo que está en commits de lo que no, y ya no admite
  `propuesta.md` en la misma lista (Pruebas, P-1).
- **R-3 del revisor.** Las cifras de contraste ya no se publican sin corregir: se transcriben con la corrección de la
  enmienda (Plan, paso 2). Al recalcularlas he visto que solo una de las dos está mal (Riesgos, R-2; Dudas, 2).
- **R-4 del revisor.** Sigue sin haber `rama` en `estado.json`. Se mantiene como precondición (Dudas, 1).

## Dependencia de E1b

El responsable va a abrir la etapa E1b, «Correcciones a la arquitectura y plan». Esa etapa:

- escribe una decisión nueva que enmienda D-002, D-005 y D-006 y resuelve uno por uno los hallazgos R-1 a R-6 del
  veredicto de arquitectura de E1;
- incorpora las respuestas del responsable:
  - las «reglas» son reglas de negocio, distintas de las tarjetas del diccionario, y el módulo no presupone ninguna
    API, porque en el backend está por verificar;
  - el chat usa la API real de Intelligence en local con la autenticación existente;
  - un inquilino por sesión;
  - el alta del cliente `nexora-ui` en Keycloak la hace el responsable antes de E4;
  - las sugerencias automáticas del diccionario se dejan para después de E7;
- escribe `.factory/plan/plan.json` con las etapas E2 a E9.

**Recomiendo implementar E1 cuando la decisión de E1b esté aprobada.** Así `docs/arquitectura/` sale coherente desde
el primer commit, sin datos que ya se sabe que son erróneos ni preguntas que ya tienen respuesta. Mientras E1b no esté
aprobada, E1 no escribe nada en `docs/`. Si el responsable prefiere no esperar, ver Dudas, 3.

## Plan

E1 no escribe código ni instala nada (ficha, «Fuera de alcance»). Lo que se entrega es la documentación de arquitectura
del proyecto en `docs/arquitectura/`, tal como prevé D-006 («Consecuencias»). La propuesta transcribe a
`docs/arquitectura/` las decisiones D-001 a D-006 y la de enmienda de E1b. Es la única ruta que permite `alcance.json`.

Pasos, en orden:

1. **Precondiciones.** `estado.json` tiene `rama` (Dudas, 1) y la decisión de enmienda de E1b está aprobada en
   `.factory/decisions/`. Hasta entonces no se escribe nada. No se trabaja en `main`: cada paso de abajo es un commit
   pequeño en español, en la rama de la etapa, sin firmas ni coautores.
2. **Crear `docs/arquitectura/`** con un archivo por decisión. Cada archivo es una **transcripción literal** de la
   decisión aprobada en `.factory/decisions/`. Solo cambian cuatro cosas:
   - la línea de estado: «borrador para la puerta “arquitectura”» pasa a «Aprobada en la puerta “arquitectura” de E1,
     2026-11-11, huella `88155078cf9020fc`». En la de enmienda, la fecha y la huella de su puerta en E1b;
   - las referencias «(D-00N)» se convierten además en enlaces relativos al archivo de `docs/arquitectura/` que
     corresponde, para que se pueda navegar;
   - una línea al principio que dice cuál es la fuente canónica (`.factory/decisions/<id>.md`) y que el documento
     no se edita a mano: cambia solo con una decisión nueva;
   - en los documentos de las decisiones enmendadas (D-002, D-005 y D-006), un bloque **«Enmiendas»** justo después de
     la nota de fuente. Para cada punto que cambia, ese bloque cita la sección afectada y el texto o valor vigente, copiado
     de la decisión de enmienda, con su enlace. Por ejemplo, el contraste corregido de `--nx-color-on-primary-container`.
     El cuerpo sigue siendo la transcripción literal, de modo que se ve qué se aprobó y qué lo sustituye.

   No se cambia ninguna elección, versión, color, texto de interfaz ni criterio de aceptación, salvo lo que diga la
   enmienda, y eso solo en el bloque «Enmiendas».
3. **Crear `docs/arquitectura/README.md`** como índice, con:
   - el objetivo de Nexora UI y el resumen de cada decisión en una línea, con su enlace. Las enmendadas indican «enmendada
     por …»;
   - una tabla **criterio de `criteria.md` → decisión y sección que lo cumple** (Limpio, Escalable, Eficiente,
     Profesional, Visual, Seguridad, Simple, Estructura, Componentes, Estado, Datos);
   - una tabla **criterio de aceptación de la ficha → documento y sección** que lo cubre (los siete);
   - la sección **«Definiciones y respuestas del responsable»**, que resume en una línea cada respuesta incorporada por
     E1b y enlaza a la sección de la decisión de enmienda donde queda escrita. Son las cinco respuestas listadas en
     «Dependencia de E1b»;
   - la sección **«Pendientes conocidos»**, con lo único que E1b deja abierto a propósito: verificar en el backend si
     existen reglas de negocio, con la etapa a la que afecta (la de reglas del plan). Si la enmienda deja algo más
     abierto, se copia aquí tal cual.

   Ya no lleva la lista de observaciones R-1 a R-6 «pendientes», ni las preguntas abiertas de D-003, D-004 y D-006:
   quedan resueltas por la enmienda.
4. **Crear `docs/README.md`** con una línea por carpeta de documentación (por ahora solo `arquitectura/`), para que las
   etapas siguientes añadan la suya sin tocar la de otra.
5. **Comprobar** con los pasos de la sección «Pruebas» y corregir lo que falle.
6. **Puerta y evidencia** (lo ejecuta la fábrica o el productor tras el «Procede»): `factory.ps1 puerta -Etapa E1
   -Puerta implementacion` y `factory.ps1 probar -Etapa E1`.

No se escribe `.factory/plan/plan.json`: lo escribe E1b. `06-plan-de-etapas.md` transcribe D-006 con su bloque
«Enmiendas» y dice que el plan vigente, el que carga la fábrica, es `.factory/plan/plan.json`.

## Archivos a tocar

Todos nuevos y todos dentro de `docs/**`:

| Ruta | Contenido |
|---|---|
| `docs/README.md` | Índice de la documentación del proyecto |
| `docs/arquitectura/README.md` | Índice de arquitectura, trazabilidad con criterios y ficha, definiciones y respuestas del responsable, pendientes conocidos |
| `docs/arquitectura/01-tecnologia.md` | D-001 · Tecnología base |
| `docs/arquitectura/02-estructura-y-capas.md` | D-002 · Estructura de carpetas, capas y reglas de dependencia (con «Enmiendas») |
| `docs/arquitectura/03-autenticacion-keycloak.md` | D-003 · Autenticación con Keycloak |
| `docs/arquitectura/04-consumo-de-api.md` | D-004 · Consumo de las API de Nexora y comportamiento cuando no están disponibles |
| `docs/arquitectura/05-base-visual.md` | D-005 · Paleta, tipografía y criterios de apariencia (con «Enmiendas») |
| `docs/arquitectura/06-plan-de-etapas.md` | D-006 · Plan de etapas de la versión administrativa (con «Enmiendas») |
| `docs/arquitectura/07-enmiendas-e1b.md` | Decisión de enmienda de E1b: hallazgos R-1 a R-6, definición de reglas de negocio, chat contra Intelligence en local, respuestas del responsable |

Son nueve archivos. No se toca nada fuera de `docs/**`: ni `src/`, ni `package.json`, ni `.factory/`, ni `CLAUDE.md`.
Esta propuesta es un entregable de la puerta, no del «Procede», y no entra en los commits de la etapa.

D-003 y D-004 no se enmiendan por hallazgos, pero las respuestas del responsable les afectan: inquilino por sesión y
alta en Keycloak en D-003; reglas y chat en D-004. Si la decisión de E1b dice expresamente que enmienda D-003 o D-004,
sus documentos llevan también el bloque «Enmiendas». Si no lo dice, quedan como transcripción literal, y la respuesta
se lee en `07-enmiendas-e1b.md` y en el README. No lo decido yo: sigo lo que nombre la enmienda.

## Riesgos

- **R-1 · Que la transcripción se aparte de lo aprobado.** Si al pasar las decisiones a `docs/` se reescribe o se
  «mejora» algo, la documentación diría una cosa distinta de lo que aprobó el responsable.
  *Mitigación:* copia literal. Solo cambian la línea de estado, los enlaces, la nota de fuente canónica y el bloque
  «Enmiendas», que se copia de la decisión de enmienda (Plan, paso 2). La prueba P-2 compara cada documento con su
  decisión y solo admite esas diferencias. P-6 comprueba que cada punto del bloque «Enmiendas» está en la decisión de
  enmienda.
- **R-2 · Un contraste que la enmienda daría por malo es correcto.** He recalculado la paleta de D-005 con la fórmula
  WCAG 2.1, que define la luminancia relativa con los coeficientes 0,2126, 0,7152 y 0,0722 y la linealización sRGB:
  - #3D0F1A sobre #F6E7EB da **13,69:1**. D-005 dice 13,3:1, así que está mal, como señaló el revisor;
  - #5E1627 sobre #FFFFFF da **12,96:1**, es decir, 13,0:1. **D-005 está bien.** El revisor dijo 13,4:1 y se equivocó;
  - el resto coincide con D-005: 10,1, 17,2, 7,4, 6,5, 5,9, 6,5 y 8,7.

  La ficha de E1b habla de «los dos contrastes mal calculados». Si la enmienda cambia 13,0:1 por 13,4:1, introduce un
  error donde no lo había.
  *Mitigación:* se lo comunico al responsable (Dudas, 2) para que lo tenga en cuenta al aprobar la enmienda de E1b. En
  E1 transcribo los valores que fije la enmienda aprobada. No calculo ni corrijo cifras por mi cuenta en `docs/`.
- **R-3 · E1 queda a la espera de E1b.** Si E1b se retrasa, E1 no puede cerrarse.
  *Mitigación:* es lo que recomiendo, porque así la documentación no publica datos que ya se sabe que son erróneos (era
  la nota R-3 del revisor). La alternativa está en Dudas, 3.
- **R-4 · No hay rama de etapa.** `estado.json` no tiene `rama` y el repositorio está en `main`.
  *Mitigación:* no se escribe ni se hace commit en `main`. Se espera a que el responsable anote la rama (Dudas, 1).
- **R-5 · `factory.ps1 probar` no tiene pruebas que ejecutar.** `project.json` tiene `pruebas: []`, porque todavía no
  existe proyecto Angular. La evidencia del runner saldrá vacía y no demostrará nada por sí sola.
  *Mitigación:* las comprobaciones de la sección «Pruebas» son comandos de solo lectura (`git`, `grep`, `diff`) que el
  revisor puede repetir. No se declarará nada como verificado sin esa salida. Las pruebas automáticas de verdad empiezan
  en E2.
- **R-6 · Documentación duplicada que diverge con el tiempo.** Las decisiones viven en `.factory/decisions/` y ahora
  también en `docs/arquitectura/`, y las enmiendas aparecen en dos sitios: en la decisión de E1b y en el bloque
  «Enmiendas».
  *Mitigación:* cada documento declara cuál es su fuente canónica y que solo cambia con una decisión nueva. Queda como
  convención. P-2 y P-6 lo comprueban ahora; no hay comprobación permanente hasta que exista un proyecto donde ponerla.
- **R-7 · Datos de entorno en la documentación.** D-001 cita la ruta local del backend (`D:\desarrollo\java\Nexora AI`)
  y D-003 la URL local de Keycloak (`http://localhost:8180/realms/nexora`). Probablemente la enmienda de E1b cite
  también la dirección local de Intelligence. No son secretos, pero quedarán en el repositorio.
  *Mitigación:* se transcriben tal cual porque forman parte de lo aprobado. P-5 comprueba que no entra ningún secreto
  ni token.

## Pruebas

No hay código, así que no hay pruebas unitarias. Cada criterio de aceptación de la ficha se comprueba sobre los
documentos con un comando de solo lectura cuya salida se guarda como evidencia.

**Comprobaciones generales**

- **P-1 · Solo se toca lo permitido.** La base es `main`, y `HEAD` es la punta de la rama de la etapa (Dudas, 1):
  - `git diff --name-only main...HEAD` lista exactamente los nueve archivos de «Archivos a tocar», ni más ni menos;
  - `git diff --name-only main...HEAD -- . ":(exclude)docs/"` no devuelve nada.

  Los cambios que la fábrica escribe en `.factory/` (estado, veredictos, evidencia, registro) no van en los commits de
  la etapa y no cuentan aquí.
- **P-2 · Transcripción fiel (R-1).** Se hace un `diff` entre cada decisión de `.factory/decisions/` (E1-D-001 a
  E1-D-006 y la de enmienda de E1b) y su documento en `docs/arquitectura/`. Antes se quitan la nota de fuente, la línea
  de estado, el bloque «Enmiendas» y la sintaxis de los enlaces (`[D-00N](…)` → `D-00N`). Se espera una salida vacía en
  los siete.
- **P-3 · Enlaces válidos.** Cada enlace relativo de `docs/**/*.md` apunta a un archivo que existe (se listan con
  `grep -o "](\./[^)]*)"` y se comprueba cada ruta). Se espera: ninguno roto.
- **P-4 · Sin texto de plantilla.** `grep -rn "<<completar" docs/` no devuelve nada.
- **P-5 · Sin secretos (criterio Seguridad).** `grep -rniE "client_secret|password|secret *[:=]|bearer [a-z0-9]|eyJ[a-zA-Z0-9]" docs/`
  no devuelve nada. Las apariciones de «secreto» en prosa («sin secreto») se revisan a mano.
- **P-6 · Las enmiendas coinciden con la decisión de E1b.** El bloque «Enmiendas» solo aparece en los documentos de las
  decisiones que nombra la enmienda (`grep -l "^## Enmiendas" docs/arquitectura/`). Cada valor o texto citado en esos
  bloques aparece literal en la decisión de enmienda (`grep -F` de cada línea). En particular, los dos contrastes de
  `05-base-visual.md` que cite el bloque coinciden con los de la enmienda.

**Criterios de aceptación de la ficha**

| # | Criterio | Dónde queda | Comprobación |
|---|---|---|---|
| CA-1 | Framework, lenguaje, librería de componentes, pruebas y calidad, con versión mínima y motivo | `01-tecnologia.md`, tabla «Decisión» | La tabla tiene filas para Angular 21.0, TypeScript 5.9, Angular Material/CDK 21.0, Vitest 4.0, ESLint 9.0 / angular-eslint 21.0 / typescript-eslint 8.0 / eslint-plugin-boundaries 5.0 y Prettier 3.3, cada una con la columna «Motivo» llena (`grep -n` de cada nombre). |
| CA-2 | Carpetas, reglas de dependencia y herramienta que las comprueba | `02-estructura-y-capas.md`: «Árbol», «Capas y sentido de las dependencias», «Reglas entre carpetas», «Comprobación automática», y su bloque «Enmiendas» | Las cuatro secciones existen (`grep -n "^### "`), y «Comprobación automática» nombra `ng lint`, `eslint-plugin-boundaries` y `no-restricted-imports`. El bloque «Enmiendas» recoge la clasificación de `main.ts`, `environments/` y `*.spec.ts` que fije E1b (P-6). |
| CA-3 | Flujo de Keycloak y qué ve un usuario sin sesión | `03-autenticacion-keycloak.md`: «Cliente y flujo», «Qué ve cada usuario» | Aparecen `PKCE`, `S256` y `login-required`, y la tabla tiene la fila «Sin sesión». |
| CA-4 | Qué muestra la interfaz cuando una API no está disponible | `04-consumo-de-api.md`, «Qué muestra la interfaz» | Están las filas «La API todavía no existe» y «La API existe pero no responde» con los textos exactos de D-004. |
| CA-5 | Paleta con códigos, incluido #7B1E34, y tipografía | `05-base-visual.md`: «Paleta», «Tipografía», y su bloque «Enmiendas» | `grep -c "#7B1E34"` ≥ 1; la tabla tiene los 14 tokens `--nx-color-*` con su código hexadecimal; aparece «Inter Variable». El bloque «Enmiendas» da los contrastes que fije E1b (P-6). |
| CA-6 | Plan con etapas de reglas, tarjetas del diccionario y chat, cada una con objetivo y criterios | `06-plan-de-etapas.md`: E6/E7, E8 y E9, y su bloque «Enmiendas» | Cada una de E6, E7, E8 y E9 tiene «**Objetivo:**» y «**Criterios de aceptación:**» (`grep -n`). El bloque «Enmiendas» da el valor o la fuente de la longitud máxima del chat de E9 (P-6). |
| CA-7 | Cada elección justificada contra los criterios | `docs/arquitectura/README.md`, tabla criterio → decisión; y las justificaciones en el cuerpo de cada documento | (a) La tabla tiene una fila por cada uno de los 11 criterios de `criteria.md` y cada fila enlaza a una sección existente (P-3). (b) La justificación está en el cuerpo y se conserva literal (P-2): en `01-tecnologia.md`, la columna «Motivo» de la tabla «Decisión» tiene una celda no vacía por fila, cada una con el nombre de un criterio de `criteria.md`. En `02-` a `05-`, la sección de contexto y la de alternativas descartadas citan el criterio que justifica cada elección y cada descarte (`grep -n` de los nombres de los 11 criterios en cada documento, con la línea en la evidencia). |

**Evidencia.** Tras el «Procede» y los pasos del Plan, se ejecutan `factory.ps1 puerta -Etapa E1 -Puerta implementacion`
y `factory.ps1 probar -Etapa E1`. Como `probar` no tiene pruebas configuradas (R-5), la salida de P-1 a P-6 y de la tabla
de CA se adjunta en el resumen de entrega para que el revisor la repita.

## Dudas para el responsable

1. **Rama de la etapa.** `estado.json` no tiene `rama` y no se puede trabajar en `main`. Recomiendo una rama
   `e1-arquitectura` anotada en `estado.json` antes del «Procede». Sin ella, no escribo `docs/`. P-1 usa `main` como base.
2. **Contraste de #5E1627 (R-2 de esta propuesta).** D-005 dice 13,0:1 y es correcto: el cálculo WCAG 2.1 da 12,96:1.
   El único que está mal es #3D0F1A sobre #F6E7EB, que es 13,7:1 y no 13,3:1. Recomiendo que la enmienda de E1b corrija
   solo ese y que, para el otro, deje escrito que se recalculó y que 13,0:1 se mantiene. Así se cumple su criterio «los
   valores de contraste coinciden con el cálculo WCAG». El hallazgo sigue resuelto, pero sin cambiar el número.
3. **Orden entre E1 y E1b.** Recomiendo dar el «Procede» de E1 cuando la enmienda de E1b esté aprobada, para que `docs/`
   salga coherente desde el principio. La alternativa es transcribir ahora D-001 a D-006 tal cual y añadir
   `07-enmiendas-e1b.md` y los bloques «Enmiendas» en una etapa posterior. En ese caso, esa etapa necesitará `docs/**`
   en su alcance, y mientras tanto `docs/` publicaría el contraste erróneo y preguntas ya contestadas.
4. **Identificador y nombre de la decisión de enmienda.** No sé qué identificador tendrá (por ejemplo,
   `E1b-D-001.md`). Propongo el archivo `docs/arquitectura/07-enmiendas-e1b.md` y lo ajusto al identificador real.
5. **Respuesta incompleta.** `orquestador/respuestas.md` se corta en el cuarto criterio de aceptación de la ficha de E1b
   («…con qué autenticación, y»). Para esta propuesta no cambia nada, porque E1 solo transcribe lo que E1b apruebe. Lo
   aviso para que la ficha de E1b se cree completa.
6. **Ruta y nombres.** D-006 dice `docs/arquitectura/`. Propongo un archivo por decisión con nombre descriptivo
   (`01-tecnologia.md`…) en lugar de `D-001.md`…, para que se lea mejor desde el repositorio. Si prefieres los
   identificadores, solo cambian los nombres de archivo.
