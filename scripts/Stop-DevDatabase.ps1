param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
. "$PSScriptRoot\Env.ps1"
& "$PostgresBin\pg_ctl.exe" stop -D (Join-Path $projectRoot '.runtime\postgres') -m fast -w
if ($LASTEXITCODE -ne 0) { throw 'Development database shutdown failed' }
