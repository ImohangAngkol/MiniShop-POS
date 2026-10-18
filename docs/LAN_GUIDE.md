# LAN and shop-device preparation

Prepared 2026-10-18. Proposed hostname: **minishop.local**, configurable. No physical scanner/printer is selected. Real phone/second-PC, Wi-Fi/WAN and hardware acceptance remain pending. See [the acceptance checklist](SHOP_DEVICE_ACCEPTANCE.md) and [verification report](LAN_VERIFICATION.md).

## Architecture and inspection findings

The shop computer serves the built React frontend and ASP.NET API from one HTTPS origin; the frontend uses relative `/api` URLs. PostgreSQL stays on that computer, loopback-only. All application JS, CSS, fonts and receipt rendering are local. External internet availability is separate from availability of the shop computer, Wi-Fi and local name resolution. No cloud connection or browser-only offline database is implemented.

| Environment | Web origin | Database | Configuration/publish/keys |
| --- | --- | --- | --- |
| Existing development | http://localhost:5080 | minishop / 127.0.0.1:55432 | Existing files unchanged |
| Existing secure staging | https://localhost:5443 | minishop_staging / 127.0.0.1:55433 | .runtime/staging |
| New LAN rehearsal | https://127.0.0.1:5643 by default | minishop_lan / 127.0.0.1:55433 | .runtime/lan, separate roles, credentials, keys and publish |
| Future approved LAN | https://minishop.local:5643 or the certificate's private IPv4 address | Same fictional LAN acceptance DB until operational cutover is separately accepted | Explicit private-adapter listener; never wildcard/public |

The existing staging profile and localhost certificate intentionally cannot serve remote devices. The inspected PC has Ethernet, VPN and virtual adapters; Wi-Fi was disconnected during inspection. Its current private Ethernet address was used only as a provisional certificate/rehearsal value, not a shop network reservation. Firewall readback showed an enabled Private profile with inbound blocking. No connection profile or firewall rule was changed. Network identity, local DNS/mDNS, actual device trust and printer/scanner procurement are remaining prerequisites.

## Prepare without enabling network access

From the workspace in a normal PowerShell terminal under the Windows user who owns the private configuration:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
$shopPrivateIp = Read-Host 'Verified shop PC RFC1918 IPv4 (not VPN/public/virtual)'
.\scripts\Prepare-Lan.ps1 -ServerAddress $shopPrivateIp -HostName minishop.local
node scripts/verify-lan-config.mjs
.\scripts\Start-Lan.ps1 -Background
.\scripts\Test-Lan.ps1 -Browser
# Stops only the separate rehearsal host:
.\scripts\Stop-Lan.ps1
```

Preparation requires the existing staging cluster to be running. It creates only `minishop_lan`, `minishop_lan_migrator` and `minishop_lan_app`, applying the same explicit restricted grants as secure staging. Development/staging databases and running hosts are preserved. Credentials and fictional owner login are private ignored files under `.runtime/lan`; the web host gets only runtime credentials. Do not publish or copy provisioning files into a future service account's access. The current interactive user can read all private files; separate OS identities remain a release gate.

The default host listens only on **127.0.0.1:5643**. It retains secure cookies, CSRF, rate limiting, lockout, immediate account/stamp validation, role restrictions, API no-store and same-origin CSP. Session cookie `__Host-MiniShop.Lan` and DPAPI keys/application discriminator are separate from development and staging. There is no runtime migration/bootstrap or permissive CORS. LAN startup rejects public/VPN-range addresses, wildcard/IPv6 listeners, extra plaintext endpoints, wildcard hosts, development/staging database targets and elevated runtime database roles. An RFC1918 address alone does not prove the selected adapter is the shop LAN; the operator must verify it.

## Certificate, identity and phone/browser trust

Preparation generates a **private local CA** (one year) and server-auth leaf (90 days), RSA 3072/SHA256, with SANs for the proposed private IP, configurable hostname, localhost and 127.0.0.1. No certificate store is opened or trusted. The public `ca.crt` is the only file to distribute to approved clients. Keep `ca.pfx`, `server.pfx`, passwords and migration credentials private. The startup validator checks the private chain, certificate time and hostname/IP SANs; client verification also checks identity and chain. The private CA has no online revocation service; remove/rotate its trust if compromised and define an accepted renewal/revocation procedure before operational release.

`minishop.local` needs working **local** name resolution. `.local` uses mDNS on supporting networks; merely putting a name in a certificate does not advertise it. Windows/mDNS and router/client-isolation behavior must be verified. A reserved local DNS name under `.home.arpa` is another supported configurable choice. Phones cannot use a PC's hosts-file entry. The certified stable private IP can be used when name resolution is unavailable. Reserve/finalize the IP and choose one canonical URL before user acceptance; different hostnames/IPs have separate browser sessions. A phone's localhost points to the phone.

**Approval required; commands below are documentation only, not executed.** Review the CA fingerprint from `verify-lan-config.mjs` on a trusted channel and approve trust for each device/user. On Windows, import only the public CA into Current User roots:

```powershell
# Run only after explicit approval for this Windows user/device:
certutil.exe -user -addstore Root .runtime\lan\ca.crt
# To retire that approved trust later, use the exact CA SHA1 thumbprint
# printed by verify-lan-config.mjs, after verifying the store entry:
# certutil.exe -user -delstore Root '<exact CA SHA1 thumbprint without colons>'
```

For iPhone/iPad, owner-approved profile installation may also require enabling full SSL trust in Settings > General > About > Certificate Trust Settings; follow [Apple's instructions](https://support.apple.com/en-us/102390). Android user-CA support varies with browser/device policy. Verify current Chrome/Edge/Firefox/Safari on the intended devices; no blanket compatibility claim is made. Do not proceed through certificate warnings or enable insecure-content flags. Browser printing on phones depends on their OS/driver (for example AirPrint); a USB thermal printer on the server PC is not automatically reachable from a phone.

Strict checks, after the selected listener and name resolution are available:

```powershell
node scripts/verify-lan-https.mjs https://minishop.local:5643
curl.exe --cacert .runtime\lan\ca.crt https://minishop.local:5643/api/health
```

On phones, verify the URL, issuer/SAN identity, a clean trusted connection and login/checkout without warnings. The automated rehearsal explicitly trusts only the local public CA in Node, validates expiry and hostname, and rejects mismatched identity. Browser traffic is delivered through Playwright `route.fetch` using that TLS-verifying Node transport; there are no ignored-certificate flags or `ignoreHTTPSErrors`. This exercises the built UI against HTTPS but does **not** establish native browser/phone trust. Direct device trust is manual acceptance.

For renewal: record both expiry dates; review at least 30 days before leaf expiry. Stop only the LAN host, back up its private configuration securely, issue a new server-auth certificate from the approved private CA with the finalized name/IP SANs, export a password-protected leaf/chain PFX, update `Lan__CertificatePath`, `Lan__CertificatePassword`, and the public `server.crt`, then run both verification scripts and restart. Do not overwrite/recreate a database or session keys to renew TLS. If changing IP/name, update the SANs plus `Lan__ServerAddress`, `Lan__HostName` and exact AllowedHosts together. If the CA expires or is compromised, generate/review a replacement and obtain fresh approval for each device's trust, then remove the retired root. Preparation deliberately refuses silent identity replacement. Automated certificate renewal and operator recovery/rotation rehearsal remain release work.

## Approval before private-adapter access

Verify the chosen adapter/IP, network profile, actual shop subnet and ownership of the Wi-Fi. No public tunnels, UPnP, router port forwarding, public IPv6 listener, PostgreSQL exposure or Vite access is part of this setup.

```powershell
# Read-only inspection:
ipconfig
Get-NetConnectionProfile
netsh advfirewall show currentprofile
```

If the correct shop network must be changed to Private, obtain explicit approval first; a local administrator can then run `Set-NetConnectionProfile -InterfaceAlias '<verified shop adapter>' -NetworkCategory Private`. Never apply this to a public/VPN network.

After approval, an administrator may create one narrow inbound rule. Substitute the verified IP/subnet; do not widen it to Any:

```powershell
$shopPrivateIp = Read-Host 'Approved shop PC private IPv4'
$shopSubnet = Read-Host 'Approved shop IPv4 subnet in CIDR form'
New-NetFirewallRule -DisplayName 'MiniShop LAN HTTPS 5643' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5643 -LocalAddress $shopPrivateIp -RemoteAddress $shopSubnet -Profile Private -Program (Get-Command dotnet.exe).Source
# Start the prepared host on only its configured private IP, after approval:
.\scripts\Start-Lan.ps1 -SkipBuild -EnableLan -Background
# Reversal, when explicitly requested:
# .\scripts\Stop-Lan.ps1
# Remove-NetFirewallRule -DisplayName 'MiniShop LAN HTTPS 5643'
```

Do not change router settings automatically. An owner/router administrator must approve any DHCP reservation or local DNS/mDNS change and verify guest/client isolation. Restrict devices/users to the shop network; keep the server powered, awake and backed up. Neither `Prepare-Lan` nor default `Start-Lan` executes any of the system-level commands above.

## Scanner setup

Choose a USB **HID keyboard/wedge** scanner that supports the shop's barcode types; no model is accepted yet. Install/configure it using the manufacturer's instructions. Set keyboard layout to match Windows, no arbitrary prefix, and one Enter/CR suffix. Start with a text editor to check exact characters, leading zeros and suffix, then run the checklist in POS. Do not use actual transactions for setup.

POS accepts typed keyboard input or HID scans in the barcode field. Enter queues an exact server lookup independent of search-cache timing, catalog pagination or category selection. Repeated scans increment one cart line; piece/kg scans add one unit and gram products add 100 g, with manual quantity adjustment and server validation. Unknown/inactive codes and cross-product SKU/barcode conflicts produce errors and add nothing. The next typed code is retained during slow lookups; pending scans block checkout. Use **Focus barcode scanner** after other fields. Name searches use the visible product buttons, never a fuzzy auto-add.

Optional phone camera scanning is deferred: native [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector/detect) has limited availability and requires a secure context. A future progressive enhancement should feature-detect it, request camera permission only after an explicit tap, process frames locally, stop tracks when closed and retain typed/HID input. It needs actual phone/browser acceptance; no camera support is claimed here and no CDN scanner library was added.

## Printer setup and receipts

No printer model has been selected. Prefer a model with a maintained driver for the cashier OS and supported paper width. An owner must approve/install its manufacturer driver, connect it and print the OS test page first. In its preferences choose the actual 58/80 mm roll and printable area. In the receipt preview select the matching width, then Print receipt. Use 100% scale, zero/custom driver margins as appropriate, no browser headers/footers, and verify cutter/feed behavior physically. Browser CSS cannot set the printer, cutter or driver options automatically.

Owner settings configure store name/address/contact/footer and the default width. The receipt page offers a local 58/80 mm preview override and width-matched PDF download without changing saved settings. Layouts wrap long names and align currency totals; print media removes app chrome and page offsets. PDF uses fixed-width Courier, with width-bounded wrapping and multipage fallback. Downloaded PDF transliterates unsupported Unicode; browser receipts preserve it. Current store/customer details still appear on historical receipts—immutable archival identity is a separate release decision.

Phone print sheets and browser-generated PDFs do not prove physical printer compatibility. A phone unable to address the shop printer can send the transaction reference to the authorized cashier, who reprints that same receipt from Sales history. Do not create a second sale to print again.

## Internet versus local-server interruption

With Wi-Fi/server/DB/local DNS working, WAN loss should leave the shop origin available. Automated testing blocks external origins during a fresh load, credit checkout, repayment and refund. No external asset request is allowed. This simulates dependency loss, not router hardware, radio coverage or a real WAN unplug.

When the local server or Wi-Fi is unreachable, transactions cannot commit in the browser alone. Error messages point to shop Wi-Fi/server availability. An interrupted checkout stores the same request/payload in sessionStorage; restore connectivity and retry that saved operation, including after reload. Tests cover failure before commit and a lost response after commit without duplicate stock/sales. Keep the pending tab open; closing it may lose the request key, requiring reconciliation of Sales/Utang history before another entry. Do not clear pending data or take real-money browser-only offline orders on the assumption they will sync later.

Backups remain separate from application assets/certificates/DPAPI/OS identity. For the fictional LAN database, stop only the LAN host and run:

```powershell
.\scripts\Stop-Lan.ps1
.\scripts\Test-StagingBackup.ps1 -Lan
.\scripts\Start-Lan.ps1 -SkipBuild -Background
```

The `-Lan` switch selects only `minishop_lan` and a uniquely named `minishop_lan_restore_<guid>` copy. It uses the restricted runtime login for pg_dump, checks SHA256, restores as the migration owner, reapplies runtime grants and reconciles all public tables/sequences plus stock/cash/credit/refund/last receipt totals. The temporary copy is dropped; the original LAN, development and staging databases are never restore targets. Without `-Lan`, the existing staging drill keeps its original behavior. The staging cluster must remain running; do not stop it while either acceptance host needs it.

Have an operator validate a restored application and reconcile an agreed recovery point before any real cutover. A technical archive/data comparison does not establish off-site recovery, managed startup or a recovery-time guarantee. LAN acceptance uses fictional records only until every release gate is closed.
