param([switch]$Browser)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$lanRoot = Join-Path $projectRoot '.runtime\lan'
if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0') { throw 'TLS verification must remain enabled.' }
& node scripts/verify-lan-config.mjs
if ($LASTEXITCODE -ne 0) { throw 'Prepared LAN configuration/certificate check failed' }
& node scripts/verify-lan-https.mjs
if ($LASTEXITCODE -ne 0) { throw 'LAN rehearsal TLS checks failed' }
Invoke-StagingEnvironment -ConfigurationFile (Join-Path $lanRoot 'runtime.json') -Action {
    $env:TEST_DB_CONNECTION = (Read-StagingJson 'admin.json').Connection
    $env:Lan__Enabled = 'false'
    $env:LocalStaging__Enabled = 'false'
    $env:DataProtection__Directory = ''
    $env:DataProtection__ApplicationName = 'MiniShop.Tests'
    $owner = Get-Content -Raw -LiteralPath (Join-Path $lanRoot 'fictional-owner.json') | ConvertFrom-Json
    $env:E2E_EMAIL = $owner.Email; $env:E2E_PASSWORD = $owner.Password
    $env:E2E_URL = 'https://127.0.0.1:5643'
    $env:E2E_CA_CERT = Join-Path $lanRoot 'ca.crt'; $env:NODE_EXTRA_CA_CERTS = $env:E2E_CA_CERT
    & "$PSScriptRoot\Test.ps1" -Browser:$Browser
}
