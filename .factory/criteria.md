# Criterios de arquitectura de Nexora UI

## Qué significa «limpio» aquí
- Capas separadas: pantallas, componentes de interfaz, lógica de la aplicación y acceso a las API. Una pantalla nunca llama a la red directamente.
- Un módulo por función administrativa (reglas, tarjetas, chat). Un módulo no importa de otro módulo, solo de lo compartido.
- Tipado estático en todo el código.
- Cada dato que viene de una API tiene una sola definición, derivada del contrato del backend.
- La decisión de arquitectura nombra el patrón que se usa y explica dónde va cada tipo de código.
- Los límites entre capas y entre módulos se comprueban con una regla automática, no solo por convención.

## Qué significa «eficiente» aquí
- La primera carga tarda menos de 3 segundos en la red local.
- Cada pantalla carga su código solo cuando se abre.
- Una lista de 5.000 elementos se puede recorrer y filtrar sin que la interfaz se bloquee.

## Qué significa «escalable» aquí
- Añadir una pantalla nueva no obliga a modificar las existentes.
- La estructura soporta crecer de 3 a 20 pantallas sin reorganizar carpetas.
- La usan pocos administradores a la vez (menos de 20): no se añade infraestructura para alta concurrencia.

## Restricciones que no se negocian
- Inicio de sesión con Keycloak. Los tokens no se guardan en almacenamiento persistente del navegador.
- El tenant y los permisos salen de la sesión verificada, nunca de un valor que el usuario pueda escribir.
- Ningún secreto en el código de la interfaz.
- Un único sistema de diseño: colores, tipografía y espaciado definidos una vez. Ninguna pantalla usa un color o una medida sueltos.
- Contraste de texto AA. Navegadores: versiones actuales de Chrome y Edge.
- Toda la lógica de la aplicación tiene pruebas unitarias y cada pantalla tiene al menos una prueba.
- Cada dependencia tiene mantenimiento activo y licencia permisiva, y su incorporación se justifica.
