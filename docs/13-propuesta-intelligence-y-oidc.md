# 13. Propuesta única: acceso del BFF a Intelligence (D-FE-1) y OIDC con el issuer publicado (D-FE-2)

Estado: **§A APROBADA E IMPLEMENTADA como DEC-D-FE-1** (2026-11-11, «Procede con DEC-D-FE-1»; Documento Maestro A1 §38,
A2 §16), pendiente de Windows, despliegue y F2–F4 desde la consola. **§B (OIDC) ya no aplica:** el login con el issuer
publicado funciona; la causa del fallo de sesión fue la asignación de scopes del cliente en Keycloak. Las dos partes son independientes: con B resuelto funcionan el login y el Diccionario; con A, además, el chat.

---

## A. Intelligence: cliente confiable explícito (sustituye a la "autoridad local", rechazada)

### A.1 Mecanismo actual (leído en el código, VERIFICADO)

`ReportRequestFilter` (orden máximo, antes del controlador) aplica `LocalRequestPolicy.allows(...)`:

1. **Par TCP**: loopback o una IP literal de `allowed-peers` (en Docker, solo `intelligence-edge`, `10.250.1.2`).
2. **Host**: exactamente `localhost`, `127.0.0.1` o `[::1]` con el puerto de llegada (anti *DNS rebinding*).
3. **Origin**: ausente o exactamente un origen local con ese puerto.

Si falla, responde `403 local_only` y registra el par. Si pasa y la autenticación está activa
(`ReportRequestAuthentication`): un solo `Bearer`, firma RS256 con el JWKS interno, `iss`, `aud=nexora-intelligence`,
`exp`, `principal_type=HUMAN`, rol `REPORT_REQUESTER` y `tenant` UUID (que luego `ReportRequestHandler` compara con el
de la fuente). El solicitante queda como huella SHA-256 de `iss`+`sub`. Nada del token se registra.

El BFF llega por la red `nexora-intelligence-edge` → `intelligence-edge` (TCP transparente) → Intelligence, con
`Host: intelligence-edge:8101` y sin `Origin`. Intelligence ve el par permitido, pero rechaza el `Host` → `local_only`.

### A.2 Cambio propuesto (mínimo)

Un tercer camino, **cerrado por configuración y nunca por defecto**: *cliente confiable*. Se acepta una petición que
no es local solo si se cumplen **todas** estas condiciones:

| Condición | Qué protege |
|---|---|
| Par TCP ∈ `allowed-peers` (**no** loopback) | Solo llega por `intelligence-edge`; las restricciones de red no cambian |
| `Host` es **exactamente** una autoridad configurada (`intelligence-edge:<puerto de llegada>`), nunca un nombre local | Lista explícita; un navegador en Windows no resuelve `intelligence-edge` |
| **Sin** cabecera `Origin` | Las peticiones POST de un navegador siempre llevan `Origin`: se excluyen |
| Token válido con **todas** las comprobaciones actuales (issuer, firma, audiencia, `HUMAN`, `REPORT_REQUESTER`, tenant) | Autenticación y autorización del usuario intactas |
| `azp` del token = `client-id` configurado (`nexora-console`) | Solo el BFF autorizado: `nexora-console` es confidencial (secreto solo en el BFF), solo *standard flow* con PKCE y redirect exacta. Un token de `nexora-cli` u otro cliente → `403 forbidden` |

Configuración (Intelligence en Docker, `nexora-deploy/config/intelligence/application-deploy.yml`):

```yaml
nexora.intelligence.reporting.api:
  trusted-clients:
    - name: nexora-console                     # aparece en la auditoría
      authority: intelligence-edge:${INTELLIGENCE_PORT}
      client-id: nexora-console                # azp exigido
```

Código (Intelligence; esbozo exacto del alcance, sin aplicar):

1. `ReportRequestApiProperties`: `List<TrustedClient> trustedClients` con `record TrustedClient(String name, String
   authority, String clientId)`. Validación al arrancar: requiere `authentication.enabled=true` y `allowed-peers` no
   vacío; `authority` = `nombre:puerto` con nombre DNS (`[a-z0-9]([a-z0-9-.]{0,62})`), **nunca** `localhost`,
   `127.0.0.1`, `[::1]` ni una IP; `name` y `client-id` no vacíos; autoridades únicas. Vacío por defecto (sin cambio
   de comportamiento).
2. `LocalRequestPolicy`: `static Optional<TrustedClient> trustedClient(remote, host, origins, localPort,
   allowedPeers, trustedClients)`: par en `allowedPeers` y no loopback; `origins` vacío; `host` igual (sin
   distinguir mayúsculas) a `authority` y su puerto = `localPort`.
3. `ReportRequestAuthentication.Authenticated`: añade `authorizedParty` (claim `azp`, o vacío). Sin otros cambios.
4. `ReportRequestFilter`: si `allows(...)` (camino local) → igual que hoy. Si no, y hay `trustedClient` → autenticar;
   `Authenticated` con `azp == clientId` → seguir; con otro `azp` → `403 forbidden` y evento
   `rejected code=untrusted_client client=<name>`; `Unauthenticated` → `401` como hoy. Si no hay coincidencia →
   `local_only` como hoy.
5. Auditoría (`ReportRequestEvents`): el filtro deja el canal (`local` o `client:<name>`) como atributo y los eventos
   existentes (`requestText`, `clarificationAnswer`, `result`) lo añaden: `channel=client:nexora-console`. Nunca
   token, `sub` ni `azp` de clientes no configurados.
6. `ReportRequestApiConfiguration`: pasa `trustedClients` al filtro y lo anuncia en el log de arranque.

Nada más cambia: ni `intelligence-edge`, ni las redes, ni el par permitido, ni el camino local, ni el BFF (que ya
envía `Host: intelligence-edge:8101`, sin `Origin`, con el token del usuario).

### A.3 Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Un proceso local de Windows envía `Host: intelligence-edge:8101` | Necesita además un token `azp=nexora-console`, que solo obtiene el BFF; un proceso local ya puede llamar hoy por el camino local con cualquier token válido: no hay ampliación |
| Página web maliciosa (*DNS rebinding*) | Lleva `Origin` (rechazado) y no puede fijar `Host: intelligence-edge` |
| Otro contenedor en `nexora-intelligence-edge` | Hoy solo `intelligence-edge` y `frontend` (IP fija); y sigue necesitando token `nexora-console` |
| Token de `nexora-console` robado | Mismo riesgo que hoy con cualquier token; vida corta, ligado al usuario, rol y tenant |
| `azp` ausente en el token | Keycloak lo incluye en los access tokens (INFERIDO; comprobar con *Client scopes → Evaluate*); sin `azp` → 403 |
| Configuración que abra de más | Validación al arrancar (nunca nombres locales, nunca vacío por defecto, exige autenticación y par) |
| *Token exchange* de Keycloak emitiendo `azp=nexora-console` | Desactivado por defecto en Keycloak 26; no habilitarlo para este cliente |

### A.4 Pruebas necesarias (Intelligence)

- `LocalRequestPolicyTest`: autoridad exacta acepta; otro nombre, otro puerto, sin puerto, mayúsculas/espacios, nombre
  local configurado, IP configurada → rechazo; con `Origin` → rechazo; par loopback o no permitido → rechazo.
- `ReportRequestApiPropertiesTest`: arranque rechazado sin autenticación, sin `allowed-peers`, autoridad local o IP,
  duplicados, campos vacíos; lista vacía = comportamiento actual.
- `AuthenticatedReportRequestFilterTest`: cliente confiable con `azp` correcto llega al controlador con su solicitante
  y canal; `azp` distinto → 403 `forbidden` + evento `untrusted_client`; sin token → 401; token sin rol, de servicio
  o sin tenant → 403 (igual que hoy); los tests actuales (`local_only` para otro Host) siguen pasando.
- `ReportRequestAuthenticationTest`: `azp` expuesto, sin `azp`.
- `ReportRequestEventsLocationTest`/eventos: el canal aparece; nunca token ni `sub`.
- Regresión completa `mvn -B clean verify` (hoy 1.075 pruebas).
- Prueba viva en Docker: desde el contenedor `frontend`, sin token → 401 (ya no `local_only`); con token de
  `nexora-cli` → 403; F2–F4 desde la consola con cuenta autorizada.

Cambios fuera de Intelligence que requerirá: `application-deploy.yml` (bloque anterior) y recrear solo `intelligence`.

---

## B. OIDC con el issuer publicado (validación estricta)

### B.1 Hechos (VERIFICADO en `nexora-deploy`)

- Issuer de todos los tokens: `KEYCLOAK_PUBLIC_URL/realms/nexora` = `http://host.docker.internal:8180/realms/nexora`
  (fijado por `KC_HOSTNAME`). Semantic, Reports e Intelligence comparan el `iss` exacto.
- Keycloak publicado **solo** en `127.0.0.1:8180`. `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`: por `keycloak:8180` responde
  con el mismo issuer.
- El BFF ya es estricto: navegador al origen del issuer; token/JWKS/userinfo por `keycloak:8180`; `iss` validado;
  rechaza arrancar ante cualquier incoherencia.
- La pieza que falta comprobar: si el **navegador de Windows** abre `http://host.docker.internal:8180`.

### B.2 Comprobación (preparada, solo lectura)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\desarrollo\Front-end\Nexora-front-end\deploy\Test-NexoraOidcReachability.ps1" -DeployDir "D:\desarrollo\java\Nexora AI\nexora-deploy" -Containers
```

Resuelve el nombre en Windows (y muestra las líneas del archivo hosts que lo mencionan, sin cambiarlo), indica en qué
direcciones escucha el puerto 8180, prueba TCP y los metadatos por el nombre público y por 127.0.0.1, y desde el
contenedor `semantic` en marcha (solo `getent` y una conexión TCP) cómo lo ven los contenedores. M1: abrir
`http://host.docker.internal:8180/realms/nexora/.well-known/openid-configuration` en Chrome/Edge.

### B.3 Decisión según el resultado

- **OK** → no hay que cambiar nada: la consola funciona con el issuer actual.
- **BLOCK** (esperado si el nombre resuelve a la IP de la LAN y Keycloak escucha solo en loopback) → **propuesta B.4**.

### B.4 Propuesta: issuer `http://keycloak.localhost:8180` (sin tocar el archivo hosts)

Un nombre bajo `.localhost` que todos alcanzan, con un único issuer para todos:

| Quién | Cómo llega a `keycloak.localhost:8180` |
|---|---|
| Navegador | Chrome, Edge y Firefox resuelven `*.localhost` a loopback sin consultar DNS ni el archivo hosts (RFC 6761); `127.0.0.1:8180` es Keycloak. Además es un contexto seguro aunque sea HTTP (cookies de Keycloak) |
| Contenedores que abren el issuer (solo Reports, en su descubrimiento OIDC) | `extra_hosts: "keycloak.localhost:host-gateway"`, el mismo camino que hoy usa `host.docker.internal` |
| Semantic, Intelligence, frontend (claves, token) | Sin cambios: red interna `keycloak:8180`; solo comparan el `iss` |

Cambios (requieren autorización; tocan la configuración de otros servicios):

1. `.env`: `KEYCLOAK_PUBLIC_URL=http://keycloak.localhost:8180`.
2. `compose.yaml`: añadir `keycloak.localhost:host-gateway` a los `extra_hosts` de `reports`. El frontend no lo necesita: solo compara el origen de los endpoints del navegador con el del issuer.
3. Recrear `keycloak`, `semantic`, `reports`, `intelligence` y `frontend` (el `iss` cambia: los tokens emitidos antes
   dejan de valer; duran minutos).
4. Revisar el entorno local de Postman si guarda el issuer.

Riesgos: es una migración de todo el sistema (ventana corta sin servicio); herramientas de Windows que no usan el
navegador (PowerShell) quizá no resuelvan `keycloak.localhost` (los scripts actuales usan `127.0.0.1` o
`KEYCLOAK_ADMIN_URL`); un navegador antiguo o con política corporativa distinta. Validación: el script B.2 (debe dar
OK), `scripts\Test-NexoraOidc.ps1`, Reports *healthy* (su descubrimiento en el issuer), login en la consola y
`/bff/session` con roles y tenant.

Descartadas: archivo hosts (no autorizado), publicar Keycloak en la IP de la LAN (lo expone a la red), issuer dinámico
(rompe la validación del `iss`), que el BFF haga de proxy de Keycloak (Keycloak genera sus URLs con `KC_HOSTNAME`; sería
interponerse en el login), `localhost` como issuer (dentro de un contenedor es el propio contenedor: obligaría a cambiar
Reports). Con un dominio real con HTTPS no hay limitación (CONFIGURATION.md §3); es la opción para un despliegue que no
sea un solo equipo.
