# Local deployment, LAN, backup and future cloud

## Stage 1: one Windows PC

Use Initialize-Dev and Start as in README for localhost development. The built frontend is served by the API on 5080, while the separate workspace-local PostgreSQL cluster listens only on 55432. Starting the app does not start a stopped database; rerun Initialize-Dev first. Ctrl+C stops the app. `Stop-DevDatabase.ps1` uses PostgreSQL's fast, clean shutdown, which waits for rollback/checkpoint rather than killing database files.

For a release build:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build.ps1
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\Env.ps1
dotnet publish src/MiniShop.Api -c Release --no-restore -o .runtime/publish
# Run with an explicit content root, so static files resolve correctly:
dotnet .runtime/publish/MiniShop.Api.dll --contentRoot "$((Resolve-Path .runtime/publish).Path)"
```

Do not deploy by copying only the DLL: retain its dependencies, runtime files and `wwwroot` together. Install .NET ASP.NET Core 10 runtime on the host, or deliberately publish self-contained for the target Windows architecture. This project verified framework-dependent Windows publishing; it did not install a persistent service or scheduled task.

Use a dedicated Windows account with access only to the published app, private configuration/key directory and necessary database privileges. Keep code/data/configuration/backups separately manageable. Protect secrets with NTFS permissions or your service's secret-management mechanism; `.gitignore` prevents normal commits but is not encryption. Windows Data Protection protects newly created key material with DPAPI when a private key directory is configured. Persist keys under the same service identity across restarts; do not reuse development keys for operational deployment. Restrict access to older development key files as sensitive data.

## Operational PostgreSQL roles

Use a fresh database with demo seeding disabled. Separate a migration owner from a runtime application login. The runtime login needs CONNECT, schema USAGE, SELECT and the appropriate INSERT/UPDATE/sequence privileges, and no superuser/CREATEDB/role-management/DDL permissions. Ledgers should have SELECT/INSERT only; immutable triggers are additional protection. The migration identity owns schema/triggers and runs EF migrations during controlled maintenance. Identity tables need the expected account/session updates. Test this exact least-privilege role configuration in staging; the automated database suite used an isolated cluster administrator to create temporary databases.

The first owner uses explicit Bootstrap environment credentials. Remove bootstrap password values from the deployed service configuration after successful initialization. Do not expose public registration. Keep database backups before each migration and check `dotnet ef migrations has-pending-model-changes --project src/MiniShop.Api` during development.

## Stage 2: phones and PCs on shop Wi-Fi

Keep PostgreSQL bound to loopback. Only the web application's HTTPS port should be reachable by shop clients. Reserve the shop PC's IP/hostname in the router and prevent sleep during business hours. Install a certificate whose hostname/IP matches the shop URL and whose issuer is trusted by every client. A localhost development certificate is not a production LAN certificate. Production cookies are Secure and the application redirects HTTP to HTTPS; do not bypass this by running an operational LAN shop in Development.

Example environment shape (certificate passwords and database credentials must be supplied privately):

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=https://0.0.0.0:5443
Kestrel__Certificates__Default__Path=C:\PrivateConfig\shop.pfx
Kestrel__Certificates__Default__Password=<set privately>
DataProtection__Directory=C:\PrivateConfig\MiniShopKeys
Bootstrap__SeedDemo=false
```

If TLS terminates at a reverse proxy, configure forwarded headers explicitly for known proxy IPs and validate HTTPS redirects/cookie behavior. The current default is direct Kestrel TLS; do not assume arbitrary forwarded headers are trusted.

An administrator can add a scoped Windows Firewall rule after confirming the actual HTTPS port and private network profile:

```powershell
New-NetFirewallRule -DisplayName 'MiniShop HTTPS (shop LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5443 -Profile Private -RemoteAddress LocalSubnet
```

This command is documentation only; no firewall rule was executed. Do not expose PostgreSQL, a Vite development server, or MiniShop through internet router port forwarding. Confirm the WLAN does not isolate clients, and restrict access to authorized shop devices/users. Browser crypto/session features work over trusted HTTPS; untrusted plain HTTP LAN origins are not a supported deployment.

Once built, scripts, fonts, authentication, charts, PDF generation and APIs are local. WAN loss does not stop operation while the shop PC, database and LAN remain reachable. Browser device disconnection or PC failure prevents new transactions. Test LAN HTTPS, a phone workflow, WAN disconnection and reconnection on site; these were not physically available in this session.

## Backup and recovery

Run Backup.ps1 at daily close and before migrations. It uses pg_dump custom format, a SHA-256 checksum and process-local PG environment credentials (not password command arguments). Supply an encrypted external destination with `-OutputDirectory` when appropriate. Keep multiple dated backups on separate storage; define a retention policy that matches the shop's requirements. Do not commit backups or retain them in an unprotected cloud share.

Run Verify-Backup.ps1 regularly. It creates only a unique `minishop_restore_<random>` database, restores the archive, validates schema and counts, then drops that temporary database. CREATEDB is required for this drill and should belong to a recovery operator, not the application. A successful drill validates technical recoverability; an operator must still reconcile business totals and test a restored application.

For an actual incident:

1. Stop checkout, preserve current database/log files and record the last confirmed receipt. Do not immediately overwrite the damaged/live database.
2. Check the chosen backup hash. Restore into a **new** recovery database using pgAdmin or `pg_restore --exit-on-error --no-owner --no-acl`. Supply connection credentials privately. Recreate roles/permissions deliberately; the archive omits server-wide roles.
3. Point an isolated copy of the same application release at the recovery database. Verify migrations, login, product stock, sales count/totals, outstanding credit, last receipt, and ledger consistency. Compare expected records after the backup time; those may require reconciliation.
4. Cut over with explicit owner approval after validation. Prevent both old and recovered instances from taking live sales. Rotate/recover service keys and credentials where appropriate. Record downtime and any missing transactions.

A backup does not include the application release, Windows account configuration, external TLS certificate, Data Protection key directory, or passwords. Retain these through a separate secure operational process. Loss of authentication keys invalidates sessions; signed-in users must authenticate again.

## Stage 3: future cloud

A first cloud stage can run the same monolith with managed PostgreSQL, HTTPS, managed secrets, restricted administration, monitoring, and automated tested backups. It changes the availability model: centralized cloud hosting needs internet for shop operation unless the local authority remains.

Bidirectional synchronization is deliberately not implemented. A future design should keep local checkout authoritative per store; write an outbox event in the same local transaction; upload events with globally unique ids, store id and sequence; maintain durable cloud inbox deduplication; and reconcile stock/credit periodically. Define conflict rules for product prices, employee access, customer identity, refunds and replicated personal data. Never implement naive last-write-wins for money or stock, and never replay a cloud command as a new local sale. Encrypted transport, key rotation, event versioning, partial failure recovery, privacy/retention, clock drift and disaster drills need their own milestone and tests.
