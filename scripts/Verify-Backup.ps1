param([Parameter(Mandatory=$true)][string]$BackupFile, [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
. "$PSScriptRoot\Env.ps1"
$BackupFile = (Resolve-Path -LiteralPath $BackupFile).Path
if (Test-Path -LiteralPath ($BackupFile+'.sha256')) {
    $expectedHash = (Get-Content -LiteralPath ($BackupFile+'.sha256') -Raw).Trim()
    if ((Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Backup checksum mismatch' }
}
$connectionParts = New-Object System.Data.Common.DbConnectionStringBuilder
$connectionParts.set_ConnectionString($env:ConnectionStrings__Shop)
$pgValues = @{ PGHOST=[string]$connectionParts.get_Item('Host'); PGPORT=[string]$connectionParts.get_Item('Port'); PGUSER=[string]$connectionParts.get_Item('Username'); PGPASSWORD=[string]$connectionParts.get_Item('Password') }
if (!$pgValues.PGPORT) { $pgValues.PGPORT='5432' }
$priorPg=@{}
foreach ($key in $pgValues.Keys) { $priorPg[$key]=[Environment]::GetEnvironmentVariable($key,'Process'); [Environment]::SetEnvironmentVariable($key,$pgValues[$key],'Process') }
$recoveryDatabase='minishop_restore_'+[Guid]::NewGuid().ToString('N')
$created=$false
try {
    & "$PostgresBin\createdb.exe" --no-password --maintenance-db=postgres $recoveryDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create separate recovery-test database; use a role with CREATEDB for this drill.' }
    $created=$true
    & "$PostgresBin\pg_restore.exe" --no-password --dbname=$recoveryDatabase --no-owner --no-acl --exit-on-error $BackupFile
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
    $countsSql='SELECT json_build_object(''products'',(SELECT count(*) FROM "Products"),''sales'',(SELECT count(*) FROM "Sales"),''creditEntries'',(SELECT count(*) FROM "CreditTransactions"),''stockMovements'',(SELECT count(*) FROM "StockMovements"),''migrations'',(SELECT count(*) FROM "__EFMigrationsHistory"));'
    $restoredCounts = $countsSql | & "$PostgresBin\psql.exe" --no-password -d $recoveryDatabase -At --set=ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Restored schema validation failed' }
    Write-Output "Restore successful in separate temporary database: $restoredCounts"
    Write-Output 'A restore drill validates archive/schema integrity. Reconcile business totals and test the restored app before operational recovery.'
} finally {
    if ($created -and $recoveryDatabase -match '^minishop_restore_[a-f0-9]{32}$') { & "$PostgresBin\dropdb.exe" --no-password --maintenance-db=postgres $recoveryDatabase }
    foreach ($key in $priorPg.Keys) { [Environment]::SetEnvironmentVariable($key,$priorPg[$key],'Process') }
}
