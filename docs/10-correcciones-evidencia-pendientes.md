# 10. Correcciones de evidencia pendientes en otros repositorios (D12)

Por D12 **no se modificaron** los documentos maestros de otros repositorios. Se registran aquí las correcciones
propuestas, para aplicarlas solo con autorización expresa.

| Documento | Ubicación | Situación actual | Corrección propuesta | Fuente |
|---|---|---|---|---|
| A1 | §37, P-INC2-1 | `mvn -B clean verify` de Intelligence con FIX1/FIX2: «No consta» | **CUMPLIDO (VERIFICADO-WINDOWS, usuario):** FIX1 1.068 pruebas y FIX2 1.075 pruebas, ambos BUILD SUCCESS | Resultado aportado por el usuario |
| A1 | §37, P-INC2-2 | Repetir las 5 clases de Semantic (42 pruebas): «No consta» | **CUMPLIDO (VERIFICADO-WINDOWS):** 56 pruebas, 0 fallos, BUILD SUCCESS. La cifra de 42 era una estimación incorrecta | Resultado aportado por el usuario |
| A1 | §37, P-INC2-4 y fila CONF-INC2-ENV | Configuración «INFERIDA»: `entity-gate=on`, `measure-support=observe` | **VERIFICADA (usuario):** `ENTITY_GATE=on`, `MEASURE_SUPPORT=observe`. Las versiones de las imágenes desplegadas siguen sin constar | Confirmación del usuario |
| A2 | §15.3 | Recuento previsto de las clases repetidas de Semantic | Sustituir la previsión por el resultado verificado: 56 pruebas, 0 fallos | Ídem P-INC2-2 |
| README_MAESTRO | Aviso de estado | Sin referencia a los resultados verificados de P-INC2-1/2/4 | Añadir aviso: «P-INC2-1, P-INC2-2 y P-INC2-4 verificados en Windows (2026-11); quedan P-INC2-3, -5, -6, -7, -8» | — |

Siguen abiertos: P-INC2-3 (regresión con el modelo real tras FIX2), P-INC2-5 (precisiones DEC-INC2-BC-10-P),
P-INC2-6 (habilitación del piloto), P-INC2-7 (fases D/E), P-INC2-8 (versión v1.9 del maestro, solo si se decide).

## Relación con la consola

La consola **no cambia** ninguna de estas evidencias: su validación funcional real (F2–F4 a través de la consola) es
una evidencia nueva, pendiente de ejecución (doc 08 §8.3).
