# Ficha de etapa E1 · Arquitectura inicial de la interfaz

## Objetivo
Decidir la arquitectura y la base visual de Nexora UI, la aplicación web de administración de Nexora,
y dejar un esqueleto que compile, arranque y pase sus pruebas, sobre el que se construirán las pantallas.

## Alcance
- Elegir tecnología, estructura de carpetas, manejo de estado, acceso a las API y estrategia de pruebas.
- Definir la base visual: tipografía, espaciado, componentes base y paleta.
- Inventariar qué API del backend de Nexora existe hoy para cada función administrativa prevista:
  reglas, tarjetas del diccionario semántico (crear, modificar, activar, aprobar) y chat de prueba de peticiones.
- Crear el esqueleto del proyecto con una página de inicio vacía, compilación y una prueba automática.

## Fuera de alcance
- Pantallas funcionales de reglas, tarjetas o chat: son etapas posteriores.
- Cualquier cambio en el backend de Nexora.
- Interfaz para usuarios de negocio, versión móvil y aplicación de escritorio.
- Despliegue en producción.

## Prioridades
1. Calidad técnica: arquitectura profesional, escalable y mantenible por una sola persona.
2. Calidad visual: apariencia profesional y coherente.
3. Rapidez de entrega, en último lugar.

## Criterios de aceptación
- [ ] Hay una decisión escrita que compara al menos dos tecnologías y justifica la elegida con los criterios del proyecto.
- [ ] La decisión define la estructura de carpetas y dónde va cada tipo de código.
- [ ] La decisión presenta dos paletas, una en blanco y vino tinto y otra en blanco y azul, con contraste de texto AA, para que el responsable elija.
- [ ] El inventario indica, para cada función administrativa, qué API existe y cuál falta en el backend.
- [ ] El esqueleto compila y arranca con un solo comando documentado en el README.
- [ ] Existe al menos una prueba automática y pasa.

## Decisiones vigentes que aplican
- Es una herramienta solo administrativa, para configurar Nexora.
- Aplicación web para navegador de escritorio.
- No se toca el backend desde este proyecto.
- El inicio de sesión usa el Keycloak de Nexora; la aplicación no gestiona usuarios ni contraseñas propias.
- Si una función administrativa no tiene API en el backend, esa pantalla espera: no se simula ni se inventa.