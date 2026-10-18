. "$PSScriptRoot\Staging-Common.ps1"
Set-Location $projectRoot
$acceptanceRoot = Join-Path $projectRoot '.runtime\acceptance'
$listener = [Net.Sockets.TcpClient]::new(); $occupied = $false
try { $listener.Connect('127.0.0.1', 5843); $occupied = $true } catch [Net.Sockets.SocketException] { } finally { $listener.Dispose() }
if ($occupied) { throw 'Stop only the acceptance host before provisioning it.' }
if (!(Test-Path -LiteralPath $acceptanceRoot)) { New-Item -ItemType Directory -Path $acceptanceRoot | Out-Null }
$directoryInfo = [IO.DirectoryInfo]::new($acceptanceRoot)
$acl = $directoryInfo.GetAccessControl([Security.AccessControl.AccessControlSections]::Access); $acl.SetAccessRuleProtection($true, $false)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$workspaceOwner = [Security.Principal.NTAccount]::new((Get-Acl -LiteralPath $projectRoot).Owner).Translate([Security.Principal.SecurityIdentifier])
foreach ($sid in @($identity, $workspaceOwner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')) }
$directoryInfo.SetAccessControl($acl)
& dotnet build tools/MiniShop.Staging --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Acceptance tool build failed' }
& dotnet $stagingTool prepare-acceptance $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Acceptance provisioning failed' }
