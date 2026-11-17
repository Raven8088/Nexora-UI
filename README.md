# Nexora AI — Consola web (frontend)

Consola web de Nexora AI: chat para pedir reportes en Excel a **Nexora Intelligence** y gestión gobernada del
diccionario semántico de **Nexora Semantic** (consulta, borradores, aprobación, retiro y sugerencias).

| Carpeta | Contenido |
|---|---|
| `web/` | SPA React 18 + TypeScript estricto + Vite + Mantine 7 (sistema de diseño blanco/burdeos) |
| `bff/` | Backend-for-Frontend Java 21 + Spring Boot 4.1 + Spring Security (OIDC con Keycloak, Authorization Code + PKCE) |
| `docs/` | Arquitectura, contratos, Keycloak, configuración, ejecución, guías, pruebas, limitaciones, correcciones pendientes y Docker |
| `deploy/` | Registro de los cambios aplicados en `nexora-deploy`, evidencias de Compose, script del secreto, diagnóstico OIDC y verificación |
| `Dockerfile` | Imagen multi-stage (Node → Maven → JRE 21) |

## Principios

- **SPA + BFF, mismo origen (D1/D3).** El navegador nunca ve tokens: la sesión es una cookie `HttpOnly`; el BFF
  guarda los tokens y llama a Semantic e Intelligence **con el token del propio usuario** (nunca con una cuenta de
  servicio). CSRF con cookie `XSRF-TOKEN` + cabecera `X-XSRF-TOKEN`.
- **Los servicios deciden.** La consola muestra u oculta acciones según los roles, pero Semantic e Intelligence
  vuelven a validar cada llamada. El BFF solo deja pasar una lista cerrada de rutas.
- **Sin cambios en otros repositorios.** Nada de Intelligence, Semantic, Reports, Discovery, contratos, Docker
  Compose ni Keycloak se modificó. Lo que hace falta fuera de este repositorio está en
  [`docs/09-limitaciones-y-dependencias.md`](docs/09-limitaciones-y-dependencias.md).

## Despliegue: Docker Compose (obligatorio)

Nexora Frontend se ejecuta **solo con Docker Compose**, como servicio `frontend` (perfil `frontend`) del despliegue
existente `nexora-deploy`. Imagen multi-stage (`Dockerfile`): SPA compilada con Node, BFF con Maven, ejecución con
Java 21 como usuario sin privilegios. Detalle, redes, variables, secretos, OIDC y comandos en
[`docs/12-docker.md`](docs/12-docker.md).

```powershell
# desde nexora-deploy (servicio ya integrado; pasos completos en docs/12-docker.md §9)
docker compose --profile frontend build frontend
docker compose --profile tenant --profile intelligence --profile frontend up -d --no-deps frontend
```

Abrir `http://127.0.0.1:8085`. Verificación con evidencias: `deploy\Test-NexoraFrontend.ps1`.

## Desarrollo (no es despliegue)

```powershell
cd web
npm ci
npm test            # pruebas automatizadas (datos sintéticos)
npm run build       # comprobación de tipos + build de producción
cd ..\bff
mvn -B clean verify # pruebas del BFF
```

## Documentación

1. [Arquitectura](docs/01-arquitectura.md)
2. [Contratos y rutas](docs/02-contratos-y-rutas.md)
3. [Cliente `nexora-console` en Keycloak (pasos exactos)](docs/03-keycloak-cliente.md)
4. [Configuración](docs/04-configuracion.md)
5. [Ejecución local](docs/05-ejecucion-local.md)
6. [Guía del chat](docs/06-guia-chat.md)
7. [Guía del diccionario y las sugerencias](docs/07-guia-diccionario.md)
8. [Pruebas y resultados](docs/08-pruebas-y-resultados.md)
9. [Limitaciones, riesgos y dependencias externas](docs/09-limitaciones-y-dependencias.md)
10. [Correcciones de evidencia pendientes en otros repositorios (D12)](docs/10-correcciones-evidencia-pendientes.md)
11. [Sistema de diseño](docs/11-sistema-de-diseno.md)
12. [Despliegue con Docker](docs/12-docker.md)
13. [Propuesta: acceso a Intelligence y OIDC](docs/13-propuesta-intelligence-y-oidc.md)

## Estado

Implementación completa de UI-2 a UI-6 en código, con pruebas automatizadas en verde (ver doc 08). **No se ha
probado contra el Keycloak, Semantic e Intelligence reales ni contra Wellnode**: requiere crear el cliente
`nexora-console`, configurar las fuentes y ejecutar las pruebas E2E reales autorizadas.
