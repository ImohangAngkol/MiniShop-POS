. "$PSScriptRoot\Env.ps1"
Set-Location $projectRoot
& dotnet restore MiniShop.slnx --configfile NuGet.Config
if ($LASTEXITCODE -ne 0) { throw 'NuGet restore failed' }
& dotnet tool restore --configfile NuGet.Config
if ($LASTEXITCODE -ne 0) { throw 'EF tool restore failed' }
& npm.cmd --prefix src/minishop-web ci
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
