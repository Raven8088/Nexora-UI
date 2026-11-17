# 2. Contratos y rutas

Contratos verificados en el código de los servicios (VERIFICADO por lectura del código fuente; no por ejecución
contra los servicios reales).

## Rutas del BFF

| Método y ruta del BFF | Servicio y ruta | Permiso de consola |
|---|---|---|
| `GET /bff/health` | — (público) | — |
| `GET /bff/session` | — (identidad, permisos, fuentes) | sesión |
| `POST /bff/logout` | invalida la sesión; devuelve `logoutUrl` (end_session de Keycloak) | sesión + CSRF |
| `POST /bff/api/report-requests` | Intelligence `POST /api/v1/report-requests` | chat |
| `POST /bff/api/knowledge-requests` (F1) | Intelligence `POST /api/v1/knowledge-requests` (cuerpo `{request, language, dataSource}` sin cambios, token de la persona) | proposalWrite + fuente configurada del tenant (D7) |
| `GET/POST /bff/api/semantic/data-sources/{ds}/definitions` | Semantic, igual | catalogRead (escritura: Semantic decide) |
| `GET/PUT …/definitions/{id}` | Semantic, igual (`If-Match`) | catalogRead |
| `POST …/definitions/{id}/approve` | Semantic (`If-Match`) | catalogRead |
| `POST …/definitions/{id}/deactivate` `{reason}` | Semantic (`If-Match`) | catalogRead |
| `GET …/objects`, `GET …/objects/{id}` | Semantic (tablas, vistas y columnas) | catalogRead |
| `GET/POST …/relationships` (B3) | Semantic, igual | catalogRead (escritura: Semantic decide) |
| `POST …/relationships/from-foreign-key` (B3) | Semantic | catalogRead |
| `GET/PUT …/relationships/{id}` (B3) | Semantic (`If-Match`) | catalogRead |
| `POST …/relationships/{id}/approve` · `…/deactivate` `{reason}` (B3) | Semantic (`If-Match`) | catalogRead |
| `GET …/relationship-candidates?objectId&limit` (B3) | Semantic (se calculan al momento; no se guardan) | catalogRead |
| `GET …/suggestions`, `…/{id}`, `…/{id}/history` | Semantic | catalogRead |
| `POST …/suggestions/{id}/accept-definition` · `…/accept` (B3) | Semantic (`If-Match`); **el BFF exige `"result":"DRAFT"`** (D-B): cualquier otro cuerpo → `422 bff_draft_required` sin llegar a Semantic | catalogRead |
| `POST …/suggestions/{id}/reject` / `reopen` | Semantic (`If-Match`) | catalogRead |
| `POST …/knowledge-proposals` (F1) | Semantic (solo lectura: qué existe, qué falta, qué preguntar) | catalogRead (Semantic exige `semantic:proposal:write` y persona) |
| `POST …/knowledge-proposals/confirm` (F1) | Semantic: guarda **una** propuesta como `DRAFT` (nunca aprueba) | catalogRead (Semantic exige `semantic:proposal:write` y persona) |
| `GET /bff/api/semantic/audit-events?targetType=SEMANTIC_DEFINITION\|SEMANTIC_RELATIONSHIP\|SEMANTIC_SUGGESTION&targetId=…` | Semantic | catalogRead (Semantic exige `AUDIT_READ`; la consola solo lo pide con ese permiso, D-C) |

No existe ninguna ruta `DELETE` (D6). Cualquier otra ruta responde `404 bff_route_not_allowed`; siguen bloqueadas,
entre otras, `…/relationships/{id}/contract` (contrato para S4), `suggestion-runs`, `suggestion-triggers` (B5
pospuesto, D-D), `snapshots`, exposición, fuentes, tenants y planes, y `…/knowledge-context` (F1: el catálogo cerrado con
nombres físicos de columnas es solo para Intelligence).

`GET /bff/session` incluye `subject` (B1): el `sub` del token, el mismo identificador que Semantic registra como
autor, editor, aprobador y actor de auditoría. La consola lo usa solo para reconocer los cambios propios (aviso de
autoaprobación, «Tú» en los historiales); nunca para autorizar y nunca se muestra.

## Intelligence — `POST /api/v1/report-requests`

- Cabecera `Idempotency-Key` (UUID) obligatoria. La consola genera una clave **nueva** para cada pregunta y para cada
  respuesta a una aclaración, y **reutiliza** la misma clave y el mismo cuerpo en un reintento técnico.
- Cuerpo: `{request, language, dataSource}` o `{clarification:{id, option}, language, dataSource}`; `dataSource` es
  el **alias** configurado (D7).
- `200` JSON `NEEDS_CLARIFICATION` (`question`, `options`, `clarificationId`, `optionIds`, `expiresAt`) → botones;
  se responde con `optionIds[i]`. Sin `clarificationId`/`optionIds` la aclaración no se puede responder desde la
  consola (se explica).
- `200` xlsx con `Content-Disposition`, `X-Nexora-Completeness`, `X-Nexora-Warnings`,
  `X-Nexora-Artifact-Sha256` → tarjeta de descarga.
- `422 not_answerable` → se muestra la `explanation` tal cual llega; `409 request_in_progress` /
  `request_completed` / `request_unresolved`; `429 busy`; `5xx` con `stage`/`reason`
  (`reason: CLARIFICATION_EXPIRED` → la aclaración caducó).
- El archivo **no se reenvía** en un reintento de una petición completada (`409 request_completed`): por eso se
  conserva en memoria durante la sesión (D8).

## Semantic — definiciones

- Ciclo de vida: `DRAFT → APPROVED → INACTIVE`; editar devuelve a `DRAFT`; aprobar solo `DRAFT`, por una persona;
  desactivar `DRAFT` o `APPROVED` con motivo (≤ 500). Sin borrado.
- Escrituras con `If-Match: "<version>"`; `412 PRECONDITION_FAILED` → la consola pide recargar.
- `CreateDefinitionRequest`: `kind`, `key` (`[a-z0-9][a-z0-9_-]{1,62}`), `name` (≤ 200), `description` (≤ 2000) y un
  bloque: `concept{relationId}`, `metric{conceptId, aggregation COUNT|SUM|AVG, columnId (opcional con COUNT)}`,
  `dimension{conceptId, columnId, type CATEGORICAL|TEMPORAL, granularities, timeZone}`.
- Errores: `{code, correlationId, errors[{code?, field, message}]}`. **`code` llega en minúsculas**
  (`ErrorCode.name().toLowerCase()`: `precondition_failed`, `duplicate_key`, `definition_invalid`…). Hasta B1 la
  consola los buscaba en mayúsculas y mostraba siempre el texto genérico (VERIFICADO en el código). Ahora traduce
  todos los códigos de las operaciones del diccionario, relaciones y sugerencias (y los del BFF); un `422
  definition_invalid` / `relationship_invalid` lista cada problema (`DefinitionIssue.Code` traducido) y un `400
  validation_failed` los campos inválidos. 403, 409, 412 (recargar) y 428 tienen texto propio.

## Semantic — relaciones (B3)

- Mismo ciclo de vida que las definiciones: crear siempre da `DRAFT` (también desde una clave foránea); editar desde
  cualquier estado devuelve a `DRAFT`; aprobar solo `DRAFT` (persona, autoaprobación permitida y auditada, D-DIC-15);
  desactivar `DRAFT` o `APPROVED` con motivo (≤ 500). Sin borrado. `If-Match` en toda escritura.
- `CreateRelationshipRequest` (origen `SEMANTIC`): `name` (≤ 200), `description` (≤ 2000), `sourceObjectId`,
  `targetObjectId`, `pairs[{sourceColumnId, targetColumnId}]` (1–16, ordenadas e inmutables),
  `declaredCardinality` (`ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY`), `allowedJoinTypes` (`INNER`, `LEFT`; al
  menos uno). `CreateFromForeignKeyRequest` (origen `DECLARED_FK`): `foreignKeyId`, `name` opcional (por defecto el de
  la FK), `description`, cardinalidad y tipos de unión. `UpdateRelationshipRequest`: solo nombre, descripción,
  cardinalidad y tipos de unión (objetos, parejas y origen son inmutables). **Semantic rechaza propiedades JSON
  desconocidas**: la consola envía exactamente estos campos. `replacesId` no se usa desde la consola.
- `relationship-candidates`: candidatas heurísticas calculadas en cada llamada (como máximo 100), con `foreignKeyId`
  cuando proceden de una FK declarada. No se guarda nada.

## Semantic — sugerencias

- Listado con `kind`, `status`, `relevance`, `sort=RELEVANCE`; detalle con `ETag`; historial de versiones.
- `accept-definition` con `result: "DRAFT"` siempre (D10, D-B) y `acknowledgedPending` (exactamente los aspectos
  pendientes). B1: el concepto de una métrica o dimensión se elige entre los conceptos en uso de **su tabla**
  (DEC-G2-2); una dimensión admite `dimensionType` (solo si cambia el sugerido; igual → 400), `granularities` y
  `timeZone` (DEC-G2-4).
- `accept` (relaciones, B3) con `result: "DRAFT"` **siempre**: sin `result`, Semantic aprueba de inmediato para quien
  puede aprobar. Cuerpo: `name` (obligatorio salvo FK sin corrección), `description`, `declaredCardinality`,
  `allowedJoinTypes`, `acknowledgedPending`, `correction{targetObjectId, pairs}` (el origen no cambia, DEC-G1C-4).
- `reject {reason}` (1–2000), `reopen`.

## Creación asistida (F1)

1. `POST /bff/api/knowledge-requests` → Intelligence interpreta la petición contra el catálogo cerrado de Semantic
   (leído con el token de la persona) y responde `{"intent": nexora-knowledge-intent/1}`. Problemas propios:
   `interpretation_failed` (422), `interpretation_unavailable` y `knowledge_context_unavailable` (503), `busy` (429),
   `data_source_not_found` (404), `forbidden` (403).
2. `POST …/knowledge-proposals` `{intent, answers}` → `status` (`PROPOSAL`, `NEEDS_CLARIFICATION`, `ALREADY_EXISTS`,
   `UNSUPPORTED`, `NOT_UNDERSTOOD`), `reused`, `clarifications` (con `NONE`), `proposals`, `notices`, `unresolved`.
   Nunca nombres físicos.
3. `POST …/knowledge-proposals/confirm` `{intent, answers, proposal, name, description, acknowledgedPending,
   acknowledgedInterpretation}` → 201 `{suggestion, definition, created}`; la definición es siempre `DRAFT`. 409
   `assisted_proposal_changed` (cambió o falta una respuesta) y `assisted_proposal_blocked` (una igual se rechazó).

La consola guarda la intención solo en memoria mientras dura el flujo y la reenvía sin cambios; Semantic la valida de
nuevo (KI-R1, KI-R2, fuente) y decide siempre sobre el catálogo actual.

