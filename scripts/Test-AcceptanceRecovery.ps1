. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$acceptanceRoot = Join-Path $projectRoot '.runtime\acceptance'
$priorCA = $env:NODE_EXTRA_CA_CERTS
try {
    $env:NODE_EXTRA_CA_CERTS = Join-Path $acceptanceRoot 'ca.crt'
    & node src/minishop-web/scripts/verify-acceptance-restart.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance session baseline failed' }
    & "$PSScriptRoot\Stop-Acceptance.ps1"
    try {
        & node scripts/verify-acceptance-https.mjs
        if ($LASTEXITCODE -eq 0) { throw 'Acceptance HTTPS unexpectedly remained available during the stopped-host test.' }
        Write-Output 'Stopped acceptance host correctly reports unavailable; no successful checkout was fabricated.'
        & "$PSScriptRoot\Test-StagingBackup.ps1" -Acceptance
        if ($LASTEXITCODE -ne 0) { throw 'Acceptance backup/recovery failed' }
        Copy-Item -LiteralPath (Join-Path $acceptanceRoot 'backup-snapshot.json') -Destination (Join-Path $acceptanceRoot 'restart-baseline.json')
    } finally { & "$PSScriptRoot\Start-Acceptance.ps1" -SkipBuild }
    & node src/minishop-web/scripts/verify-acceptance-restart.mjs --resume
    if ($LASTEXITCODE -ne 0) { throw 'Session did not survive acceptance restart' }
    & dotnet $stagingTool acceptance-snapshot $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance post-restart snapshot failed' }
    $before = Get-Content -Raw -LiteralPath (Join-Path $acceptanceRoot 'restart-baseline.json')
    $after = Get-Content -Raw -LiteralPath (Join-Path $acceptanceRoot 'backup-snapshot.json')
    if ($before -cne $after) { throw 'Acceptance data changed during controlled stop/restore/restart' }
    @{ passed=$true; fictional=$true; stoppedHostUnavailable=$true; exactSnapshotAfterRestart=$true; existingSessionSurvived=$true; verifiedAt=[DateTimeOffset]::UtcNow.ToString('O') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $acceptanceRoot 'recovery-result.json')
    Write-Output 'Controlled restart, unavailable-host behavior, existing secure session, exact data snapshot and isolated restore all passed.'
} finally { $env:NODE_EXTRA_CA_CERTS = $priorCA }
