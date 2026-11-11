# Solicitud de revisión · Nexora UI · etapa E1 · puerta «arquitectura»

Eres el revisor independiente. No has participado en este trabajo. No corriges ni propones código:
compruebas el material contra la ficha y las reglas, y emites un veredicto.

## Material que debes leer
(rutas relativas a la carpeta de la etapa)
- `ficha.md` y `alcance.json`
- `decisiones/*.md`
- `../../criteria.md` (criterios de arquitectura del proyecto)

## Reglas que debes comprobar
- **U-REV-7** [BLOQUEANTE]: La decisión respeta las decisiones vigentes del proyecto, o declara cuál cambia y por qué.
- **U-REV-8** [MEDIO]: La decisión se justifica con los criterios del proyecto (criteria.md) y no añade complejidad que la etapa no necesita.

## Hallazgos de las comprobaciones automáticas
- Ninguno.

## Ficha de la etapa

# Ficha de etapa E1 · Arquitectura inicial de la interfaz

## Objetivo
Dejar decidida y escrita la arquitectura de Nexora UI, la aplicación web administrativa de Nexora, antes de programar nada. Al terminar debe estar claro con qué tecnología se construye, cómo se organiza el código y en qué etapas se desarrollará.

## Alcance
- Elegir framework, lenguaje, librería de componentes, herramienta de pruebas y herramientas de calidad de código, cada una con su justificación.
- Definir la estructura de carpetas y capas, y las reglas de dependencia entre ellas.
- Definir cómo se integra la autenticación con Keycloak.
- Definir cómo consume la interfaz las API de Nexora y cómo se comporta cuando una API todavía no existe.
- Definir la base visual: paleta blanco y vino tinto, tipografía y criterios de apariencia profesional.
- Proponer el plan de etapas para construir la versión administrativa: gestión de reglas, tarjetas del diccionario semántico y chat para probar peticiones.

## Fuera de alcance
- Escribir código de la aplicación, instalar dependencias o crear el proyecto base.
- Cualquier cambio en el backend de Nexora o en sus repositorios.
- Funciones para usuarios finales; esta versión es solo administrativa.
- Despliegue, servidores e integración continua.

## Prioridades
1. Arquitectura limpia y mantenible por encima de rapidez de desarrollo.
2. Escalabilidad: añadir módulos nuevos sin tocar los existentes.
3. Apariencia profesional y coherente.
4. Simplicidad: ninguna pieza que esta versión no necesite.

## Criterios de aceptación
- [ ] Existe una decisión escrita que nombra framework, lenguaje, librería de componentes, herramienta de pruebas y herramientas de calidad, con versión mínima y motivo de cada una.
- [ ] La decisión incluye la estructura de carpetas y las reglas de dependencia entre capas, y dice con qué herramienta se comprueban automáticamente.
- [ ] La decisión describe el flujo de autenticación con Keycloak y qué ve un usuario sin sesión.
- [ ] La decisión describe qué muestra la interfaz cuando una API de Nexora no está disponible.
- [ ] La decisión fija la paleta con sus códigos de color, incluido el vino tinto #7B1E34, y la tipografía.
- [ ] Existe un plan de etapas con al menos una etapa para reglas, una para tarjetas del diccionario semántico y una para el chat de pruebas, cada una con objetivo y criterios de aceptación.
- [ ] Cada elección se justifica contra los criterios de arquitectura del proyecto.

## Decisiones vigentes que aplican
Ninguna

## Formato obligatorio de tu respuesta

Responde solo con este formato. Una respuesta sin él se descarta.

```
VEREDICTO: APROBAR | REVISAR | ESCALAR
HUELLA: 88155078cf9020fc
HALLAZGOS:
- R-1 [BLOQUEANTE|MEDIO|MENOR] <qué ocurre> — <dónde> — <qué regla incumple>
REGLAS:
- <id de regla>: CUMPLE | NO CUMPLE — <evidencia en una línea>
```

- APROBAR: ninguna regla bloqueante se incumple.
- REVISAR: hay al menos un hallazgo bloqueante que el autor puede corregir.
- ESCALAR: hace falta una decisión del responsable (arquitectura, alcance ambiguo, reglas en conflicto).
- Copia la HUELLA tal cual: identifica la versión que revisaste.
- No propongas cambios fuera del alcance de la ficha.
