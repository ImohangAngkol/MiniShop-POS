# Secure local staging verification

Reviewed 2026-10-18 (Asia/Manila), based on revision `039d3c0` plus the uncommitted staging milestone. No commit or push is part of this work.

## Environment and scope

The normal development instance remains on http://localhost:5080 with its original loopback PostgreSQL cluster on 55432. A new cluster under `.runtime/staging/postgres` uses 127.0.0.1:55433 and `minishop_staging`. Only invented demo/test products, customers, employees and transactions are used. The staging host uses **Staging**, direct Kestrel HTTPS at **https://localhost:5443**, a private PFX, separate DPAPI-encrypted session keys and a restricted runtime database login. Both HTTP staging/network listeners and accidentally selecting the development database are rejected by the local profile.

No trusted certificate installation, firewall/router changes, system service, system-wide policy or security changes were performed. Windows sandbox limitations required launching PostgreSQL and the staging host under the normal Windows account; this did not change machine configuration. The staging directory's private DACL covers the workspace owner, executing identity and SYSTEM. Runtime secrets and backups are ignored and kept out of source. The interactive staging user can read provisioning files; separate service/operator OS identities remain an operational release gate.

## Verification evidence

| Check | Result and scope |
| --- | --- |
| Provisioning | New cluster, SCRAM logins, two migrations, fictional demo seed; separate admin, schema owner and runtime credentials |
| Database privilege acceptance | API/commerce fixtures run as restricted runtime login; denied CREATE DATABASE/TABLE/TEMP, ALTER, TRUNCATE, financial UPDATE/DELETE and migration-history writes; startup verifier rejects cluster administrator |
| HTTPS | Strict Node verification trusts only generated public certificate, checks localhost identity and certificate validity; no global TLS bypass; unknown Host denied |
| Browser TLS | Chromium test process pins only the generated certificate's public key; Node requests use the extra public certificate; ordinary OS/mobile trust remains unconfigured |
| Session/configuration | Secure/HttpOnly/Strict host-prefixed staging cookies, eight-hour fixed tickets, environment-separated keys, DPAPI key XML, API no-store, CSP/frame denial, no permissive CORS or trusted proxy headers |
| Authentication/authorization | CSRF required on mutations/login; forged token denied; owner/cashier/anonymous boundaries; five-attempt lockout with simulated expiry on a fictional account; 15/minute IP limiter; employee deactivation/reactivation and password reset revoke two existing sessions; logout tested |
| Commerce | Existing concurrency/idempotency/rollback/FEFO/refund/utang suites pass with restricted grants. HTTPS browser workflow receives stock, sells PHP100 with PHP20 cash/PHP80 credit, repays PHP30, refunds PHP50 cash, restores stock to 10 and leaves zero debt |
| Backup and recovery | Runtime pg_dump, SHA256, separate temporary restore as migration owner, explicit runtime grants and restricted-role reads. All **36 public table/sequence states**, full row digests/counts, stock/cash/credit/refund totals and last receipt match. Source staging unchanged; recovery database dropped |
| Frontend/packaging | TypeScript/Vite production build, Debug solution build and separate Release publish; original development publish is not replaced |

Reproducible commands:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Initialize-Staging.ps1
.\scripts\Start-Staging.ps1 -Background
.\scripts\Test-Staging.ps1 -Browser
.\scripts\Stop-Staging.ps1
.\scripts\Test-StagingBackup.ps1
.\scripts\Start-Staging.ps1 -SkipBuild -Background
node scripts/update-progress.mjs --check
npm.cmd --prefix src/minishop-web run format:check
```

The initial staging acceptance run passed **55 backend / 24 frontend / 7 browser tests**, zero failures or skips. Additional local-profile boundary tests and the regenerated snapshot are included in the final rerun recorded below. Backend logs/TRX, browser traces/screenshots, DPAPI files, configs and fictional backup archives are retained only in ignored runtime/test output directories. TestServer keys are ephemeral and deliberately do not test DPAPI; the actual HTTPS host verifies DPAPI separately. No independent penetration/security certification is claimed.

## Final rerun

On 2026-10-18, `Test-Staging.ps1 -Browser` passed **62 backend, 24 frontend and 7 browser workflows**, with **zero failures/skips**. The reviewed 82.0% progress snapshot was served by the isolated Release publish and verified in the browser. The added browser logout check waits for completed navigation before querying the API; this removes a test race while retaining the authorization assertion.

Debug solution build and Release publish passed with zero warnings/errors. Progress generation/consistency, frontend formatting, EF `has-pending-model-changes` and PDF parsing/rendering passed. The downloaded receipt remained one page, 227 x 270 points, with expected sales/credit/cashier content. Current npm audit reported zero vulnerabilities; NuGet's transitive advisory check reported no vulnerable packages for API, tests or staging tool. These are results from the configured sources on this date, not a security guarantee.

Repeated staging initialization preserved existing data/credentials, applied no additional migrations and successfully reapplied grants. A second backup/recovery drill passed with all 36 table/sequence states and financial/stock/last-receipt reconciliation matching. The disposable recovery database was removed. Stop/restart and strict HTTPS/DPAPI readiness passed. The development health endpoint remained healthy.

Changed-source review compared local development/staging secret values in memory, checked for private keys/tokens/binary/runtime/backup paths and non-test email addresses, and found no matches. Git's index remains empty. Runtime credentials, certificates, database files and archives are ignored. No commit, push, trusted certificate installation, public listener, firewall rule or system security change occurred.

## Progress assessment and release gates

Only `production-credentials` moves from **partial** (50% task credit) to **needs-verification** (75%): local TLS, separate database roles, private configuration, DPAPI and recovery are now implemented and exercised. It is not complete because normal browser/device trust, a separate service identity and real operational credentials are not accepted. This adds **0.5 overall points**, from 81.5% to **82.0%**, and changes readiness from 60% to **61.7%** (18.5 earned points / 30 readiness weight). Functional development remains **93.1%**. Task weights and the six open release gates remain unchanged; local test counts do not grant automatic progress credit.

The six open gates are:

1. Production TLS/roles/secrets: approved trust, certificate renewal, separated Windows service/provisioner access, new non-demo operational database and credential/key protection review.
2. Trusted LAN/WAN-loss: real phone and second PC, matching shop hostname certificate, approved private subnet access, checkout/repayment through WAN loss and recovery.
3. Physical printer: 58/80 mm paper, long receipts, margins/density, cutter, driver/spooler, repeat/reprint and operator acceptance.
4. Physical scanner: rapid/repeated/unknown codes, focus recovery and weighted products on the intended device.
5. Managed recovery: accepted service start/restart and host reboot, protected scheduled/off-site backups, restored-app reconciliation with an operator, retention and recovery targets.
6. Independent security and invoicing/privacy/retention acceptance by qualified reviewers and owner decisions.

Other outstanding acceptance includes employee lifecycle **browser** coverage, full cashier permissions, accessibility/platform coverage, large-data pagination, endurance testing, receipt identity/archive policy and unsupported downloaded-PDF scripts. Lockout expiry is tested by changing only a disposable account's deadline, not waiting fifteen real minutes or changing system time.

Recommended next milestone: **approved trusted LAN and shop-hardware acceptance**, starting with a separate restricted Windows service identity and a matching trusted certificate. Obtain approval before certificate trust installation, firewall access or machine configuration. Use only fictional data for that rehearsal and keep public internet exposure disabled.
