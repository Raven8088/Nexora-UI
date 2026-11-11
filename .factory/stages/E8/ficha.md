# Ficha de etapa E8 · Reglas de negocio (con datos simulados)

## Objetivo
El administrador lista, crea, edita, activa y desactiva reglas de negocio sobre un repositorio simulado, listo para conectarse cuando el backend ofrezca esa capacidad.

## Alcance
- Definición del responsable: las reglas son reglas de negocio, es decir, condiciones, restricciones y criterios que determinan cómo se interpretan, evalúan o aplican procesos empresariales. Son una capacidad funcional distinta de las tarjetas de conceptos, métricas y dimensiones del Diccionario Semántico.
- La interfaz distingue con claridad las definiciones semánticas de las reglas de negocio: módulo, menú, textos y pantallas propios.
- Módulo features/rules con sus tres capas.
- Modelo provisional de regla de negocio, documentado como provisional en docs/.
- Repositorio simulado con datos de ejemplo y el contrato RulesRepository.
- Fachada.
- Lista, detalle y formulario.
- Aviso permanente de datos de demostración.

## Fuera de alcance
- Repositorio http: no se presupone que el backend tenga un CRUD ni una API de reglas. Nexora Semantic tiene restricciones y validaciones, pero no un módulo de reglas de negocio; su existencia en el backend está por verificar.
- Cualquier cambio en el backend.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] El aviso «Datos de demostración…» está presente en todas las pantallas del módulo; probado.
- [ ] Pruebas de la fachada para listar, crear, editar, activar, desactivar y validación.
- [ ] El módulo no importa de dictionary ni de test-chat (lint).
- [ ] Su chunk no está en el bundle inicial.
- [ ] Ningún texto de la interfaz llama «regla» a una definición semántica ni al revés; lo verifica el revisor.
- [ ] docs/ declara el modelo como provisional y lista qué habría que verificar en el backend para conectarlo.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
