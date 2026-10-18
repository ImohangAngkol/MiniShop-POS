param([Parameter(Mandatory=$true)][string]$ServerAddress, [string]$HostName = 'minishop.local')
. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$lanRoot = Join-Path $projectRoot '.runtime\lan'
$pidFile = Join-Path $lanRoot 'app.pid'
if ((Test-Path -LiteralPath $pidFile) -and (Get-Process -Id ([int](Get-Content -LiteralPath $pidFile)) -ErrorAction SilentlyContinue)) { throw 'Stop the LAN rehearsal host before provisioning/migrating it.' }
$listener = [Net.Sockets.TcpClient]::new(); $occupied = $false
try { $listener.Connect('127.0.0.1', 5643); $occupied = $true } catch [Net.Sockets.SocketException] { } finally { $listener.Dispose() }
if ($occupied) { throw 'Port 5643 is occupied. Stop the foreground host before LAN maintenance.' }
if (!(Test-Path -LiteralPath (Join-Path $stagingRoot 'admin.json'))) { throw 'Initialize the localhost staging cluster first. This script will not replace it.' }
if (!(Test-Path -LiteralPath $lanRoot)) { New-Item -ItemType Directory -Path $lanRoot | Out-Null }
$directoryInfo = [IO.DirectoryInfo]::new($lanRoot)
$acl = $directoryInfo.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $false)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$workspaceOwner = [Security.Principal.NTAccount]::new((Get-Acl -LiteralPath $projectRoot).Owner).Translate([Security.Principal.SecurityIdentifier])
foreach ($sid in @($identity, $workspaceOwner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
$directoryInfo.SetAccessControl($acl)
& dotnet build tools/MiniShop.Staging --no-restore
if ($LASTEXITCODE -ne 0) { throw 'LAN preparation tool build failed' }
& dotnet $stagingTool prepare-lan $projectRoot $ServerAddress $HostName
if ($LASTEXITCODE -ne 0) { throw 'LAN preparation failed' }
Write-Output 'Prepared only. No listener, trusted certificate installation, firewall rule, DNS or router change was made.'
