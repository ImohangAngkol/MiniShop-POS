param([switch]$SkipBuild, [switch]$EnableLan, [switch]$Background)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$lanRoot = Join-Path $projectRoot '.runtime\lan'
$runtimeFile = Join-Path $lanRoot 'runtime.json'
if (!(Test-Path -LiteralPath $runtimeFile)) { throw 'Run Prepare-Lan.ps1 with the proposed private server IP first.' }
$listener = [Net.Sockets.TcpClient]::new()
$occupied = $false
try { $listener.Connect('127.0.0.1', 5643); $occupied = $true } catch [Net.Sockets.SocketException] { } finally { $listener.Dispose() }
if ($occupied) { throw 'The LAN rehearsal host is already running. Stop it before republishing.' }
$pidFile = Join-Path $lanRoot 'app.pid'
if ((Test-Path -LiteralPath $pidFile) -and (Get-Process -Id ([int](Get-Content -LiteralPath $pidFile)) -ErrorAction SilentlyContinue)) { throw 'Stop the existing LAN host before republishing.' }
$publish = Join-Path $lanRoot 'publish'
if (!$SkipBuild) {
    & "$PSScriptRoot\Build.ps1"
    & dotnet publish src/MiniShop.Api -c Release --no-restore -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'LAN rehearsal publish failed' }
}
Invoke-StagingEnvironment -ConfigurationFile $runtimeFile -Action {
    if ($EnableLan) {
        # This explicit operator command is the only path that binds the selected private adapter.
        $env:Lan__ListenAddress = $env:Lan__ServerAddress
        $env:ASPNETCORE_URLS = 'https://' + $env:Lan__ServerAddress + ':5643'
        Write-Output 'Binding the explicitly selected private LAN address. Certificate trust/firewall/router settings are not changed.'
    }
    $assembly = Join-Path $publish 'MiniShop.Api.dll'
    if ($Background) {
        $process = Start-Process -FilePath 'dotnet' -ArgumentList @(('"' + $assembly + '"'), '--contentRoot', ('"' + $publish + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $lanRoot 'app.log') -RedirectStandardError (Join-Path $lanRoot 'app-error.log')
        $process.Id | Set-Content -LiteralPath $pidFile
        $ready = $false
        for ($attempt = 0; $attempt -lt 10; $attempt++) {
            Start-Sleep -Milliseconds 500
            if ($process.HasExited) { break }
            $checkUrl = if ($EnableLan) { $env:ASPNETCORE_URLS } else { 'https://127.0.0.1:5643' }
            $checkOutput = & node scripts/verify-lan-https.mjs $checkUrl
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        }
        if (!$ready) { throw 'LAN rehearsal HTTPS readiness failed. Inspect private app logs; do not bypass TLS.' }
        Write-Output "Verified HTTPS host ready: $checkUrl. Ordinary device trust and physical acceptance remain pending."
    } else {
        Write-Output "Opening $env:ASPNETCORE_URLS. Ctrl+C stops this host."
        & dotnet (Join-Path $publish 'MiniShop.Api.dll') --contentRoot $publish
        if ($LASTEXITCODE -ne 0) { throw 'LAN host stopped with an error' }
    }
}
