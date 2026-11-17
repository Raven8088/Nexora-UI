# 3. Cliente `nexora-console` en Keycloak (pasos exactos)

> **No se ha modificado Keycloak.** Estos son los pasos para que una persona administradora los realice. El secreto
> del cliente no se escribe en este repositorio ni en la documentación.

Realm: `nexora`. `{BASE}` es la URL con la que se abre la consola: en el despliegue Docker local,
**`http://127.0.0.1:8085`** (docs/12-docker.md); `https://consola.ejemplo` detrás de HTTPS.

## 3.1 Crear el cliente

1. *Clients* → *Create client*.
   - Client type: **OpenID Connect**. Client ID: **`nexora-console`**. Name: `Nexora Console`.
2. *Capability config*:
   - Client authentication: **On** (cliente confidencial).
   - Authorization: Off.
   - Authentication flow: **solo Standard flow**. Desactivar Direct access grants, Implicit flow, Service accounts
     roles, OAuth 2.0 Device Authorization Grant y CIBA.
3. *Login settings*:
   - Root URL: `{BASE}`
   - Valid redirect URIs: **`{BASE}/login/oauth2/code/keycloak`** (exacta, sin comodines)
   - Valid post logout redirect URIs: **`{BASE}/`**
   - Web origins: **`{BASE}`**
4. Guardar. Pestaña *Advanced* → *Advanced settings*: **Proof Key for Code Exchange Code Challenge Method = S256**.
5. Pestaña *Credentials*: copiar el *Client secret* y guardarlo **solo** como secreto de Docker con
   `deploy\Set-NexoraConsoleSecret.ps1 -DeployDir <nexora-deploy>` (archivo `nexora-deploy/secrets/nexora_console_client_secret`,
   no versionado; el valor se pide oculto y nunca se muestra). No pegarlo en archivos del repositorio, tickets ni capturas.

## 3.2 Scopes de cliente (audiencias, tenant y roles)

Pestaña *Client scopes* del cliente → *Add client scope*:

- `nexora-semantic` → **Default**
- `nexora-intelligence` → **Default**

Son los scopes ya existentes del realm que añaden la audiencia, el `tenant` y los `roles` que Semantic e Intelligence
validan. Deben ser **Default** (no Optional): el BFF pide solo el scope `openid` (el realm `nexora` no tiene el scope
`profile`; pedirlo produce `LOGIN_ERROR … Invalid scopes: openid profile`). Sin `profile` el token no trae `name` ni
`preferred_username`: la consola muestra entonces el identificador del usuario (`sub`) y nada más depende de ellos.

> **Imprescindible:** en este realm el `sub` del access token lo añade el mapper del scope `nexora-semantic` (no hay
> scope `basic`). Si `nexora-semantic` está como *Optional* en lugar de *Default*, el login en Keycloak funciona pero la
> consola vuelve a la pantalla de acceso: `/bff/session` responde `401` con `"reason":"access_token_without_subject"`
> (doc 12 §12).

> Comprobar con *Client scopes → Evaluate* (usuario de prueba) que el access token contiene `aud` con las audiencias
> de Semantic e Intelligence, `tenant` y `roles`. Si Intelligence valida además el token contra Reports, revisar que
> la cadena de audiencias que hoy usa `nexora-cli` sea la misma (PENDIENTE de verificar en el entorno).

## 3.3 Tipo de principal

Semantic exige `principal_type=HUMAN` para aprobar, y la consola solo concede permisos a principales humanos.
Si el scope `nexora-semantic` no lo añade ya para usuarios, en el *dedicated scope* de `nexora-console`:

- *Add mapper → By configuration → Hardcoded claim*: Name `principal-type`, Token Claim Name `principal_type`,
  Claim value `HUMAN`, Claim JSON type `String`, Add to access token **On**, Add to ID token Off, Add to userinfo Off.

## 3.4 Usuarios

Asignar roles de realm (o los que usen los mappers existentes) según lo que cada persona debe hacer:

| Necesidad | Roles |
|---|---|
| Pedir reportes en el chat | `REPORT_REQUESTER` |
| Consultar el diccionario | `VIEWER` (o cualquiera de catalogRead) |
| Crear/editar borradores y revisar sugerencias | `EDITOR` |
| Aprobar y retirar | `APPROVER` |
| Ver el historial (auditoría) | `AUDITOR` |
| Diagnóstico administrativo del chat | `PLATFORM_ADMIN` (D9) |

El usuario debe tener el atributo/mapeo de `tenant` que ya usan los clientes existentes.

## 3.5 Verificación

1. Arrancar el BFF con las variables del doc 04 y abrir `{BASE}`.
2. *Iniciar sesión* → Keycloak → volver a la consola; en *Configuración* aparecen los roles y la organización.
3. Si vuelve con `?login=failed`: revisar redirect URI exacta, PKCE S256 y el secreto.

## 3.6 Pantalla de inicio de sesión con identidad Nexora (DEC-FE-LOGIN-1)

La página de Keycloak que ve la consola puede usar el tema `nexora-login` (marca «N», fondo claro y vinotinto). El tema está
en `nexora-deploy/keycloak/themes/nexora-login` y viaja en la imagen `nexora/keycloak:26.4.0-nexora.<n>`. Se asigna
**solo a este cliente**, nunca al realm:

- con el script: `nexora-deploy\scripts\Set-NexoraLoginTheme.ps1 -WhatIf`, y después sin `-WhatIf` (reversión: `-Remove`);
- o a mano: pestaña *Settings* → *Login settings* → **Login theme = `nexora-login`** → *Save*.

No cambia nada del flujo de esta guía (redirect URI, PKCE S256, secreto, scopes). Detalles, despliegue y reversión:
`nexora-deploy/docs/CONFIGURATION.md` §13.
