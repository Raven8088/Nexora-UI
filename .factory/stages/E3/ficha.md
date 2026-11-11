# Ficha de etapa E3 · Tema visual, shell y componentes compartidos de interfaz

## Objetivo
La aplicación muestra el marco definitivo (barra superior, menú lateral y área de contenido) con la paleta y la tipografía de D-005.

## Alcance
- styles/ (tokens, colores generados, tema y sobrescrituras).
- Inter y Material Symbols servidos localmente.
- shell/ con el menú de tres entradas, que apuntan a rutas aún sin módulo y muestran «Próximamente».
- Componentes de shared/ui: page-header, loading-state, error-state, empty-state, simulated-data-notice y confirm-dialog, con sus pruebas.
- Página /sin-permiso (solo la vista).
- Enmienda a D-002 autorizada por el responsable: confirm-dialog es la única excepción a la regla de que los componentes compartidos no inyectan nada; puede inyectar los datos del diálogo de Angular Material y nada más. Se documenta en docs/.
- Enmienda a D-005 autorizada por el responsable: documentar en docs/ cómo se ajustan los tamaños de letra de Angular Material a los cinco tamaños fijados, y recalcular con la fórmula WCAG los valores de contraste de la paleta: el único valor erróneo de D-005 es #3D0F1A sobre #F6E7EB, que da 13,69:1 y no 13,3:1; el 13,0:1 de #5E1627 sobre #FFFFFF se mantiene (12,96:1).

## Fuera de alcance
- Autenticación (el menú de usuario es un hueco vacío) y cualquier llamada a API.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] Los tokens --mat-sys-primary y --mat-sys-on-primary valen exactamente #7B1E34 y #FFFFFF; lo comprueba una prueba sobre los estilos calculados.
- [ ] Ningún .scss fuera de styles/ contiene colores literales.
- [ ] Cada componente de shared/ui tiene pruebas de sus entradas y salidas.
- [ ] La aplicación no hace peticiones a dominios externos al cargar (fuentes e iconos locales).
- [ ] docs/ incluye la tabla de contrastes recalculada y la correspondencia entre los tamaños de Angular Material y los cinco tamaños del proyecto.
- [ ] Ningún componente de shared/ui llama a inject() salvo confirm-dialog, y este solo para los datos del diálogo.
- [ ] Lint, build y pruebas terminan sin errores ni avisos.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
