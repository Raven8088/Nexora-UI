# Ficha de etapa E2 · Proyecto base y verificación de calidad

## Objetivo
Proyecto Angular creado según D-001, con las comprobaciones de D-002 activas y sin pantallas de negocio.

## Alcance
- ng new con TypeScript estricto, zoneless, SCSS y Vitest.
- ESLint con angular-eslint, typescript-eslint estricto, eslint-plugin-boundaries y no-restricted-imports de D-002.
- Enmienda a D-002 autorizada por el responsable: la configuración de capas clasifica también main.ts, environments/ y los archivos de prueba, de modo que ningún archivo del proyecto quede como desconocido.
- Prettier.
- Presupuesto de bundle.
- environments/ con su interfaz tipada (D-004).
- proxy.conf.json.
- Componente raíz vacío.
- Prueba que demuestra que una importación entre módulos hace fallar el lint.
- Documentar en docs/ que añadir un módulo toca una ruta, una entrada de menú y los archivos de environments/ (corrige la imprecisión de D-002).
- Añadir a la configuración de la fábrica los comandos de prueba del proyecto queda para el responsable; la etapa deja escritos en docs/ los comandos exactos.

## Fuera de alcance
- Tema, shell, autenticación y cualquier módulo.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] ng build termina sin errores ni avisos.
- [ ] ng lint --max-warnings=0 termina con 0 problemas, incluidos main.ts, environments/ y los archivos de prueba.
- [ ] ng test pasa.
- [ ] La prueba de límites falla al importar features/a desde features/b y pasa sin esa importación.
- [ ] package.json cumple todas las versiones mínimas de D-001, y Angular, Material, CDK y angular-eslint comparten major.
- [ ] tsconfig.json tiene activas las opciones estrictas de D-001.
- [ ] docs/ contiene los comandos exactos de build, lint y pruebas.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
