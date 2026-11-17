# 7. Guía del diccionario semántico, las relaciones y las sugerencias

El diccionario tiene dos secciones, **Definiciones** y **Relaciones**, bajo la misma entrada del menú. Todo se hace
sobre la fuente de datos elegida en la cabecera; Semantic decide en cada llamada (permisos, tenant, fuente,
estados): ocultar un botón nunca es la autorización.

## Crear con ayuda (F1)

**Diccionario → Crear con ayuda** (solo `EDITOR` o `APPROVER`). La persona escribe en lenguaje de negocio lo que
quiere que Nexora aprenda, por ejemplo «Quiero que Nexora pueda contar cuántos pedidos tiene cada cliente», y pulsa
**Interpretar**:

1. **Lo que Nexora ya sabe:** los conceptos, métricas y dimensiones aprobados (o en borrador) que se reutilizan, con
   su nombre de negocio, y las palabras que no supo relacionar.
2. **Antes de continuar:** cuando algo no está claro (por ejemplo, qué significa «cada cliente»), una pregunta con las
   opciones del catálogo y siempre **Ninguna de estas**. Lo que Nexora entendió aparece marcado, pero hay que
   confirmarlo.
3. **Lo que falta:** una tarjeta por cada métrica (conteo) o forma de agrupar que falta, con su explicación, un
   **nombre** y una **descripción** propuestos a partir de tus palabras (plantillas fijas; se pueden cambiar) y las
   confirmaciones necesarias. Si Nexora relacionó tus palabras con un dato sin nombre de negocio, hay que confirmarlo
   expresamente; un especialista lo revisará antes de aprobar.
4. **Guardar como borrador:** se guarda en el diccionario como `DRAFT` (nunca se aprueba aquí) y queda enlazado a una
   sugerencia de Nexora con su evidencia. Si se repite la petición, Nexora dice que ya existe.

No se muestran tablas, columnas ni claves: la clave interna la genera Semantic. Las sumas y los promedios nuevos, y los
conceptos y relaciones nuevos, siguen en el **modo avanzado** (formularios de abajo). La petición no se guarda ni se
registra; solo se guarda lo que se confirma.

## Definiciones

- **Vista tabla o tarjetas**, búsqueda por nombre/clave/descripción (sin distinguir mayúsculas ni tildes), filtros por
  tipo y estado, ordenación y paginación.
- **Detalle** (panel lateral): resumen (con el **origen** explicado y «Tú» cuando el autor, editor o aprobador eres
  tú), referencias, problemas de validación que informa Semantic, dependencias (qué definiciones de la fuente la usan)
  e historial (eventos de auditoría; requiere `AUDITOR`, D-C).
- **Estados**: *Borrador · pendiente de aprobación* → *Aprobada* → *Inactiva*. Solo las aprobadas y sin problemas
  (`usable`) se usan en los reportes.

| Acción | Estado | Rol | Notas |
|---|---|---|---|
| Nueva definición | — | EDITOR/APPROVER | Siempre se crea como borrador |
| Editar borrador | DRAFT | EDITOR/APPROVER | |
| **Corregir** (B4, D-A) | APPROVED | EDITOR/APPROVER | Antes, un diálogo enumera las consecuencias (vuelve a borrador; deja de estar aprobada hasta una nueva aprobación; los planes que dependan pueden quedar `STALE`; los Excel ya generados no cambian) y exige marcar «Entiendo las consecuencias». Sin versionado paralelo |
| Aprobar | DRAFT | APPROVER | Confirmación; si tú la creaste o editaste por última vez, aviso de **autoaprobación** (B1) |
| Rechazar borrador | DRAFT | APPROVER | Desactivación con **motivo obligatorio** (≤ 500, D5) |
| Retirar | APPROVED | APPROVER | Motivo obligatorio; muestra las dependencias conocidas |
| Reactivar como borrador | INACTIVE | EDITOR/APPROVER | Vuelve a necesitar aprobación |
| Eliminar | — | — | **No existe** (D6) |

## Relaciones (B3, D-E)

- Lista con búsqueda por nombre, descripción, tablas y columnas; filtros por estado y procedencia (clave foránea o
  manual); paginación.
- **Detalle**: resumen (une, procedencia, validez física, autoría), estructura (tablas, columnas emparejadas en orden,
  clave foránea, cardinalidad declarada, tipos de unión y evidencia física que observa Semantic), problemas e
  historial (`AUDITOR`).
- **Nueva relación**: *manual* (tabla de origen y destino, 1–16 parejas de columnas elegidas por nombre, cardinalidad y
  tipos de unión) o *desde claves foráneas o candidatas* (Semantic calcula las candidatas al momento, opcionalmente
  alrededor de una tabla; una clave foránea declarada se crea con `from-foreign-key` y su nombre es opcional).
- Acciones: las mismas que las definiciones (editar borrador, **corregir** una aprobada con la misma confirmación,
  aprobar con aviso de autoaprobación, rechazar, retirar, reactivar). Al editar solo cambian nombre, descripción,
  cardinalidad y tipos de unión: tablas y columnas son inmutables en Semantic.

Si otra persona cambió una definición o relación entre tanto, Semantic responde `412` y la consola pide recargar
(nunca sobrescribe). Una operación no se envía dos veces: los botones se bloquean mientras está en curso y cada
escritura lleva su `If-Match`.

## Sugerencias

- Lista filtrable por tipo, estado y relevancia (por defecto *Abiertas*, ordenadas por relevancia).
- Detalle: contenido propuesto (tabla, columna, agregación, tipo; o, para una relación, origen → destino y columnas),
  evidencia y señales, aspectos pendientes, exposición de los objetos, decisión (quién, cómo y enlace al elemento
  creado), historial de versiones y, con `AUDITOR`, historial de auditoría.
- **Aceptar como borrador** (concepto, métrica, dimensión): crea una definición en **DRAFT** (D10, D-B). El concepto de
  una métrica o dimensión se elige entre los de **su tabla** (preseleccionado si solo hay uno). Una dimensión se puede
  corregir: tipo (solo si cambia), granularidades y zona horaria cuando es temporal.
- **Aceptar relación como borrador** (B3): nombre (opcional solo para una clave foránea sin corregir), descripción,
  cardinalidad y tipos de unión; opcionalmente **corregir** el destino y las columnas (el origen no cambia). Siempre
  `result: DRAFT` (D-B): la aprobación es una acción posterior en Relaciones.
- Si hay aspectos pendientes hay que confirmarlos todos. **Rechazar** con motivo (≤ 2000); **Reabrir** una rechazada.
- La generación de sugerencias (ejecuciones del generador) **no** está en la consola (D-D, B5 pospuesto).

**Trazabilidad (B2):** una sugerencia aceptada enlaza a la definición o relación creada. Semantic no expone el enlace
inverso: una definición creada desde una sugerencia figura como «Creada por una persona» (origen `MANUAL`) y su
sugerencia se encuentra en Sugerencias (estado *Aceptada*) o en el historial de auditoría.
