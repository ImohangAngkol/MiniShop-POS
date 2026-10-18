param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin', [switch]$Lan, [switch]$Acceptance)
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$profileRoot = $stagingRoot
if ($Lan -and $Acceptance) { throw 'Select only one isolated backup profile.' }
if ($Lan -or $Acceptance) {
    $profileRoot = Join-Path $projectRoot $(if ($Acceptance) { '.runtime\acceptance' } else { '.runtime\lan' })
    $pidFile = Join-Path $profileRoot 'app.pid'
    if ((Test-Path -LiteralPath $pidFile) -and (Get-Process -Id ([int](Get-Content -LiteralPath $pidFile)) -ErrorAction SilentlyContinue)) { throw 'Stop only the LAN host before its backup drill.' }
    $listener = [Net.Sockets.TcpClient]::new(); $occupied = $false
    try { $listener.Connect('127.0.0.1', $(if ($Acceptance) { 5843 } else { 5643 })); $occupied = $true } catch [Net.Sockets.SocketException] { } finally { $listener.Dispose() }
    if ($occupied) { throw 'Stop the foreground LAN host before its backup drill.' }
} else { Assert-StagingStopped }
$snapshotCommand = if ($Acceptance) { 'acceptance-snapshot' } elseif ($Lan) { 'lan-snapshot' } else { 'snapshot' }
$recoveryCommand = if ($Acceptance) { 'acceptance-recovery-check' } elseif ($Lan) { 'lan-recovery-check' } else { 'recovery-check' }
$migrationRole = if ($Acceptance) { 'minishop_acceptance_migrator' } elseif ($Lan) { 'minishop_lan_migrator' } else { 'minishop_staging_migrator' }
# A quiet source is required for exact before/after reconciliation. No development configuration is loaded.
& dotnet $stagingTool $snapshotCommand $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Staging snapshot failed' }
$backupDirectory = Join-Path $profileRoot ('backups\' + [Guid]::NewGuid().ToString('N'))
Invoke-StagingEnvironment -ConfigurationFile (Join-Path $profileRoot 'runtime.json') -Action { & "$PSScriptRoot\Backup.ps1" -OutputDirectory $backupDirectory -PostgresBin $PostgresBin }
$backup = @(Get-ChildItem -LiteralPath $backupDirectory -Filter '*.dump')
if ($backup.Count -ne 1) { throw 'Expected one staging backup' }
$hash = (Get-Content -Raw -LiteralPath ($backup[0].FullName + '.sha256')).Trim()
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $backup[0].FullName).Hash -ne $hash) { throw 'Staging backup checksum failed' }
$admin = Read-StagingJson 'admin.json'
$parts = New-Object System.Data.Common.DbConnectionStringBuilder
$parts.set_ConnectionString($admin.Connection)
if ($parts.get_Item('Host') -ne '127.0.0.1' -or $parts.get_Item('Port') -ne '55433' -or $parts.get_Item('Username') -ne 'minishop_staging_admin') { throw 'Refusing non-staging recovery target' }
$pgValues = @{ PGHOST='127.0.0.1'; PGPORT='55433'; PGUSER='minishop_staging_admin'; PGPASSWORD=[string]$parts.get_Item('Password'); PGDATABASE='postgres' }
$prior = @{}
foreach ($name in $pgValues.Keys) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process'); [Environment]::SetEnvironmentVariable($name, $pgValues[$name], 'Process') }
$recoveryDatabase = $(if ($Acceptance) { 'minishop_acceptance_restore_' } elseif ($Lan) { 'minishop_lan_restore_' } else { 'minishop_staging_restore_' }) + [Guid]::NewGuid().ToString('N')
$created = $false
try {
    & "$PostgresBin\createdb.exe" --no-password --maintenance-db=postgres --owner=$migrationRole $recoveryDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Staging recovery database creation failed' }
    $created = $true
    & "$PostgresBin\pg_restore.exe" --no-password --dbname=$recoveryDatabase --role=$migrationRole --no-owner --no-acl --exit-on-error $backup[0].FullName
    if ($LASTEXITCODE -ne 0) { throw 'Staging restore failed' }
    & dotnet $stagingTool $recoveryCommand $projectRoot $recoveryDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Staging recovery reconciliation failed' }
    Write-Output 'Acceptance database backup, checksum, restore, restricted-role access and exact reconciliation all passed. The fictional backup remains in the selected private profile backups directory.'
} finally {
    $expectedRecoveryPattern = if ($Acceptance) { '^minishop_acceptance_restore_[a-f0-9]{32}$' } elseif ($Lan) { '^minishop_lan_restore_[a-f0-9]{32}$' } else { '^minishop_staging_restore_[a-f0-9]{32}$' }
    if ($created -and $recoveryDatabase -match $expectedRecoveryPattern) {
        & "$PostgresBin\dropdb.exe" --no-password --maintenance-db=postgres $recoveryDatabase
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Temporary staging recovery database cleanup failed; inspect it before the next drill.' }
    }
    foreach ($name in $prior.Keys) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
}
