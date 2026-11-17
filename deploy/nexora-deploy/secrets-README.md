# secrets/

Secretos de **esta instalación** que Docker Compose entrega como archivos a los contenedores (`/run/secrets/<nombre>`).
El contenido de esta carpeta **nunca se versiona** (`.gitignore`: `secrets/*`, salvo este README), nunca se copia en
una imagen y nunca se imprime.

| Archivo | Contenedor | Contenido |
|---|---|---|
| `nexora_console_client_secret` | `frontend` (etapa 7, perfil `frontend`) | Secreto del cliente confidencial `nexora-console` de Keycloak |

Crearlo sin mostrarlo (PowerShell, desde esta carpeta), después de crear el cliente en Keycloak:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\desarrollo\Front-end\Nexora-front-end\deploy\Set-NexoraConsoleSecret.ps1" -DeployDir .
```

El script pide el valor oculto (Keycloak: *Clients → nexora-console → Credentials*) y lo escribe sin salto de línea.
Compose no admite secretos de tipo `environment:` en servicios de solo lectura; por eso es un archivo. En un motor
Docker de Linux, el archivo debe ser legible por el usuario 10001 del contenedor.
