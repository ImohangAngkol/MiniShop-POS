param([switch]$Browser, [switch]$BrowserOnly)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$acceptanceRoot = Join-Path $projectRoot '.runtime\acceptance'
if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0') { throw 'TLS verification must remain enabled.' }
& node scripts/verify-acceptance-https.mjs
if ($LASTEXITCODE -ne 0) { throw 'Acceptance TLS check failed' }
Invoke-StagingEnvironment -ConfigurationFile (Join-Path $acceptanceRoot 'runtime.json') -Action {
    $env:TEST_DB_CONNECTION = (Read-StagingJson 'admin.json').Connection
    $env:LocalStaging__Enabled = 'false'; $env:Lan__Enabled = 'false'
    $env:DataProtection__Directory = ''; $env:DataProtection__ApplicationName = 'MiniShop.Tests'
    $credentials = Get-Content -Raw -LiteralPath (Join-Path $acceptanceRoot 'credentials.json') | ConvertFrom-Json
    $env:E2E_EMAIL = $credentials.OwnerEmail; $env:E2E_PASSWORD = $credentials.OwnerPassword
    $env:E2E_CASHIER_EMAIL = $credentials.Cashier1Email; $env:E2E_CASHIER_PASSWORD = $credentials.Cashier1Password
    $env:E2E_ACCEPTANCE = '1'; $env:E2E_URL = 'https://127.0.0.1:5843'
    $env:E2E_CA_CERT = Join-Path $acceptanceRoot 'ca.crt'; $env:NODE_EXTRA_CA_CERTS = $env:E2E_CA_CERT
    # Playwright forces worker colors; inherited NO_COLOR produces a harmless
    # stderr warning which Windows PowerShell treats as terminating under Stop.
    $priorNoColor = $env:NO_COLOR
    try {
        $env:NO_COLOR = $null
        if ($BrowserOnly) {
            & npm.cmd --prefix src/minishop-web run test:e2e
            if ($LASTEXITCODE -ne 0) { throw 'Acceptance browser tests failed' }
        } else { & "$PSScriptRoot\Test.ps1" -Browser:$Browser }
    } finally { $env:NO_COLOR = $priorNoColor }
}
