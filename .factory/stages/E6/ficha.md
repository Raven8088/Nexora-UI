# Ficha de etapa E6 · Diccionario semántico: consulta de tarjetas

## Objetivo
El administrador elige una fuente de datos y consulta las tarjetas del diccionario (conceptos, métricas y dimensiones) con datos reales de Nexora Semantic.

## Alcance
- Módulo features/dictionary con sus tres capas.
- Repositorio http (GET /data-sources, GET …/definitions con filtro por tipo y estado y paginación, GET …/definitions/{id}) y repositorio simulado.
- Fachada.
- Lista en forma de tarjetas, con filtro y paginación, y vista de detalle.
- Ruta con permission: semantic:catalog:read.

## Fuera de alcance
- Crear, editar, aprobar y desactivar (E7), sugerencias y relaciones.
- Reglas de negocio: son una capacidad distinta y no se mezclan con las definiciones semánticas.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] El módulo se carga bajo demanda: su chunk no está en el bundle inicial (informe de ng build).
- [ ] La fachada tiene pruebas con el repositorio simulado: carga, filtro, paginación, error unavailable y lista vacía.
- [ ] El repositorio http tiene pruebas con HttpTestingController.
- [ ] Con la API parada, la sección muestra error-state con «Reintentar», y el resto de la aplicación sigue funcionando.
- [ ] Con data: 'simulated', aparece el aviso de datos de demostración.
- [ ] Los componentes de presentation/components solo importan tipos de application; lo comprueba el lint. Que no llamen a inject() lo verifica el revisor.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
