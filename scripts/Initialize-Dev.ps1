param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin', [switch]$SeedDemo)
. "$PSScriptRoot\Env.ps1"
Set-Location $projectRoot
$cluster = Join-Path $projectRoot '.runtime\postgres'
$secrets = Join-Path $projectRoot '.runtime\local-env.ps1'
if (!(Test-Path -LiteralPath $secrets)) {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $randomBytes = New-Object byte[] 24
    $rng.GetBytes($randomBytes)
    $dbPassword = 'Db!' + [Convert]::ToBase64String($randomBytes)
    $rng.GetBytes($randomBytes)
    $ownerPassword = 'Owner!9a' + [Convert]::ToBase64String($randomBytes)
    $rng.Dispose()
    $keyDirectory = Join-Path $projectRoot '.runtime\keys'
    $seed = if ($SeedDemo) { 'true' } else { 'false' }
    @(
        "`$env:ConnectionStrings__Shop = 'Host=127.0.0.1;Port=55432;Database=minishop;Username=minishop;Password=$dbPassword'"
        "`$env:Bootstrap__Email = 'owner@example.test'"
        "`$env:Bootstrap__Password = '$ownerPassword'"
        "`$env:Bootstrap__SeedDemo = '$seed'"
        "`$env:DataProtection__Directory = '$($keyDirectory.Replace("'", "''"))'"
        "`$env:ASPNETCORE_ENVIRONMENT = 'Development'"
        "`$env:ASPNETCORE_URLS = 'http://localhost:5080'"
    ) | Set-Content -LiteralPath $secrets -Encoding UTF8
}
. $secrets
$dbPassword = ($env:ConnectionStrings__Shop -split 'Password=',2)[1]
if (!(Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) {
    $pwFile = Join-Path $projectRoot '.runtime\pg-password.tmp'
    try {
        [IO.File]::WriteAllText($pwFile, $dbPassword)
        & "$PostgresBin\initdb.exe" -D $cluster -U minishop --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$pwFile
        if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
    } finally { Remove-Item -LiteralPath $pwFile -ErrorAction SilentlyContinue }
    Add-Content -LiteralPath (Join-Path $cluster 'postgresql.conf') -Value "`nport = 55432`nlisten_addresses = '127.0.0.1'"
}
& "$PostgresBin\pg_ctl.exe" status -D $cluster 2>$null
if ($LASTEXITCODE -ne 0) {
    $pgLog = Join-Path $projectRoot '.runtime\postgres.log'
    & "$PostgresBin\pg_ctl.exe" start -D $cluster -l $pgLog -w
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed' }
}
$env:PGPASSWORD = $dbPassword
try {
    $exists = & "$PostgresBin\psql.exe" -h 127.0.0.1 -p 55432 -U minishop -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='minishop'"
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL connection failed' }
    if ($exists -ne '1') { & "$PostgresBin\createdb.exe" -h 127.0.0.1 -p 55432 -U minishop minishop; if ($LASTEXITCODE -ne 0) { throw 'createdb failed' } }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Output 'Development database ready on 127.0.0.1:55432. Credentials are in ignored .runtime/local-env.ps1; do not share that file.'
