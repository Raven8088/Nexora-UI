<#
.SYNOPSIS
  Stage 7 (Nexora Frontend): writes the secret of Keycloak client nexora-console to
  <nexora-deploy>\secrets\nexora_console_client_secret, the Docker secret file read by the frontend container.

.DESCRIPTION
  The value is asked for hidden (Read-Host -AsSecureString), kept only in memory and written as UTF-8 without BOM and
  without a line break. It is never printed, never passed on a command line and never logged. An existing file is
  replaced only with -Force. Copy the value from Keycloak: Clients > nexora-console > Credentials > Client secret.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\Set-NexoraConsoleSecret.ps1 -DeployDir "D:\desarrollo\java\Nexora AI\nexora-deploy"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DeployDir,
    [switch]$Force
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$deploy = (Resolve-Path -LiteralPath $DeployDir).Path
if (-not (Test-Path -LiteralPath (Join-Path $deploy 'compose.yaml'))) { throw "not a nexora-deploy folder: $deploy" }
$dir = Join-Path $deploy 'secrets'
$target = Join-Path $dir 'nexora_console_client_secret'
if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "$target already exists. It was NOT modified. Use -Force to replace it."
}
$secure = Read-Host -Prompt 'Client secret of nexora-console (hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if (-not $plain -or $plain.Trim().Length -lt 16) { throw 'the secret is empty or shorter than 16 characters' }
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    [IO.File]::WriteAllText($target, $plain.Trim(), (New-Object Text.UTF8Encoding($false)))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $plain = $null
}
Write-Host "OK  secret written to $target (value not shown)"
