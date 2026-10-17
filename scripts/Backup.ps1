param([string]$OutputDirectory, [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
. "$PSScriptRoot\Env.ps1"
if (!$env:ConnectionStrings__Shop) { throw 'Set ConnectionStrings__Shop first' }
if (!$OutputDirectory) { $OutputDirectory = Join-Path $projectRoot '.runtime\backups' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$connectionParts = New-Object System.Data.Common.DbConnectionStringBuilder
$connectionParts.set_ConnectionString($env:ConnectionStrings__Shop)
$pgValues = @{
    PGHOST = [string]$connectionParts.get_Item('Host'); PGPORT = [string]$connectionParts.get_Item('Port');
    PGUSER = [string]$connectionParts.get_Item('Username'); PGPASSWORD = [string]$connectionParts.get_Item('Password');
    PGDATABASE = [string]$connectionParts.get_Item('Database')
}
if (!$pgValues.PGPORT) { $pgValues.PGPORT = '5432' }
$priorPg = @{}
foreach ($key in $pgValues.Keys) { $priorPg[$key] = [Environment]::GetEnvironmentVariable($key, 'Process'); [Environment]::SetEnvironmentVariable($key, $pgValues[$key], 'Process') }
try {
    $backupFile = Join-Path $OutputDirectory ("minishop-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
    & "$PostgresBin\pg_dump.exe" --no-password --format=custom --no-owner --no-acl --file=$backupFile
    if ($LASTEXITCODE -ne 0) { throw 'Backup failed. Do not use a partial backup.' }
    (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash | Set-Content -LiteralPath ($backupFile + '.sha256') -Encoding ASCII
    Write-Output "Backup created: $backupFile"
    Write-Output 'Protect this file as confidential business data and copy it to an encrypted separate device.'
} finally { foreach ($key in $priorPg.Keys) { [Environment]::SetEnvironmentVariable($key, $priorPg[$key], 'Process') } }
