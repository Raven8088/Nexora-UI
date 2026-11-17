# 6. Guía del chat

1. Elegir la **fuente de datos** en la cabecera (solo aparecen las autorizadas para tu organización).
2. Escribir la pregunta (máx. 2000 caracteres) y pulsar **Enviar** (Intro envía; Mayús+Intro, nueva línea).
3. Nexora responde con:
   - **Aclaración**: botones con las opciones; caduca a la hora indicada. Si caduca, haz la pregunta de nuevo.
   - **Reporte**: tarjeta con nombre, tamaño, completitud (Completo / Parcial) y avisos; botón **Descargar Excel**.
   - **No se puede responder**: la explicación de negocio tal como la da Nexora.
   - **Resultado desconocido / no enviado**: botón **Reintentar la misma solicitud** (misma clave: Nexora no la
     ejecuta dos veces).
4. **Reportes de la sesión** lista todos los Excel generados mientras la página siga abierta.

> Los Excel y las conversaciones **no se guardan**: se pierden al cerrar o recargar la página (D8). Descárgalos.

**Diagnóstico** (solo `PLATFORM_ADMIN`): panel lateral con la solicitud enviada, alias, clave de idempotencia, estado
HTTP y funcional, ids de aclaración, ejecución y plan, tiempos (navegador y BFF), avisos, huella SHA-256 y respuesta
estructurada. Nunca muestra tokens ni cookies.
