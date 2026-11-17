<#
.SYNOPSIS
  Stage 7 (Nexora Frontend in Docker): builds, starts and verifies the frontend container of nexora-deploy and writes
  the evidence (PASS/FAIL/WARN/INFO per check) to the console and to a file. Never prints secrets or tokens.

.DESCRIPTION
  Run from any folder with Docker Desktop running and the rest of Nexora already started (stages 1-6). Steps:
    0. prerequisites: compose profile "frontend" present, secret file present (content never read except to search
       for it in logs and image metadata), the issuer reachable FROM WINDOWS (the browser needs it);
    1. docker compose build of the image;
    2. image: no secret in its environment, labels or history; runs as 10001;
    3. start of ONLY the frontend (--no-deps: running containers are not touched) and its healthcheck;
    4. interface (/), liveness (/bff/health), API without session (401 JSON);
    5. redirection to Keycloak: public issuer, client nexora-console, PKCE S256, exact redirect_uri;
    6. connectivity FROM the container: Keycloak (internal metadata with the same issuer), Semantic (401 without
       token: reachable and still protected), Intelligence through intelligence-edge (401 without token = the local
       client is accepted and authentication is still required; 403 local_only until docs/13 section A is applied);
    7. logs: no secret, no bearer token, no JWT;
    8. what needs a person: sign in in the browser and check identity, roles and tenant at /bff/session.
  -SkipBuild uses the existing image. -Evidence chooses the evidence file (default: .\evidence-frontend-<time>.txt).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\Test-NexoraFrontend.ps1 -DeployDir "D:\desarrollo\java\Nexora AI\nexora-deploy"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DeployDir,
    [switch]$SkipBuild,
    [string]$Evidence
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$deploy = (Resolve-Path -LiteralPath $DeployDir).Path
if (-not $Evidence) { $Evidence = Join-Path (Get-Location) ("evidence-frontend-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss')) }
$results = New-Object System.Collections.Generic.List[string]
$failed = 0

function Out-Result([string]$Status, [string]$Check, [string]$Detail = '') {
    $line = '{0,-5} {1}{2}' -f $Status, $Check, $(if ($Detail) { " - $Detail" } else { '' })
    $results.Add($line); Write-Host $line
    if ($Status -eq 'FAIL') { $script:failed++ }
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        $text = (& $File @Arguments 2>&1 | ForEach-Object { "$_" }) -join "`n"
        return [pscustomobject]@{ Code = $LASTEXITCODE; Text = $text }
    } finally { $ErrorActionPreference = $previous }
}

# Only non-secret keys of .env are read.
function Get-EnvValue([string]$Name, [string]$Default) {
    $file = Join-Path $deploy '.env'
    foreach ($line in [IO.File]::ReadAllLines($file)) {
        if ($line -match "^\s*$([regex]::Escape($Name))=(.*)$") { $v = $Matches[1].Trim(); if ($v) { return $v } }
    }
    return $Default
}

$profiles = @('--profile', 'tenant', '--profile', 'intelligence', '--profile', 'frontend')
function Compose([string[]]$Arguments) {
    Push-Location $deploy
    try { return Invoke-Native 'docker' (@('compose') + $profiles + $Arguments) } finally { Pop-Location }
}

$publicUrl = (Get-EnvValue 'KEYCLOAK_PUBLIC_URL' '').TrimEnd('/')
$issuer = "$publicUrl/realms/nexora"
$port = Get-EnvValue 'FRONTEND_HOST_PORT' '8085'
$intelligencePort = Get-EnvValue 'INTELLIGENCE_HOST_PORT' '8101'
$tag = Get-EnvValue 'NEXORA_IMAGE_TAG' 'dev'
$image = "nexora/frontend:$tag"
$base = "http://127.0.0.1:$port"
$secretFile = Join-Path $deploy 'secrets\nexora_console_client_secret'
Out-Result 'INFO' 'evidence' "$(Get-Date -Format o) deploy=$deploy issuer=$issuer console=$base"

# 0. Prerequisites ---------------------------------------------------------------------------------------------------
$services = Compose @('config', '--services')
if ($services.Code -eq 0 -and ($services.Text -split "`n") -contains 'frontend') { Out-Result 'PASS' '0.1 compose defines service frontend (profile frontend)' }
else { Out-Result 'FAIL' '0.1 compose defines service frontend' 'apply deploy/nexora-deploy/*.diff first'; throw 'stopped' }
if (Test-Path -LiteralPath $secretFile) { Out-Result 'PASS' '0.2 Docker secret file present' 'secrets\nexora_console_client_secret (content not shown)' }
else { Out-Result 'FAIL' '0.2 Docker secret file present' 'run deploy\Set-NexoraConsoleSecret.ps1'; throw 'stopped' }
$issuerUri = [Uri]$issuer
$tcp = Test-NetConnection -ComputerName $issuerUri.Host -Port $issuerUri.Port -WarningAction SilentlyContinue
if ($tcp.TcpTestSucceeded) { Out-Result 'PASS' '0.3 the browser can reach the issuer' "$($issuerUri.Host):$($issuerUri.Port) -> $($tcp.RemoteAddress)" }
else { Out-Result 'FAIL' '0.3 the browser can reach the issuer' "$($issuerUri.Host):$($issuerUri.Port) not reachable from Windows (decision D-FE-2, docs/12-docker.md)" }
try {
    $meta = Invoke-RestMethod -UseBasicParsing -Uri "$issuer/.well-known/openid-configuration" -TimeoutSec 10
    if ($meta.issuer -eq $issuer) { Out-Result 'PASS' '0.4 public metadata declares the configured issuer' }
    else { Out-Result 'FAIL' '0.4 public metadata declares the configured issuer' "declared $($meta.issuer)" }
} catch { Out-Result 'FAIL' '0.4 public metadata from Windows' $_.Exception.Message }

# 1. Build -----------------------------------------------------------------------------------------------------------
if (-not $SkipBuild) {
    $build = Compose @('build', 'frontend')
    if ($build.Code -eq 0) { Out-Result 'PASS' '1.1 image built' $image } else { Out-Result 'FAIL' '1.1 image built' ($build.Text -split "`n" | Select-Object -Last 5) -join ' | '; throw 'stopped' }
}
$secretValue = [IO.File]::ReadAllText($secretFile).Trim()

# 2. Image -----------------------------------------------------------------------------------------------------------
$inspect = Invoke-Native 'docker' @('image', 'inspect', $image)
$history = Invoke-Native 'docker' @('history', '--no-trunc', $image)
if ($inspect.Code -ne 0) { Out-Result 'FAIL' '2.1 image exists' $image; throw 'stopped' }
if ($inspect.Text.Contains($secretValue) -or $history.Text.Contains($secretValue)) { Out-Result 'FAIL' '2.1 no secret in image metadata or history' }
else { Out-Result 'PASS' '2.1 no secret in image metadata or history' }
$cfg = ($inspect.Text | ConvertFrom-Json)[0].Config
if ($cfg.User -eq '10001:10001') { Out-Result 'PASS' '2.2 runs as unprivileged user' $cfg.User } else { Out-Result 'FAIL' '2.2 runs as unprivileged user' "$($cfg.User)" }
$envNames = @($cfg.Env | ForEach-Object { ($_ -split '=', 2)[0] })
if (@($envNames | Where-Object { $_ -match 'SECRET|PASSWORD|TOKEN' }).Count -eq 0) { Out-Result 'PASS' '2.3 no credential variable in the image' ($envNames -join ',') }
else { Out-Result 'FAIL' '2.3 no credential variable in the image' }

# 3. Start and health ------------------------------------------------------------------------------------------------
$up = Compose @('up', '-d', '--no-deps', 'frontend')
if ($up.Code -eq 0) { Out-Result 'PASS' '3.1 container started (only frontend; other containers untouched)' } else { Out-Result 'FAIL' '3.1 container started' ($up.Text -split "`n" | Select-Object -Last 3) -join ' | ' }
$container = (Compose @('ps', '-q', 'frontend')).Text.Trim()
$health = ''
for ($i = 0; $i -lt 40; $i++) {
    $health = (Invoke-Native 'docker' @('inspect', '--format', '{{.State.Health.Status}}', $container)).Text.Trim()
    if ($health -eq 'healthy' -or $health -eq 'unhealthy') { break }
    Start-Sleep -Seconds 5
}
if ($health -eq 'healthy') { Out-Result 'PASS' '3.2 healthcheck' $health } else { Out-Result 'FAIL' '3.2 healthcheck' "$health (docker compose logs frontend)" }
$ports = (Invoke-Native 'docker' @('port', $container, '8085')).Text.Trim()
if ($ports -match '^127\.0\.0\.1:') { Out-Result 'PASS' '3.3 published only on 127.0.0.1' $ports } else { Out-Result 'FAIL' '3.3 published only on 127.0.0.1' $ports }

# 4. Interface -------------------------------------------------------------------------------------------------------
try {
    $page = Invoke-WebRequest -UseBasicParsing -Uri "$base/" -TimeoutSec 10
    if ($page.StatusCode -eq 200 -and $page.Content -match 'id="root"') { Out-Result 'PASS' '4.1 interface served' "$base/" } else { Out-Result 'FAIL' '4.1 interface served' "$($page.StatusCode)" }
    $csp = $page.Headers['Content-Security-Policy']
    if ($csp -and $csp -match "default-src 'self'") { Out-Result 'PASS' '4.2 security headers' 'CSP present' } else { Out-Result 'FAIL' '4.2 security headers' 'no CSP' }
} catch { Out-Result 'FAIL' '4.1 interface served' $_.Exception.Message }
try {
    $h = Invoke-RestMethod -UseBasicParsing -Uri "$base/bff/health" -TimeoutSec 10
    if ($h.status -eq 'UP') { Out-Result 'PASS' '4.3 /bff/health' 'UP' } else { Out-Result 'FAIL' '4.3 /bff/health' "$($h.status)" }
} catch { Out-Result 'FAIL' '4.3 /bff/health' $_.Exception.Message }
$s = Invoke-Native 'curl.exe' @('-s', '-o', 'NUL', '-w', '%{http_code}', "$base/bff/session")
if ($s.Text -eq '401') { Out-Result 'PASS' '4.4 API requires a session' '401' } else { Out-Result 'FAIL' '4.4 API requires a session' $s.Text }

# 5. Redirection to Keycloak -----------------------------------------------------------------------------------------
$r = Invoke-Native 'curl.exe' @('-s', '-o', 'NUL', '-w', '%{http_code} %{redirect_url}', "$base/oauth2/authorization/keycloak")
$code, $location = $r.Text -split ' ', 2
if (-not $location) { $location = '' }
# Compare decoded parameters (the encoding of reserved characters is not significant).
$decoded = [Uri]::UnescapeDataString($location.Replace('+', ' '))
$checks = @(
    @('5.1 302 to the authorization endpoint of the PUBLIC issuer', ($code -eq '302' -and $location.StartsWith("$issuer/protocol/openid-connect/auth"))),
    @('5.2 client_id=nexora-console', ($decoded -match '[?&]client_id=nexora-console(&|$)')),
    @('5.3 PKCE S256', ($decoded -match '[?&]code_challenge_method=S256(&|$)' -and $decoded -match '[?&]code_challenge=[A-Za-z0-9_-]{43}(&|$)')),
    @('5.4 exact redirect_uri', ($decoded -match ('[?&]redirect_uri=' + [regex]::Escape("$base/login/oauth2/code/keycloak") + '(&|$)'))),
    @('5.5 scope openid (the realm has no "profile" scope)', ($decoded -match '[?&]scope=openid(&|$)'))
)
foreach ($c in $checks) { if ($c[1]) { Out-Result 'PASS' $c[0] } else { Out-Result 'FAIL' $c[0] "status=$code" } }
$keycloakPage = Invoke-Native 'curl.exe' @('-s', '-o', 'NUL', '-w', '%{http_code}', $location)
if ($keycloakPage.Text -eq '200') { Out-Result 'PASS' '5.6 Keycloak login page opens for that request (client and redirect_uri accepted)' }
else { Out-Result 'FAIL' '5.6 Keycloak login page for that request' "HTTP $($keycloakPage.Text): client nexora-console missing or redirect URI not registered (docs/03)" }

# 6. Connectivity from the container ---------------------------------------------------------------------------------
function Probe([string]$HostName, [int]$Port, [string]$Request) {
    $script = "exec 3<>/dev/tcp/$HostName/$Port && printf '$Request' >&3 && head -c 4096 <&3"
    return Compose @('exec', '-T', 'frontend', 'bash', '-c', $script)
}
$kc = Probe 'keycloak' 8180 'GET /realms/nexora/.well-known/openid-configuration HTTP/1.0\r\nHost: keycloak:8180\r\n\r\n'
if ($kc.Text -match [regex]::Escape("`"issuer`":`"$issuer`"")) { Out-Result 'PASS' '6.1 Keycloak internal metadata declares the public issuer' 'backchannel http://keycloak:8180' }
else { Out-Result 'FAIL' '6.1 Keycloak internal metadata declares the public issuer' }
$sem = Probe 'semantic' 8080 'GET /api/v1/data-sources/00000000-0000-0000-0000-000000000000/definitions HTTP/1.0\r\nHost: semantic:8080\r\n\r\n'
if ($sem.Text -match '^HTTP/1\.[01] 401') { Out-Result 'PASS' '6.2 Semantic reachable and protected' '401 without token' } else { Out-Result 'FAIL' '6.2 Semantic reachable and protected' (($sem.Text -split "`n")[0]) }
$int = Probe 'intelligence-edge' ([int]$intelligencePort) "POST /api/v1/report-requests HTTP/1.0\r\nHost: intelligence-edge:$intelligencePort\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}"
$first = ($int.Text -split "`n")[0]
if ($int.Text -match '^HTTP/1\.[01] 401') { Out-Result 'PASS' '6.3 Intelligence reachable through intelligence-edge, authentication still required' $first }
elseif ($int.Text -match 'local_only') { Out-Result 'WARN' '6.3 Intelligence through intelligence-edge' 'local_only: expected until the trusted-client change of Intelligence (docs/13 section A); the chat is not available yet' }
else { Out-Result 'WARN' '6.3 Intelligence through intelligence-edge' "$first (profile intelligence running?)" }

# 7. Logs ------------------------------------------------------------------------------------------------------------
$logs = Compose @('logs', '--no-color', 'frontend')
if ($logs.Text.Contains($secretValue)) { Out-Result 'FAIL' '7.1 no client secret in logs' } else { Out-Result 'PASS' '7.1 no client secret in logs' }
if ($logs.Text -match 'Bearer\s+[A-Za-z0-9\-_\.]{10,}|eyJ[A-Za-z0-9_\-]{10,}\.') { Out-Result 'FAIL' '7.2 no token in logs' } else { Out-Result 'PASS' '7.2 no token in logs' }
$secretValue = $null

# 8. Needs a person --------------------------------------------------------------------------------------------------
Out-Result 'TODO' '8.1 sign in at the console' "$base -> Iniciar sesion -> Keycloak -> back to the console"
Out-Result 'TODO' '8.2 identity, roles and tenant' "open $base/bff/session after signing in: name, roles, tenant, permissions, sources (alias)"
Out-Result 'TODO' '8.3 F2-F4 from the interface' 'only with the authorized test account (D11); not declared until done'

[IO.File]::WriteAllLines($Evidence, $results)
Write-Host "Evidence: $Evidence ($failed failed)"
if ($failed -gt 0) { exit 1 }
