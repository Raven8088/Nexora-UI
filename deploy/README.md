# deploy/

| Archivo | Qué es |
|---|---|
| `nexora-deploy/*.diff`, `nexora-deploy/secrets-README.md` | Cambios **aplicados** en `nexora-deploy` el 2026-11-11 (D-FE-3), como registro |
| `evidence/compose-efectivo-frontend.json` | Compose efectivo del servicio `frontend` revisado antes de aplicar |
| `evidence/compose-hashes.txt` | Hashes de configuración de los servicios existentes antes y después (idénticos) |
| `Set-NexoraConsoleSecret.ps1` | Escribe el secreto de `nexora-console` en `nexora-deploy/secrets/` sin mostrarlo |
| `Test-NexoraOidcReachability.ps1` | D-FE-2: diagnóstico de solo lectura del issuer desde Windows y desde los contenedores |
| `Test-NexoraFrontend.ps1` | Verificación con evidencias del contenedor `frontend` (doc 12 §10) |

Los scripts de PowerShell no se han podido ejecutar en el entorno de Claude (sin PowerShell); revisarlos al primer uso.
