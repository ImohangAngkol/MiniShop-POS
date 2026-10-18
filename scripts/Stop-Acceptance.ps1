. "$PSScriptRoot\Staging-Common.ps1"
$acceptanceRoot = Join-Path $projectRoot '.runtime\acceptance'
$pidFile = Join-Path $acceptanceRoot 'app.pid'
if (Test-Path -LiteralPath $pidFile) {
    $acceptanceProcessId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $acceptanceProcessId"
    if ($process) {
        if ($process.Name -ne 'dotnet.exe' -or !$process.CommandLine.Contains((Join-Path $acceptanceRoot 'publish\MiniShop.Api.dll'))) { throw 'Refusing to stop a PID that is not the acceptance host.' }
        Stop-Process -Id $acceptanceProcessId
    }
    Remove-Item -LiteralPath $pidFile
}
