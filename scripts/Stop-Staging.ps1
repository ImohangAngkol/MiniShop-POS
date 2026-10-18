param([switch]$Database, [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
. "$PSScriptRoot\Staging-Common.ps1"
$pidFile = Join-Path $stagingRoot 'app.pid'
if (Test-Path -LiteralPath $pidFile) {
    $stagingProcessId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $stagingProcessId"
    if ($process) {
        $expected = Join-Path $stagingRoot 'publish\MiniShop.Api.dll'
        if ($process.Name -ne 'dotnet.exe' -or !$process.CommandLine.Contains($expected)) { throw 'PID no longer identifies the staging app; refusing to stop another process.' }
        Stop-Process -Id $stagingProcessId
    }
    Remove-Item -LiteralPath $pidFile
}
if ($Database) {
    & "$PostgresBin\pg_ctl.exe" stop -D (Join-Path $stagingRoot 'postgres') -m fast -w
    if ($LASTEXITCODE -ne 0) { throw 'Staging database shutdown failed' }
}
