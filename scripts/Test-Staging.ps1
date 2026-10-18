param([switch]$Browser)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0') { throw 'TLS verification must remain enabled.' }
& node scripts/verify-staging-https.mjs
if ($LASTEXITCODE -ne 0) { throw 'Strict staging TLS verification failed' }
Invoke-StagingEnvironment {
    # Integration fixtures need a test-only administrator to create disposable databases.
    # They immediately switch to an unprivileged runtime role for every API/commerce test.
    $env:TEST_DB_CONNECTION = (Read-StagingJson 'admin.json').Connection
    $env:LocalStaging__Enabled = 'false'
    $env:DataProtection__Directory = ''
    $env:DataProtection__ApplicationName = 'MiniShop.Tests'
    $owner = Read-StagingJson 'fictional-owner.json'
    $env:E2E_EMAIL = $owner.Email
    $env:E2E_PASSWORD = $owner.Password
    $env:E2E_URL = 'https://localhost:5443'
    $env:E2E_CA_CERT = Join-Path $stagingRoot 'localhost.crt'
    $env:NODE_EXTRA_CA_CERTS = $env:E2E_CA_CERT
    & "$PSScriptRoot\Test.ps1" -Browser:$Browser
}
