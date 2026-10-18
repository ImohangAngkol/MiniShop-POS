. "$PSScriptRoot\Env.ps1" -SkipLocalConfiguration
$stagingRoot = Join-Path $projectRoot '.runtime\staging'
$stagingTool = Join-Path $projectRoot 'tools\MiniShop.Staging\bin\Debug\net10.0\MiniShop.Staging.dll'

function Read-StagingJson([string]$Name) {
    $file = Join-Path $stagingRoot $Name
    if (!(Test-Path -LiteralPath $file)) { throw "Missing staging file $Name. Run Initialize-Staging.ps1 first." }
    Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
}

function Invoke-StagingEnvironment([scriptblock]$Action, [string]$ConfigurationFile) {
    # Never inherit development credentials, endpoints, bootstrap secrets or test overrides.
    $prior = @{}
    $pattern = '^(ConnectionStrings(?::|__)|Bootstrap(?::|__)|Database(?::|__)|DataProtection(?::|__)|Kestrel(?::|__)|ASPNETCORE_|DOTNET_ENVIRONMENT$|AllowedHosts$|LocalStaging(?::|__)|Lan(?::|__)|Acceptance(?::|__)|TEST_DB_CONNECTION$|E2E_|NODE_EXTRA_CA_CERTS$|PG(?:PASSWORD|PASSFILE|USER|HOST|PORT|DATABASE|SERVICE|SERVICEFILE)$)'
    foreach ($entry in Get-ChildItem Env:) {
        if ($entry.Name -match $pattern) { $prior[$entry.Name] = $entry.Value; [Environment]::SetEnvironmentVariable($entry.Name, $null, 'Process') }
    }
    try {
        $runtime = if ($ConfigurationFile) { Get-Content -Raw -LiteralPath $ConfigurationFile | ConvertFrom-Json } else { Read-StagingJson 'runtime.json' }
        foreach ($property in $runtime.PSObject.Properties) { [Environment]::SetEnvironmentVariable($property.Name, $property.Value, 'Process') }
        & $Action
    } finally {
        foreach ($entry in Get-ChildItem Env:) { if ($entry.Name -match $pattern) { [Environment]::SetEnvironmentVariable($entry.Name, $null, 'Process') } }
        foreach ($name in $prior.Keys) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    }
}

function Assert-StagingStopped {
    $pidFile = Join-Path $stagingRoot 'app.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $stagingProcessId = [int](Get-Content -LiteralPath $pidFile)
        if (Get-Process -Id $stagingProcessId -ErrorAction SilentlyContinue) { throw 'Staging may be running. Stop it before migrating or replacing its publish directory.' }
    }
    # Foreground hosts have no PID file. Also refuse maintenance if the HTTPS
    # listener is occupied, including by an unrelated application.
    $listener = [Net.Sockets.TcpClient]::new()
    $occupied = $false
    try { $listener.Connect('127.0.0.1', 5443); $occupied = $true }
    catch [Net.Sockets.SocketException] { }
    finally { $listener.Dispose() }
    if ($occupied) { throw 'Port 5443 is occupied. Stop the staging foreground/background host before maintenance; no process was stopped automatically.' }
}
