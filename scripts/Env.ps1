param([switch]$SkipLocalConfiguration)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.runtime\dotnet'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.runtime\nuget'
$env:NUGET_HTTP_CACHE_PATH = Join-Path $projectRoot '.runtime\nuget-http'
$env:npm_config_cache = Join-Path $projectRoot '.runtime\npm-cache'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $projectRoot '.runtime\browsers'
New-Item -ItemType Directory -Force -Path $env:DOTNET_CLI_HOME, $env:NUGET_PACKAGES | Out-Null
$localEnv = Join-Path $projectRoot '.runtime\local-env.ps1'
if (!$SkipLocalConfiguration -and !$env:ConnectionStrings__Shop -and (Test-Path -LiteralPath $localEnv)) { . $localEnv }
