# Ficha de etapa E9 · Chat de pruebas de peticiones

## Objetivo
El administrador escribe una pregunta en lenguaje natural, elige la fuente de datos y ve la respuesta de Nexora: informe, aclaración pedida, no soportada o rechazo.

## Alcance
- Decisión del responsable: el chat usa la API real de Nexora Intelligence desde la máquina local, manteniendo la autenticación existente y sin modificar ese motor. Su funcionamiento con Wellnode ya está comprobado con Postman.
- Módulo features/test-chat con sus tres capas.
- Contrato TestChatRepository con la forma de POST /api/v1/questions.
- Repositorio http, activo en environment.development.ts a través del proxy del mismo origen.
- Repositorio simulado con respuestas de cada tipo, para los entornos que no son el local.
- Historial de la conversación solo en memoria.
- Vista de la respuesta: tabla de resultados y mensaje de aclaración.
- Límite de longitud de la pregunta: se toma de la validación de POST /api/v1/questions en Nexora Intelligence, leída en modo solo lectura, y se cita en docs/ con el valor y el archivo de origen.

## Fuera de alcance
- Guardar conversaciones y exportar resultados.
- Uso del chat contra la API real fuera de la máquina local.
- Cualquier cambio en Nexora Intelligence, Semantic o Reports.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] Pruebas de la fachada para cada tipo de respuesta y para unavailable.
- [ ] El envío se bloquea mientras hay una pregunta en curso.
- [ ] Una pregunta que supera el límite documentado en docs/ se rechaza antes de enviarla; probado con ese valor.
- [ ] environment.ts tiene testChat.data = 'simulated' y environment.development.ts usa el repositorio http; lo verifica una prueba.
- [ ] El aviso de datos de demostración aparece en modo simulado.
- [ ] El repositorio http tiene pruebas con HttpTestingController para cada tipo de respuesta.

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
