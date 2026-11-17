# 5. Ejecución

> **El despliegue es solo con Docker Compose** (requisito permanente): ver [12-docker.md](12-docker.md) §9 para
> construir, iniciar, detener y verificar. Este documento conserva los comandos de **desarrollo** (pruebas, build y
> recarga en caliente); ejecutar `java -jar` a mano no es un mecanismo de despliegue.


Un comando por paso. Requisitos: Node 20+ (npm), Java 21, Maven 3.9+, y Keycloak/Semantic/Intelligence en marcha.

## 5.1 Web: dependencias, pruebas y build

```powershell
cd D:\desarrollo\Front-end\Nexora-front-end\web
```
```powershell
npm ci
```
```powershell
npm run typecheck
```
```powershell
npm test
```
```powershell
npm run build
```

## 5.2 BFF: compilar y probar (con la web incluida)

```powershell
cd D:\desarrollo\Front-end\Nexora-front-end\bff
```
```powershell
mvn -B clean verify -Pwith-web
```

`-Pwith-web` copia `web/dist` dentro del jar (`static/`). Sin el perfil se compila solo el BFF.

## 5.3 Arrancar el BFF fuera de Docker (solo desarrollo)

Variables (doc 04) en la misma consola; el secreto se introduce sin dejarlo en el historial, por ejemplo:

```powershell
$env:NEXORA_CONSOLE_CLIENT_SECRET = Read-Host "Secreto de nexora-console" -MaskInput
```
```powershell
$env:NEXORA_KEYCLOAK_ISSUER = "https://<host-keycloak>/realms/nexora"
```
```powershell
$env:NEXORA_INTELLIGENCE_URL = "http://127.0.0.1:<puerto-edge>"
```
```powershell
java -jar target\nexora-front-end-bff-0.1.0.jar --spring.config.additional-location=file:C:/ruta/segura/application-local.yml
```

Abrir `http://127.0.0.1:8085`.

## 5.4 Desarrollo con recarga en caliente

Con el BFF arrancado (5.3) en otra consola:

```powershell
cd D:\desarrollo\Front-end\Nexora-front-end\web
```
```powershell
npm run dev
```

Abrir `http://127.0.0.1:5173` (Vite reenvía `/bff`, `/oauth2` y `/login` al BFF). Para este modo, Keycloak debe tener
además `http://127.0.0.1:5173/login/oauth2/code/keycloak` como redirect URI y `http://127.0.0.1:5173` como web
origin (solo en entornos de desarrollo).

## 5.5 Pruebas E2E reales (opcional, autorizadas)

Solo con una cuenta de prueba controlada y autorización expresa (D11). Son de solo lectura sobre el catálogo.

```powershell
npx playwright install chromium
```
```powershell
$env:NEXORA_E2E_USER = "<usuario de prueba>"; $env:NEXORA_E2E_PASSWORD = Read-Host -MaskInput; $env:NEXORA_E2E_SOURCE = "<alias>"
```
```powershell
$env:NEXORA_E2E_F2 = "<pregunta F2>"; $env:NEXORA_E2E_F3 = "<pregunta F3>"; $env:NEXORA_E2E_F4 = "<pregunta F4>"
```
```powershell
npm run e2e
```

Sin estas variables las pruebas se marcan como omitidas.
