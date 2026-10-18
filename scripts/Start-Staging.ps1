param([switch]$SkipBuild, [switch]$Background)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
Assert-StagingStopped
$publish = Join-Path $stagingRoot 'publish'
if (!$SkipBuild) {
    & "$PSScriptRoot\Build.ps1"
    & dotnet publish src/MiniShop.Api -c Release --no-restore -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'Staging publish failed' }
}
$assembly = Join-Path $publish 'MiniShop.Api.dll'
if (!(Test-Path -LiteralPath $assembly)) { throw 'Staging publish is missing. Run without -SkipBuild.' }
Invoke-StagingEnvironment {
    & dotnet $stagingTool verify $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Staging runtime role verification failed' }
    if ($Background) {
        $process = Start-Process -FilePath 'dotnet' -ArgumentList @(('"' + $assembly + '"'), '--contentRoot', ('"' + $publish + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stagingRoot 'app.log') -RedirectStandardError (Join-Path $stagingRoot 'app-error.log')
        $process.Id | Set-Content -LiteralPath (Join-Path $stagingRoot 'app.pid')
        $ready = $false
        for ($attempt = 0; $attempt -lt 8; $attempt++) {
            Start-Sleep -Milliseconds 500
            if ($process.HasExited) { break }
            # Capture transient startup failures; return only validated readiness to the operator.
            $checkOutput = & node scripts/verify-staging-https.mjs 2>&1
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        }
        if (!$ready) { throw 'Staging HTTPS readiness failed. Inspect private staging app logs; do not bypass TLS or change database credentials to work around this.' }
        Write-Output 'Staging is healthy at https://localhost:5443 with validated TLS and DPAPI keys. No certificate was trusted or firewall rule changed.'
    } else {
        Write-Output 'Staging: https://localhost:5443 (untrusted until explicitly approved). Ctrl+C stops the app.'
        & dotnet $assembly --contentRoot $publish
        if ($LASTEXITCODE -ne 0) { throw 'Staging host stopped with an error' }
    }
}
