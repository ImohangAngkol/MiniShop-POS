# LAN and hardware preparation verification

Reviewed 2026-10-18 (Asia/Manila), revision `039d3c0` plus secure-staging and LAN/hardware working changes. No commit/push or system-level network/trust changes are part of this milestone.

## Implemented behavior

- Separate fictional `minishop_lan` database, migration owner/runtime login, private configuration, CA/server certificates, DPAPI keys and publish directory. Development 5080 and staging 5443 remain available. Default rehearsal binds **only 127.0.0.1:5643**; the explicit private-adapter option was not used.
- Proposed hostname **minishop.local** is configurable, as requested. The current machine's private Ethernet address is provisional; shop DNS/mDNS/IP reservation and real device access are unverified. Inspection also found VPN/virtual adapters. No wildcard or IPv6 binding is allowed. Read-only firewall inspection showed Private inbound blocking enabled; nothing was changed.
- Same-origin `/api`, local static assets, no public/DB exposure, strict private CA/SAN/time checks, no runtime migration/bootstrap, restricted database grants and separate host-prefixed cookies.
- Exact scanner API independent of cached fuzzy search, category or paging. Leading zeros, repeated Enter bursts, unknown/ambiguous codes, stock guards, slow response/next-code preservation and focus recovery have dedicated coverage.
- 58/80 mm preview selection and matching PDF download. Fixed-width Courier replaces proportional PDF glyphs for bounded wrapping; HTML amount alignment and print-media workspace offsets are checked. Store details/default width remain owner-configurable. Mobile POS grid sizing was corrected after the new scanner browser test detected horizontal overflow.
- Local-server feedback identifies shop Wi-Fi/server availability and safe saved-request retry. External-origin blocking during a fresh browser load simulates WAN dependency loss; interruption before commit and a lost response after commit are distinct tested cases.

## Executed checks

The initial backend/frontend run passed **82 backend and 32 frontend tests**, zero failures/skips. The first 11-workflow browser run passed 10 and detected mobile POS horizontal overflow; the grid fix is included in the final rerun. Receipt layout/PDF checks, external-origin blocking, local-server recovery and existing commerce workflows passed in that initial run.

### Final rerun

The final `Test-Lan.ps1 -Browser` run passed **82 backend, 32 frontend and 11 Chromium workflows**, with **zero failures or skips**. It ran against the isolated Release publish and reviewed progress snapshot. The mobile POS fix passed with a 390 x 844 viewport; the screenshot waits for sidebar animation to finish. Both 58/80 mm browser and downloaded PDFs passed paper-width and sales/change/cashier content checks and rendered successfully; all four generated examples were one page. Receipt preview and mobile scanner screenshots were visually inspected. No physical printing/scanning occurred.

Strict TypeScript/Vite build, Debug solution build and separate Release publish passed with zero backend warnings/errors. Formatting, progress consistency, EF model-drift checks and exact scanner/security regressions passed. Development health and the existing localhost staging TLS/CSRF/Host/CORS checks remained healthy. TCP inspection confirmed all five app/database listeners stayed loopback-only (5080, 5443, 5643, 55432, 55433).

`Test-StagingBackup.ps1 -Lan` passed: runtime backup plus SHA256, separate migration-owned restore, restricted-role access and matching **36 public table/sequence states** plus stock/cash/credit/refund/last-receipt reconciliation. The original LAN database stayed unchanged; the temporary recovery database was dropped. Only the LAN host was stopped/restarted; development and localhost staging stayed running. Restored-app operator and off-site recovery acceptance remain pending.

Source safety review compared known local development/staging/LAN secrets in memory and checked changed files for runtime/binary/backup/private-key/token and non-test email content. It found no matches, and the Git index is empty. All CA/server PFX files, credentials, database/backup artifacts, screenshots, generated PDFs and frontend dist stay ignored. No certificate was trusted/installed, no firewall/router/network-profile/system setting changed, no public/private-adapter service was exposed and no commit/push occurred.

Reproduction:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
# Only if not prepared; choose the verified private IP. No adapter binding occurs:
# .\scripts\Prepare-Lan.ps1 -ServerAddress '<verified private IPv4>' -HostName minishop.local
.\scripts\Start-Lan.ps1 -Background
.\scripts\Test-Lan.ps1 -Browser
Push-Location src/minishop-web
node scripts/verify-device-receipts.mjs
npm.cmd run format:check
Pop-Location
node scripts/update-progress.mjs --check
# Separate technical LAN recovery drill; keep the existing staging host/cluster running:
.\scripts\Stop-Lan.ps1
.\scripts\Test-StagingBackup.ps1 -Lan
.\scripts\Start-Lan.ps1 -SkipBuild -Background
```

Browser HTTPS requests use a test transport: Playwright `route.fetch` validates the server through Node with the configured public CA, then fulfills the browser response. There are no ignored-certificate flags, `ignoreHTTPSErrors`, TLS-disable variables or OS trust installs. Direct native browser/phone trust still requires approval and manual acceptance. Strict Node checks independently validate chain/expiry/SANs and reject a wrong identity. Browser API requests validate TLS too.

Backend TestServer uses ephemeral keys and disposable databases provisioned separately, then exercises APIs/commerce through a restricted role. The actual rehearsal HTTPS process uses Windows DPAPI. No real customer records are used or changed.

Simulations do not disconnect actual WAN hardware, configure DNS, test radio coverage, establish phone trust, send physical USB scanner events or prove printer drivers/cutters. Generated browser/PDF artifacts are not printed paper. Every physical/manual checkbox remains pending in [SHOP_DEVICE_ACCEPTANCE](SHOP_DEVICE_ACCEPTANCE.md).

## Progress assessment

**Overall 82.0%, functional 93.1%, production readiness 61.7% remain unchanged.** New evidence strengthens scanner software, receipt formatting and LAN configuration verification. It does not complete physical-device/LAN gates or resolve historical receipt identity, service identity, trusted operational credentials, managed/off-site recovery or external approval. Task weights/statuses are not increased just because more tests exist. All six release gates remain open.

Next milestone: select/acquire the USB HID scanner and thermal printer, finalize the shop identity, then run **owner-approved trusted-device and hardware acceptance** using the checklist. Obtain approval before trust, firewall/profile, DNS/router or operational service changes. Keep fictional rehearsal data separate from any future empty non-demo operational database.
