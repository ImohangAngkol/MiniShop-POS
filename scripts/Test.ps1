param([switch]$Browser)
. "$PSScriptRoot\Env.ps1"
Set-Location $projectRoot
& node scripts/update-progress.mjs --check
if ($LASTEXITCODE -ne 0) { throw 'Progress report validation failed. Review and regenerate it before testing.' }
& dotnet test MiniShop.slnx --no-restore --logger 'trx;LogFileName=backend.trx' --results-directory .runtime/test-results
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
& npm.cmd --prefix src/minishop-web test
if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
if ($Browser) {
    if (!$env:E2E_EMAIL -or !$env:E2E_PASSWORD) { throw 'Set E2E_EMAIL and E2E_PASSWORD for an explicitly selected development instance. Browser tests write fictional records.' }
    & npm.cmd --prefix src/minishop-web run test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed' }
}
