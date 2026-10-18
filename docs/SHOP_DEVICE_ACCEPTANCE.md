# Shop device acceptance checklist

Software-only evidence is recorded separately in [SOFTWARE_ACCEPTANCE_REPORT](SOFTWARE_ACCEPTANCE_REPORT.md). Its fictional 300-product workload, automated cashier/browser checks, PDF layouts and isolated recovery do not tick the manual hardware, native trust, WAN disconnection or operator acceptance items below.

Prepared 2026-10-18. Proposed hostname **minishop.local**, configurable. Scanner/printer models are **not selected**. Real LAN devices, scanner, printer and actual WAN-loss acceptance are **pending**. A passing automated test does not check a physical box below. Use only fictional records during rehearsal. Follow [LAN setup and approval steps](LAN_GUIDE.md).

Record per run: date/time (Asia/Manila), operator/owner, release revision, server IP/name/adapter, browser/OS/version, phone model, scanner model/firmware/suffix, printer model/driver/paper width, test receipt references, expected/actual totals, evidence path and pass/fail/blocked reason. Keep real customer details and credentials out of shared reports.

## Automated verification — recorded separately

- [x] Same-origin API and local assets; isolated fictional LAN database/runtime role; loopback rehearsal by default.
- [x] Backend permission, session, CSRF/CORS, LAN address/host/database configuration and scanner lookup tests.
- [x] Scanner unit tests: queued duplicates, leading zeros, unknown code, stock limit, slow lookup and focus recovery.
- [x] 58/80 mm PDF character/width bounds and HTML preview/print-media tests.
- [x] Full-suite/browser results recorded in [LAN_VERIFICATION](LAN_VERIFICATION.md); final packaging/progress checks are recorded there separately.
- [x] Network simulation verifies external-origin denial and local interruption/retry; actual WAN hardware acceptance remains separate.
- [x] Fictional LAN backup/checksum/separate restore reconciles all 36 table/sequence states and stock/cash/credit/refund/last receipt totals; human restored-app/off-site recovery stays pending.

## Manual prerequisites and shop computer

- [ ] Owner approves the intended private network, canonical URL and test period. Record the actual IP/subnet; current development-machine networking is not proof of the shop setup.
- [ ] Select the real shop adapter; exclude VPN, virtual, public and guest networks. Verify firewall/profile status read-only.
- [ ] Finalize stable IP and local name resolution; confirm `minishop.local` or the configured alternative resolves on every device without WAN DNS.
- [ ] Approve certificate trust per device/user; compare CA fingerprint through a trusted channel. Do not bypass warnings.
- [ ] Approve any scoped firewall/profile/router changes explicitly; retain reversal steps. Database/Vite/public forwarding remain closed.
- [ ] Run the dedicated LAN host on the selected private address; development 5080 and local staging 5443 remain healthy.
- [ ] Confirm PostgreSQL listens only on loopback and cannot be reached from another device.
- [ ] Verify dedicated operational service identity/private-file access, startup after reboot, sleep policy, power protection and disk space before real use.

## Cashier login and authorization

- [ ] Create an individual fictional cashier; verify login, logout and role-specific navigation on the actual cashier PC.
- [ ] Verify denied owner settings/reports/refunds/discounts/direct API routes and another cashier's sale; do not use a shared Owner account at the counter.
- [ ] Deactivate/reactivate/reset password and verify all previously signed-in sessions are revoked on real clients.
- [ ] Confirm lockout, eight-hour fixed session expiry and correct time on server/devices; no shared saved passwords on family/guest devices.

## Phone access

- [ ] Record Android/iOS model, browser/version, trusted issuer/SAN and canonical HTTPS URL; no warning bypass.
- [ ] Verify name and private-IP access as intended, login, responsive POS/cart/customer forms, scrolling, touch targets and onscreen keyboard behavior.
- [ ] Complete a fictional sale and repayment; lock/unlock/switch Wi-Fi, then verify correct session/recovery behavior.
- [ ] Verify permitted print/download behavior; do not assume a phone can print to the PC's USB printer.

## USB barcode scanner

- [ ] Select/acquire scanner; record HID keyboard mode, layout, supported barcode types, prefix and Enter suffix.
- [ ] Verify characters/leading zeros in a text editor, then scan into POS without manual Enter.
- [ ] Scan a known product, repeat it rapidly at least ten times and compare one cart line's quantity.
- [ ] Scan unknown, inactive, ambiguous, damaged and partial labels; verify no wrong product or hidden extra quantity.
- [ ] Change category and scan an exact code from another category; it must still locate the exact product.
- [ ] Verify piece, gram and kilogram defaults/adjustments, insufficient/expired stock and multiple-operator concurrency.
- [ ] Move focus to cash/customer then use Focus barcode scanner; verify focus recovery and no barcode entered into a money field.
- [ ] Test real scanner latency/burst behavior and Wi-Fi delay; do not drop duplicate scans or checkout while scans are pending.

## Thermal printer

- [ ] Select/acquire printer; record manufacturer driver/version, connection, printable width and supported roll sizes.
- [ ] Owner approves driver installation; OS test page prints correctly before POS testing.
- [ ] Test intended 58 and/or 80 mm paper, 100% scale, no headers/footers, actual margins, density and readable totals.
- [ ] Print long names/address/footer, weighted quantities, large amounts, Unicode, long/multipage sales and refunded/credit receipts; record any clipping/feed/cutter problems.
- [ ] Compare preview, paper and PDF totals, store identity and receipt reference. Review unsupported PDF scripts explicitly.
- [ ] Reprint from Sales history multiple times; verify no new sale/stock/credit movement.
- [ ] Test paper-out, printer offline, spooler recovery, duplicate print jobs and cutter; decide operator handling.

## Checkout and inventory updates

- [ ] Receive a known fictional quantity/cost/expiry and reconcile available stock, batch and stock history.
- [ ] Complete cash, weighted, discounted Owner and cashier transactions; compare stock, total, change, cashier and receipt.
- [ ] Attempt invalid quantities/negative stock/expired batches and simultaneous last-item sales; no overselling.
- [ ] Reload/retry an uncertain checkout with the same saved request and confirm exactly one sale.
- [ ] Verify owner stock adjustments/reversals and audit history; no hard history rewrites.

## Utang and refunds

- [ ] Name a fictional customer, set a limit, record partial-cash credit and reconcile sale/ledger/receipt.
- [ ] Verify partial/full repayment, duplicate saved repayment and overpayment/limit rejection.
- [ ] Owner refunds an unpaid/partially paid/fully paid credit sale; compare cash refund, restored batch stock and remaining customer balance.
- [ ] Cashier refund/discount/credit-limit attempts are denied. Repeating a refund creates no extra reversal.

## Internet disconnection and local interruption

- [ ] With owner approval during fictional testing, disconnect only the WAN path while keeping router/Wi-Fi/server powered; do not change router configuration without approval.
- [ ] From a fresh PC/phone browser load/login, receive stock, checkout, repay, refund and print/reprint without WAN access.
- [ ] Verify local DNS survives WAN loss and reconnection; no dependency on public DNS/CDNs/cloud login.
- [ ] Interrupt a client Wi-Fi link or the test server connection; clear local-server feedback appears and no success is invented.
- [ ] Reconnect, reload and retry the same saved checkout/payment; reconcile one sale/collection and expected stock/utang history.
- [ ] Record limitations: no browser-only transaction database; retain pending tabs and reconcile history before re-entry if a key is lost.

## Backup and recovery

- [ ] Protect backup/config/CA/DPAPI access; confirm encryption, retention and a physically separate backup destination.
- [ ] Quiet the fictional source, create checksum/backup and restore to a separate database—never over development, staging or live shop data.
- [ ] Reapply runtime permissions; run the restored application under its service identity.
- [ ] Operator compares products/batches, sales/cash/refunds, outstanding credit, ledger history and last receipt to the agreed recovery point.
- [ ] Rehearse restart/reboot and credential/certificate/key recovery; record recovery time, missing transactions and owner approval before any cutover.

## Release decision

- [ ] All failed/blocked items have an owner and disposition; evidence is attached without credentials/personal data.
- [ ] Independent security/invoicing/privacy/retention decisions are recorded and remaining progress gates are closed.
- [ ] Owner signs the explicit rollout/cutover decision. Percentage scores and simulated tests cannot authorize real shop use.
