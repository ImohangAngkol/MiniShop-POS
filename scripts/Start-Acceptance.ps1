param([switch]$SkipBuild)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$acceptanceRoot = Join-Path $projectRoot '.runtime\acceptance'
$listener = [Net.Sockets.TcpClient]::new(); $occupied = $false
try { $listener.Connect('127.0.0.1', 5843); $occupied = $true } catch [Net.Sockets.SocketException] { } finally { $listener.Dispose() }
if ($occupied) { throw 'Acceptance host is already running; stop it before publishing.' }
$publish = Join-Path $acceptanceRoot 'publish'
if (!$SkipBuild) {
    & "$PSScriptRoot\Build.ps1"
    & dotnet publish src/MiniShop.Api -c Release --no-restore -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance publish failed' }
}
Invoke-StagingEnvironment -ConfigurationFile (Join-Path $acceptanceRoot 'runtime.json') -Action {
    $assembly = Join-Path $publish 'MiniShop.Api.dll'
    $process = Start-Process -FilePath 'dotnet' -ArgumentList @(('"' + $assembly + '"'), '--contentRoot', ('"' + $publish + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $acceptanceRoot 'app.log') -RedirectStandardError (Join-Path $acceptanceRoot 'app-error.log')
    $process.Id | Set-Content -LiteralPath (Join-Path $acceptanceRoot 'app.pid')
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($process.HasExited) { break }
        $result = & node scripts/verify-acceptance-https.mjs
        if ($LASTEXITCODE -eq 0) { Write-Output 'Software acceptance host healthy at https://127.0.0.1:5843. Existing environments unchanged.'; return }
    }
    throw 'Acceptance HTTPS readiness failed. Inspect private logs; do not bypass TLS.'
}
