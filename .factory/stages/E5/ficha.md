# Ficha de etapa E5 · Acceso a datos común

## Objetivo
Existe la pieza común con la que todos los repositorios http convierten respuestas y errores de Nexora (D-004).

## Alcance
- shared/data: tipo NexoraError, toNexoraError() (estado HTTP, problem+json, X-Request-Id), Page<T> y su conversión desde PageResponse de Semantic, y utilidades de ETag/If-Match.

## Fuera de alcance
- Repositorios de módulos y pantallas.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] Cada variante de NexoraError tiene al menos una prueba que parte de una respuesta HTTP representativa: red caída, 401, 403, 404, 409, 412, 400 con problem+json con campos, 422, 500 y 503.
- [ ] Cobertura de líneas de shared/data igual o superior al 90 %.
- [ ] Lint y build sin avisos.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
