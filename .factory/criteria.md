# Criterios de arquitectura · Nexora UI

- Limpio: cada módulo tiene una sola responsabilidad; la lógica de negocio no vive en los componentes visuales; las dependencias entre capas van en un solo sentido y se comprueban con una herramienta automática.
- Escalable: una función nueva se añade como módulo nuevo sin modificar los existentes; los módulos se cargan bajo demanda.
- Eficiente: ninguna dependencia sin uso justificado; la carga inicial no incluye módulos que el usuario no ha abierto.
- Profesional: tipado estricto, sin errores ni avisos del analizador de código, pruebas automáticas para la lógica y nombres consistentes.
- Visual: paleta blanco y vino tinto, componentes de una sola librería, mismo espaciado y tipografía en todas las pantallas, textos legibles con buen contraste.
- Seguridad: autenticación con Keycloak; ningún secreto ni token en el código.
- Simple: no se añade ninguna capa, patrón o librería que la etapa en curso no necesite.
- Estructura: organización por funcionalidades; cada módulo contiene sus propias capas de presentación, aplicación y datos, y ningún módulo importa de otro salvo de la carpeta compartida.
- Componentes: los componentes de presentación solo reciben datos y emiten eventos; solo los componentes contenedor acceden al estado.
- Estado: cada módulo expone una única fachada; las pantallas no llaman a la API ni manipulan el estado directamente.
- Datos: el acceso a cada API de Nexora pasa por un repositorio con una interfaz definida, sustituible por una implementación simulada cuando la API no existe.
