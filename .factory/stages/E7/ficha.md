# Ficha de etapa E7 · Diccionario semántico: alta, edición, aprobación y desactivación

## Objetivo
El administrador crea y edita tarjetas en borrador, y las aprueba o desactiva según sus permisos, con control de versiones.

## Alcance
- Formularios de alta y edición por tipo (concepto, métrica y dimensión).
- PUT con If-Match.
- approve y deactivate con diálogo de confirmación (y motivo en la desactivación).
- Acciones visibles según semantic:proposal:write y semantic:proposal:approve.
- Mensajes de conflict e invalid.

## Fuera de alcance
- Revisión de sugerencias automáticas y relaciones: quedan para una etapa posterior (respuesta del responsable).

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] Pruebas de la fachada para crear, editar, aprobar, desactivar, conflict (412/409) e invalid con errores por campo.
- [ ] Toda escritura envía If-Match con la versión cargada; una prueba de repositorio lo verifica.
- [ ] Sin semantic:proposal:approve, no se muestran «Aprobar» ni «Desactivar».
- [ ] Tras un error, el formulario conserva lo escrito.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
