<#
.SYNOPSIS
  D-FE-2: READ-ONLY diagnosis of whether the published issuer (KEYCLOAK_PUBLIC_URL) works from the browser of this
  Windows computer and from the containers. Changes nothing: no hosts file, no Docker Desktop setting, no container.

.DESCRIPTION
  Reads only KEYCLOAK_PUBLIC_URL and KEYCLOAK_HOST_PORT from nexora-deploy\.env. Checks:
    W1  how Windows resolves the issuer's host name (every address) and the matching lines of the hosts file;
    W2  on which local addresses Keycloak's published port is listening;
    W3  TCP connection to <issuer host>:<port> (what the browser will try);
    W4  the issuer's metadata through that name (HTTP 200 and issuer = KEYCLOAK_PUBLIC_URL/realms/nexora);
    W5  the same metadata through 127.0.0.1 (Keycloak itself: issuer fixed by KC_HOSTNAME);
    C1  with -Containers: from the RUNNING semantic container (docker compose exec, read-only commands: getent and a
        TCP connection), how containers resolve and reach the issuer's host, and the internal address keycloak:8180.
  Then prints the verdict: OK (the current issuer works for browser and containers: nothing to change) or BLOCKED
  (with the reason). The browser check M1 is manual: open the printed URL in Chrome/Edge.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\Test-NexoraOidcReachability.ps1 -DeployDir "D:\desarrollo\java\Nexora AI\nexora-deploy" -Containers
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DeployDir,
    [switch]$Containers
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$deploy = (Resolve-Path -LiteralPath $DeployDir).Path

function Get-EnvValue([string]$Name, [string]$Default) {
    foreach ($line in [IO.File]::ReadAllLines((Join-Path $deploy '.env'))) {
        if ($line -match "^\s*$([regex]::Escape($Name))=(.*)$") { $v = $Matches[1].Trim(); if ($v) { return $v } }
    }
    return $Default
}
function Out-Result([string]$Status, [string]$Check, [string]$Detail = '') {
    Write-Host ('{0,-5} {1}{2}' -f $Status, $Check, $(if ($Detail) { " - $Detail" } else { '' }))
}

$public = (Get-EnvValue 'KEYCLOAK_PUBLIC_URL' '').TrimEnd('/')
if (-not $public) { throw 'KEYCLOAK_PUBLIC_URL is not set in .env' }
$issuer = "$public/realms/nexora"
$u = [Uri]$public
$kcPort = Get-EnvValue 'KEYCLOAK_HOST_PORT' '8180'
Out-Result 'INFO' 'issuer' $issuer
$blocked = New-Object System.Collections.Generic.List[string]

# W1 - name resolution on Windows
$addresses = @()
try { $addresses = @([Net.Dns]::GetHostAddresses($u.Host) | ForEach-Object { $_.IPAddressToString }) } catch { }
if ($addresses.Count -gt 0) { Out-Result 'INFO' 'W1 Windows resolves' "$($u.Host) -> $($addresses -join ', ')" }
else { Out-Result 'FAIL' 'W1 Windows resolves' "$($u.Host) does not resolve"; $blocked.Add('W1') }
$hostsFile = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$hostLines = @(Get-Content -LiteralPath $hostsFile | Where-Object { $_ -match [regex]::Escape($u.Host) -and $_ -notmatch '^\s*#' })
Out-Result 'INFO' 'W1 hosts file lines' $(if ($hostLines.Count) { ($hostLines | ForEach-Object { $_.Trim() }) -join ' | ' } else { '(none)' })
$loopbackOnly = $addresses.Count -gt 0 -and @($addresses | Where-Object { $_ -notmatch '^(127\.|::1$)' }).Count -eq 0

# W2 - where Keycloak's published port listens
$listen = @()
try { $listen = @(Get-NetTCPConnection -State Listen -LocalPort ([int]$kcPort) -ErrorAction Stop | ForEach-Object { $_.LocalAddress } | Sort-Object -Unique) } catch { }
Out-Result 'INFO' 'W2 Keycloak port listens on' $(if ($listen.Count) { "$($listen -join ', '):$kcPort" } else { "nothing found on port $kcPort" })

# W3 - TCP from Windows to the issuer host
$tcp = Test-NetConnection -ComputerName $u.Host -Port $u.Port -WarningAction SilentlyContinue
if ($tcp.TcpTestSucceeded) { Out-Result 'PASS' 'W3 TCP to the issuer' "$($u.Host):$($u.Port) via $($tcp.RemoteAddress)" }
else { Out-Result 'FAIL' 'W3 TCP to the issuer' "$($u.Host):$($u.Port) refused/unreachable (resolved to $($tcp.RemoteAddress))"; $blocked.Add('W3') }

# W4 - metadata through the issuer name
try {
    $m = Invoke-RestMethod -UseBasicParsing -Uri "$issuer/.well-known/openid-configuration" -TimeoutSec 10
    if ($m.issuer -eq $issuer) { Out-Result 'PASS' 'W4 metadata through the issuer name' 'issuer matches' }
    else { Out-Result 'FAIL' 'W4 metadata through the issuer name' "declares $($m.issuer)"; $blocked.Add('W4') }
} catch { Out-Result 'FAIL' 'W4 metadata through the issuer name' $_.Exception.Message; $blocked.Add('W4') }

# W5 - metadata through 127.0.0.1 (Keycloak up; issuer fixed by KC_HOSTNAME)
try {
    $m2 = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$kcPort/realms/nexora/.well-known/openid-configuration" -TimeoutSec 10
    if ($m2.issuer -eq $issuer) { Out-Result 'PASS' 'W5 Keycloak on 127.0.0.1 declares the public issuer' $m2.authorization_endpoint }
    else { Out-Result 'WARN' 'W5 Keycloak on 127.0.0.1 declares another issuer' $m2.issuer }
} catch { Out-Result 'FAIL' 'W5 Keycloak on 127.0.0.1' $_.Exception.Message }

# C1 - containers (read-only exec in the running semantic container)
if ($Containers) {
    Push-Location $deploy
    try {
        $probe = "getent hosts $($u.Host) | head -n 2; (exec 3<>/dev/tcp/$($u.Host)/$($u.Port) && echo TCP_PUBLIC_OK) 2>/dev/null || echo TCP_PUBLIC_FAIL; (exec 3<>/dev/tcp/keycloak/8180 && echo TCP_INTERNAL_OK) 2>/dev/null || echo TCP_INTERNAL_FAIL"
        $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $out = (& docker compose exec -T semantic bash -c $probe 2>&1 | ForEach-Object { "$_" }) -join ' | '
        $ErrorActionPreference = $previous
        Out-Result 'INFO' 'C1 from container semantic' $out
        if ($out -notmatch 'TCP_PUBLIC_OK') { Out-Result 'WARN' 'C1 containers reach the issuer name' 'no (Reports needs it for its discovery)' }
        if ($out -notmatch 'TCP_INTERNAL_OK') { Out-Result 'FAIL' 'C1 containers reach keycloak:8180'; $blocked.Add('C1') }
    } finally { Pop-Location }
}

Out-Result 'TODO' 'M1 browser (manual)' "open $issuer/.well-known/openid-configuration in Chrome/Edge: JSON with this issuer = OK"
if ($blocked.Count -eq 0) {
    Out-Result 'OK' 'verdict' 'the published issuer works from Windows: the console needs no OIDC change (confirm M1)'
} else {
    $why = if ($loopbackOnly) { 'the name resolves to loopback but the port does not answer' }
           elseif ($listen.Count -and @($listen | Where-Object { $_ -notmatch '^(127\.|::1$)' }).Count -eq 0) { "the name resolves to $($addresses -join ', ') but Keycloak listens only on loopback" }
           else { 'see the checks above' }
    Out-Result 'BLOCK' 'verdict' "the browser cannot use the published issuer ($($blocked -join ',')): $why. See docs/13 section B."
}
