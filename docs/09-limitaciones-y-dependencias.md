# 9. Limitaciones, riesgos y dependencias externas

## 9.1 Dependencias externas (no ejecutadas: requieren acción fuera de este repositorio)

| # | Dependencia | Responsable | Bloquea |
|---|---|---|---|
| DEP-1 | Crear el cliente `nexora-console` en Keycloak (doc 03) | Administración de Keycloak | Inicio de sesión |
| DEP-2 | Verificar en *Evaluate* que el token de `nexora-console` lleva audiencias de Semantic e Intelligence, `tenant`, `roles`, `principal_type=HUMAN` | Administración de Keycloak | Todas las llamadas |
| DEP-3 | Configurar las fuentes (alias Intelligence ↔ id Semantic ↔ tenant) (doc 04) | Operación | Selector de fuentes |
| DEP-4 | `mvn -B clean verify -Pwith-web` en Windows con acceso a Maven Central (confirma starters de Spring Boot 4) | Desarrollo | Empaquetado del BFF |
| DEP-5 | Accesibilidad de red BFF → Semantic y BFF → edge de Intelligence desde la máquina del BFF | Operación | Chat y diccionario |
| DEP-6 | Usuarios de prueba controlados y autorización para E2E real (D11) | Usuario/Operación | Validación F2–F4 real |
| DEP-7 | Si la consola se expone fuera de `127.0.0.1`: HTTPS (proxy inverso), `NEXORA_CONSOLE_SECURE_COOKIE=true`, redirect URIs con `https` | Infraestructura | Uso en red |
| DEP-8 | ~~Cambios de `nexora-deploy`~~ — **aplicados** (D-FE-3, doc 12 §3) | — | — |
| DEP-9 | DEC-D-FE-1 implementada (Intelligence + `application-deploy.yml`): verificar en Windows, desplegar (recrear `intelligence` y `frontend`) y ejecutar F2–F4 desde la consola | Usuario | Chat en Docker |
| DEP-10 | D-FE-2: diagnóstico `Test-NexoraOidcReachability.ps1` y, si bloquea, issuer `keycloak.localhost` (doc 13 §B) | Usuario | Login |
| DEP-11 | Construir, arrancar y ejecutar `deploy\Test-NexoraFrontend.ps1` en Windows (doc 12 §9–§10) | Usuario | Evidencias de Docker |
| DEP-12 | Autorizar la creación del cliente `nexora-console` en Keycloak (doc 03) y su secreto en `nexora-deploy/secrets/` | Usuario | Login |
| DEP-13 | B6: desplegar la nueva imagen `frontend` y validar la administración del diccionario contra Semantic real (doc 08 §8.0) | Usuario | Declarar la integración funcional |
| DEP-14 | F1: desplegar Semantic (V14), Intelligence y la consola, y validar «Crear con ayuda» con Wellnode | Usuario | Declarar F1 validada |
| DEP-15 | F2: activar `NEXORA_SEMANTIC_KNOWLEDGE_CONCEPTS_ENABLED` e `NEXORA_INTELLIGENCE_KNOWLEDGE_CONCEPTS_ENABLED`, desplegar y validar «Enseñar un concepto nuevo» con Wellnode | Usuario | Declarar F2 validada |

## 9.2 Limitaciones conocidas

- **Excel solo en memoria** (D8): Intelligence no reenvía el archivo; se pierde al cerrar o recargar.
- **Conversaciones no persistentes**: se pierden al recargar.
- **Sesión en memoria del BFF** (sesión de servlet): un reinicio del BFF cierra las sesiones; no hay alta
  disponibilidad (requeriría Spring Session con almacén compartido).
- **Corregir una aprobada** (B4) la devuelve a borrador: deja de usarse hasta una nueva aprobación y los planes que
  dependan quedan `STALE`. No hay versionado paralelo (no existe en Semantic; decisión D-A).
- **Historial** = eventos de auditoría de Semantic (sin diferencias entre versiones); requiere `AUDITOR` (D-C).
- **Trazabilidad inversa**: Semantic no enlaza una definición o relación con la sugerencia de la que procede (origen
  `MANUAL`/`SEMANTIC`); el enlace existe solo de la sugerencia al elemento creado (B2; R-DIC-11).
- **Personas**: Semantic registra identificadores (`sub`), no nombres; la consola muestra «Tú» para el propio y el
  identificador para los demás.
- **Candidatas de relación**: se calculan en cada consulta (como máximo 100); que no aparezca una no significa que no
  exista la relación.
- **Generación de sugerencias** (ejecuciones del generador): fuera de la consola (D-D, B5 pospuesto).
- **Enseñar un concepto nuevo (F2)**: solo ofrece tablas y vistas habilitadas en la política de exposición (lo demás ni
  se menciona); como máximo 5 opciones; un concepto por tabla; sin subtipos con filtro; las opciones se describen sin
  nombres físicos, así que dos tablas parecidas pueden costar de distinguir (el nombre técnico plegado es solo para
  quien aprueba); la calidad de la elección depende del modelo local y siempre se confirma.
- **Crear con ayuda (F1)**: solo crea conteos y formas de agrupar sobre conceptos **aprobados**; las sumas y promedios
  nuevos, los conceptos nuevos y las relaciones siguen en el modo avanzado. Solo en español. La calidad de la
  interpretación depende del modelo local; todo lo que el modelo relaciona se confirma, y una columna elegida por el
  modelo se presenta solo por su tipo («una fecha», «un dato de texto»), por lo que la persona de negocio no puede
  verificarla: debe revisarla quien apruebe. Las descripciones aprobadas con nombres físicos llegan al modelo (no a la
  pantalla del asistente).
- **Catálogos muy grandes**: definiciones y relaciones se leen completas (≤ 50 × 200 por lista) y se buscan en el
  navegador; Semantic no ofrece búsqueda de texto.
- **Dependencias** solo dentro del diccionario de la fuente: los planes/reportes que usan una definición no son
  consultables desde la consola (se avisa).
- **Inglés y francés**: estructura preparada; textos solo en español. El idioma de la petición a Intelligence sigue
  al de la interfaz.
- **Fuentes de datos y Administración**: entradas visibles como *Próximamente*, sin operación.
- **Contadores de inicio**: `DRAFT` usa `totalItems`; sugerencias abiertas recorre las páginas (≤ 50 × 200).

## 9.3 Riesgos

| Riesgo | Mitigación |
|---|---|
| Starters Spring Boot 4 inferidos | DEP-4; cambio acotado al `pom.xml` |
| Claims distintos de los esperados (`roles`, `tenant`, `principal_type`) | Nombres configurables (`nexora.bff.identity.*`); DEP-2 |
| Timeout de 300 s insuficiente para reportes grandes | `NEXORA_CONSOLE_INTELLIGENCE_TIMEOUT`; un timeout se trata como resultado desconocido y se reintenta con la misma clave |
| Expiración del token durante una espera larga | `refreshToken()` en el gestor de clientes; si falla, la consola muestra «Tu sesión terminó» |
| Excel > 100 MiB | Límite configurable; se responde `bff_upstream_too_large` |
| Cambios aditivos en contratos | Zod con `passthrough`; un campo esperado ausente falla de forma visible |
