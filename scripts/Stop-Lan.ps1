. "$PSScriptRoot\Staging-Common.ps1"
$lanRoot = Join-Path $projectRoot '.runtime\lan'
$pidFile = Join-Path $lanRoot 'app.pid'
if (Test-Path -LiteralPath $pidFile) {
    $lanProcessId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $lanProcessId"
    if ($process) {
        if ($process.Name -ne 'dotnet.exe' -or !$process.CommandLine.Contains((Join-Path $lanRoot 'publish\MiniShop.Api.dll'))) { throw 'PID no longer identifies the LAN rehearsal host; refusing to stop another process.' }
        Stop-Process -Id $lanProcessId
    }
    Remove-Item -LiteralPath $pidFile
}
# The shared loopback staging cluster and both existing apps are deliberately left running.
