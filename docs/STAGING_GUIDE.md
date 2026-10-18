# Secure local staging

The [software acceptance profile](SOFTWARE_ACCEPTANCE_REPORT.md) adds loopback origin `127.0.0.1:5843`, with its own `minishop_acceptance` database, migrator/runtime logins, private configuration, DPAPI session keys and publish directory. It copies the existing LAN leaf certificate/public CA into its private directory, validates the IP SAN and chain, and installs no trust. It does not reseed development, staging or LAN. `Test-StagingBackup.ps1 -Acceptance` restores only into a new temporary `minishop_acceptance_restore_<guid>` database. `Test-AcceptanceRecovery.ps1` stops/restarts only the acceptance host and verifies its existing secure session and exact database snapshot.

For LAN/hardware preparation, use the **separate** [LAN profile](LAN_GUIDE.md) and [device checklist](SHOP_DEVICE_ACCEPTANCE.md). It has its own fictional database/roles/keys/publish on default loopback port 5643, configurable `minishop.local` and a private CA. The localhost 5443 profile remains distinct. See [current verification](LAN_VERIFICATION.md) before interpreting browser automation as actual device trust.

Staging is fictional, isolated and loopback-only. It does not replace the working development instance. Certificate trust, firewall changes, Windows services, router configuration and real shop data are outside these scripts. See [verification](STAGING_VERIFICATION.md) and [database permissions](DATABASE_ROLES.md).

| Resource | Development | Local staging |
| --- | --- | --- |
| Web origin | http://localhost:5080 | https://localhost:5443 |
| PostgreSQL | 127.0.0.1:55432 / minishop | 127.0.0.1:55433 / minishop_staging |
| Database files | .runtime/postgres | .runtime/staging/postgres |
| Runtime login | Existing development setup | minishop_staging_app, restricted |
| Migrations | Existing developer workflow | Separate minishop_staging_migrator process |
| Configuration | .runtime/local-env.ps1 | .runtime/staging/*.json |
| Session keys | Existing development directory | .runtime/staging/keys, DPAPI under the staging Windows user |
| Publish output | Existing instance unchanged | .runtime/staging/publish |

## Initialize and run

Requirements: the existing .NET 10 SDK, Node, restored project dependencies and PostgreSQL 18 binaries. Run in a normal PowerShell window as the Windows user who will own staging. No administrator elevation is needed for normal loopback use. Restricted automation sandboxes may block PostgreSQL process creation and Windows DPAPI; run the scripts outside that sandbox under the normal user, without weakening authentication or encryption.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Initialize-Staging.ps1
.\scripts\Start-Staging.ps1
# Optional hidden background process:
# .\scripts\Start-Staging.ps1 -Background
```

Open https://localhost:5443. The certificate is deliberately **not OS-trusted yet**. Do not enter real credentials through a certificate-warning bypass. For automated fictional acceptance, use the test command below. For normal browser use, request approval for the trust step first.

The initializer creates a fresh PostgreSQL cluster with SCRAM authentication, random separate passwords, a migrated database, a fictional owner and demo inventory/customer. The UI marks demo data; the initial store name includes STAGING. Credentials are in `.runtime/staging/fictional-owner.json`; do not paste them into issues, logs or source files. Reinitialization keeps existing staging data/passwords and reapplies migrations/grants. Stop staging first. A partial configuration is not silently replaced. Do not delete staging files to work around errors without checking whether they contain needed test records.

The protected staging folder grants access to its executing identity, the workspace owner and SYSTEM. It removes inherited broad access only from that staging folder. It does not change workspace, development, machine or firewall permissions. Review access before using another service account. Local administrators can take ownership; file ACLs are not encryption against administrators. Keep provisioner/migration credential files out of a future service account's access. The current local setup runs under one interactive user and is not an operating-system identity boundary between tools and app.

Runtime startup receives only `runtime.json`: no bootstrap password, no migration/admin login, no automatic migrations/seeding. It clears inherited development/test settings before launching and restores the caller's environment afterward. The web application rejects elevated database logins, plaintext/network URLs and accidental use of the development database in the local staging profile. Non-development environments now require `Bootstrap:Enabled=false` and `Database:AutoMigrate=false`; initialize them separately.

Stop a background host with `.\scripts\Stop-Staging.ps1`; use `-Database` to also cleanly stop the staging cluster. Foreground hosts stop with Ctrl+C. The scripts never stop the development process or cluster. The stop script checks the saved PID's executable/assembly before stopping anything.

## HTTPS certificate and trust

Generation uses .NET cryptography without opening a certificate store: RSA 3072, SHA256, server-auth usage, localhost/127.0.0.1/::1 SANs, and 90-day validity. The password-protected PFX/private key stays in the protected ignored directory. Windows Schannel loads its key under the current user's profile; the certificate is not added to a trusted store. DPAPI encrypts session keys for that same Windows user. Retain that account/profile and key directory for restarts; switching identities can invalidate sessions or prevent decryption.

```powershell
node scripts/verify-staging-https.mjs
```

This verifier trusts the exact public `.runtime/staging/localhost.crt` for this process, while still checking chain validity, expiry and localhost identity. It also checks anonymous authorization, secure CSRF cookies, Host rejection and lack of cross-origin CORS access. No `NODE_TLS_REJECT_UNAUTHORIZED=0`, global HTTPS-error bypass or machine trust changes are used.

**Approval required; not executed:** after reviewing the certificate fingerprint against the verifier output, a user may import **only the public certificate** into their Windows Current User Trusted Root Certification Authorities store using Certificate Manager. Review browser-specific trust behavior as well. Never distribute the PFX/private key. Remove the corresponding trust entry when retiring staging. Trusting this localhost leaf is for that PC only; it does not make a phone trust it. No script installs, renews or removes trusted certificates automatically. Before expiry, stop staging and arrange a reviewed certificate renewal and config update; rerun strict verification. Do not recreate the database to renew a certificate.

Microsoft documents [HTTPS enforcement and certificate trust](https://learn.microsoft.com/en-us/aspnet/core/security/enforcing-ssl?view=aspnetcore-10.0). Localhost is excluded from ASP.NET Core's default HSTS policy; this profile enforces HTTPS through its only listener, and does not advertise HSTS for localhost. Cookies remain Secure/HttpOnly/SameSite Strict with separate `__Host-MiniShop.Staging` names and an eight-hour fixed authentication-ticket lifetime. No public registration or permissive CORS policy exists. CSRF tokens remain mandatory for all unsafe controller requests, including login/logout. Proxy forwarded headers are not trusted by default.

## Automated acceptance

```powershell
.\scripts\Test-Staging.ps1 -Browser
```

This writes fictional test records **only** to the selected staging origin and disposable staging-cluster databases. Backend fixtures migrate/bootstrap separately, then use restricted runtime logins. TestServer keys are ephemeral. Browser tests now use Playwright `route.fetch` with Node's TLS-verifying transport and `NODE_EXTRA_CA_CERTS`, then fulfill the browser response. The earlier public-key certificate-exception flag was removed in the LAN milestone. No TLS errors are ignored. This does not establish native browser/mobile trust. Rebuild/publish the chosen host before running tests for newer source; the existing localhost staging publish may remain on its previous release while the separate LAN profile is tested.

The original test command remains available for development. Browser reports/traces, runtime configs, certificates, PostgreSQL files and backups remain ignored; do not force-add them to Git.

## Backup and restore rehearsal

Stop staging to quiesce writes, then:

```powershell
.\scripts\Stop-Staging.ps1
.\scripts\Test-StagingBackup.ps1
.\scripts\Start-Staging.ps1 -SkipBuild
```

The runtime role creates a custom-format dump without ownership/ACLs and a SHA256 checksum. A separate administrator creates only a uniquely named `minishop_staging_restore_<guid>` database. `pg_restore --role=minishop_staging_migrator --no-owner --no-acl --exit-on-error` restores it as the migration owner. Explicit runtime grants are reapplied, and the restricted role reads the restored copy. Every public table's row count/content digest and every sequence state must match the baseline. Stock, cash, credit, refund totals and last receipt are compared too. Source staging must still match its pre-backup baseline. The temporary recovery database is dropped afterward; the private fictional archive remains. The development database is never a restore target.

This is an automated technical drill, not approval for real-data cutover or off-site disaster recovery. A human must still rehearse a recovered application, reconcile an accepted backup against actual shop records and verify retention, encryption and access to a separate backup device.

## Future LAN testing — approval and devices required

The current local profile intentionally rejects wildcard/network listeners. Before a LAN milestone, prepare a separately reviewed profile with a reserved private hostname/IP, a matching certificate, explicit AllowedHosts, the same restricted database role and new/private service configuration. Disable `LocalStaging:Enabled` only in that reviewed profile; retain Staging/Production security, secure cookies and no runtime bootstrap/migrations. Keep PostgreSQL loopback-only. Configure each PC/phone's certificate trust deliberately; mobile localhost points to the phone itself and this certificate has no shop LAN hostname/IP SAN. iOS may require explicit full trust for a manually installed issuer; Android/browser trust varies by device policy. Verify on the actual devices.

Only after approval should an administrator permit the HTTPS port on a Private network for LocalSubnet. Never open PostgreSQL, Vite, router port forwarding or public tunnels. Test Wi-Fi client isolation, sleep/resume, simultaneous checkouts, phone layouts, refunds, repayments, WAN disconnection/reconnection and receipt reprinting on the intended shop hardware. Record operator acceptance and resolve failures before production rollout.
