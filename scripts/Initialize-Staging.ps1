param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
Assert-StagingStopped
if (!(Test-Path -LiteralPath $stagingRoot)) { New-Item -ItemType Directory -Path $stagingRoot | Out-Null }
# These permissions apply only to the new workspace staging directory, never to the machine or development files.
$directoryInfo = [IO.DirectoryInfo]::new($stagingRoot)
$acl = $directoryInfo.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $false)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$workspaceOwner = [Security.Principal.NTAccount]::new((Get-Acl -LiteralPath $projectRoot).Owner).Translate([Security.Principal.SecurityIdentifier])
foreach ($sid in @($identity, $workspaceOwner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
$directoryInfo.SetAccessControl($acl)
& dotnet restore tools/MiniShop.Staging --ignore-failed-sources
if ($LASTEXITCODE -ne 0) { throw 'Staging tool restore failed' }
& dotnet build tools/MiniShop.Staging --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Staging tool build failed' }
if (!(Test-Path -LiteralPath (Join-Path $stagingRoot 'runtime.json'))) {
    & dotnet $stagingTool generate $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Private staging configuration generation failed' }
}
$admin = Read-StagingJson 'admin.json'
$parts = New-Object System.Data.Common.DbConnectionStringBuilder
$parts.set_ConnectionString($admin.Connection)
if ($parts.get_Item('Host') -ne '127.0.0.1' -or $parts.get_Item('Port') -ne '55433' -or $parts.get_Item('Database') -ne 'postgres' -or $parts.get_Item('Username') -ne 'minishop_staging_admin') { throw 'Unexpected staging administrator connection' }
$cluster = Join-Path $stagingRoot 'postgres'
if (!(Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) {
    $passwordFile = Join-Path $stagingRoot 'initdb-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordFile, [string]$parts.get_Item('Password'))
        & "$PostgresBin\initdb.exe" -D $cluster -U minishop_staging_admin --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'Staging initdb failed' }
    } finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
    Add-Content -LiteralPath (Join-Path $cluster 'postgresql.conf') -Value "`nport = 55433`nlisten_addresses = '127.0.0.1'`npassword_encryption = 'scram-sha-256'"
}
# psql/admin work below targets only the dedicated cluster, never the development database.
& "$PostgresBin\pg_ctl.exe" status -D $cluster 2>$null
if ($LASTEXITCODE -ne 0) {
    & "$PostgresBin\pg_ctl.exe" start -D $cluster -l (Join-Path $stagingRoot 'postgres.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'Staging PostgreSQL startup failed' }
}
& dotnet $stagingTool provision $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Staging provisioning failed' }
Write-Output 'Isolated fictional staging database ready on 127.0.0.1:55433. Runtime, migration and administrator credentials are separate private files.'
