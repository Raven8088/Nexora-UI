# 4. Configuración

> En el despliegue Docker (el único admitido), la configuración está en `nexora-deploy/.env` y el secreto en
> `nexora-deploy/secrets/` (doc 12 §4–§5); `compose.yaml` la traduce a las variables de esta tabla. Esta tabla describe
> lo que lee el BFF.

Toda la configuración dependiente de la instalación llega por **variables de entorno** o por un archivo externo
**fuera del repositorio**. Ningún valor real (secretos, ids de tenants o fuentes de un cliente) está en el código.

## 4.1 Variables del BFF

| Variable | Obligatoria | Por defecto | Uso |
|---|---|---|---|
| `NEXORA_KEYCLOAK_ISSUER` | sí | — | Issuer público, exactamente el `iss` de los tokens (`KEYCLOAK_PUBLIC_URL/realms/nexora`) |
| `NEXORA_KEYCLOAK_BACKCHANNEL_URL` | no | el issuer | Dirección del realm alcanzable por el BFF (Docker: `http://keycloak:8180/realms/nexora`) |
| `NEXORA_CONSOLE_CLIENT_ID` | no | `nexora-console` | Cliente OIDC |
| secreto `nexora_console_client_secret` | sí | — | Archivo `/run/secrets/nexora_console_client_secret` (Docker secret); fuera de Docker, `NEXORA_CONSOLE_CLIENT_SECRET` |
| `NEXORA_BFF_SOURCES_<n>_ALIAS` / `_LABEL` / `_DATASOURCEID` / `_TENANTID` | sí | — | Fuentes (D7) en forma de variables (Docker) |
| `NEXORA_SEMANTIC_URL` | no | `http://127.0.0.1:8080` | URL base de Semantic |
| `NEXORA_INTELLIGENCE_URL` | sí | — | URL base de Intelligence (la del edge HAProxy) |
| `NEXORA_CONSOLE_PORT` | no | `8085` | Puerto del BFF |
| `NEXORA_CONSOLE_BIND_ADDRESS` | no | `127.0.0.1` | Interfaz de escucha |
| `NEXORA_CONSOLE_SECURE_COOKIE` | no | `false` | `true` obligatorio detrás de HTTPS |
| `NEXORA_CONSOLE_SESSION_TIMEOUT` | no | `30m` | Inactividad de la sesión |
| `NEXORA_CONSOLE_INTELLIGENCE_TIMEOUT` | no | `300s` | Espera máxima de un reporte |

Otros valores (`nexora.bff.*` en `application.yml`): límites de tamaño (petición 64 KiB, respuesta JSON 4 MiB, Excel
100 MiB), nombres de claims (`roles`, `tenant`, `principal_type`) y roles de diagnóstico (`PLATFORM_ADMIN`).

## 4.2 Fuentes de datos (D7)

Cada fuente une el **alias** (minúsculas, `[a-z0-9][a-z0-9_-]{0,62}`) que entiende Intelligence, el **id** de la fuente en Semantic y el **tenant** que puede
usarla. Ejemplo con valores ficticios (sustituir por los reales en el entorno, nunca en el repositorio):

```yaml
# application-local.yml — fuera del repositorio (está en .gitignore si se deja en bff/config/)
nexora:
  bff:
    sources:
      - alias: demo
        label: Fuente de demostración
        data-source-id: 00000000-0000-4000-8000-000000000001
        tenant-id: 00000000-0000-4000-8000-0000000000aa   # UUID del tenant (claim «tenant»)
```

Arranque con ese archivo:

```powershell
java -jar target\nexora-front-end-bff-0.1.0.jar --spring.config.additional-location=file:C:/ruta/segura/application-local.yml
```

O con `SPRING_APPLICATION_JSON` (PowerShell):

```powershell
$env:SPRING_APPLICATION_JSON = '{"nexora":{"bff":{"sources":[{"alias":"demo","label":"Fuente de demostración","data-source-id":"00000000-0000-4000-8000-000000000001","tenant-id":"00000000-0000-4000-8000-0000000000aa"}]}}}'
```

El selector de la consola muestra solo las fuentes del tenant del usuario. Una petición a una fuente no configurada
para su tenant se rechaza en el BFF (`403 bff_source_not_configured`) y, además, Semantic e Intelligence validan.

## 4.3 Web (desarrollo)

`NEXORA_BFF_URL` (opcional) cambia el destino del proxy de Vite (`http://127.0.0.1:8085` por defecto). En producción
la web la sirve el propio BFF (perfil Maven `with-web`), así que no hay configuración de la web.
