param([switch]$SkipBuild)
. "$PSScriptRoot\Env.ps1"
Set-Location $projectRoot
if (!$env:ConnectionStrings__Shop) { throw 'Initialize development setup or set ConnectionStrings__Shop. Read docs/SETUP_GUIDE.md.' }
if (!$SkipBuild) { & "$PSScriptRoot\Build.ps1" }
& dotnet ef database update --project src/MiniShop.Api --no-build
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Check PostgreSQL and connection settings.' }
Write-Output 'Open http://localhost:5080 in your browser. Press Ctrl+C here to stop the app.'
& dotnet run --project src/MiniShop.Api --no-build --no-launch-profile
