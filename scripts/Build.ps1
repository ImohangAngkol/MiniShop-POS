. "$PSScriptRoot\Env.ps1"
Set-Location $projectRoot
& node scripts/update-progress.mjs --check
if ($LASTEXITCODE -ne 0) { throw 'Progress report is invalid or stale. Review progress/development-progress.json and run node scripts/update-progress.mjs.' }
& npm.cmd --prefix src/minishop-web run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
$webroot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'src\MiniShop.Api\wwwroot'))
$expected = [IO.Path]::GetFullPath((Join-Path $projectRoot 'src\MiniShop.Api\wwwroot'))
if ($webroot -ne $expected -or !$webroot.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing unexpected generated output path' }
if (Test-Path -LiteralPath $webroot) { Remove-Item -LiteralPath $webroot -Recurse -Force }
New-Item -ItemType Directory -Path $webroot | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'src\minishop-web\dist\*') -Destination $webroot -Recurse
& dotnet build MiniShop.slnx --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
