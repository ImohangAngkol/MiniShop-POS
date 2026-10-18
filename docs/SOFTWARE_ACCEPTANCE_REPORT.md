# Full software acceptance and reliability report

Verified **2026-10-18 (Asia/Manila)** against baseline revision `039d3c0` plus the completed secure-staging, LAN preparation and software-acceptance changes. **159 tests/scenarios passed, zero final failures, zero skipped**: 96 backend, 32 frontend, 14 Chromium workflows and 17 fictional-shop acceptance scenarios. Eight independent database invariants, PDF/rendering checks, backup/recovery and maintenance checks are additional checks, not included again in the 159 count.

**Decision:** software acceptance passed within the stated scope. **Overall 83.8%; functional 94.2%; production readiness 65.0%.** Six release gates remain open. This is not production, physical hardware, native mobile trust, long-duration soak, power-loss or multi-browser acceptance.

## Isolation and dataset

- Existing development `http://localhost:5080`, staging `https://localhost:5443` and LAN rehearsal `https://127.0.0.1:5643` remained running and healthy. Their databases were not seeded or reset. Only acceptance processes were stopped/restarted. Final listener inspection found the application/PostgreSQL listeners on loopback addresses only.
- New acceptance origin: **https://127.0.0.1:5843**. Dedicated fictional database `minishop_acceptance` in the existing staging PostgreSQL cluster on 127.0.0.1:55433; separate `minishop_acceptance_migrator` and restricted `minishop_acceptance_app` roles. Separate publish, credentials, DPAPI key directory and cookie/application identity under ignored `.runtime/acceptance`.
- Runtime policy verification rejects elevated roles; application startup cannot migrate/bootstrap. The preparation tool alone creates/migrates the acceptance database. Acceptance guards reject other databases, public/wildcard/HTTP origins, alternate endpoints and profile mixing. No package, trusted certificate, firewall/router rule or system-wide service was installed. No public listener was created; Git publication is separate from runtime verification.
- Deterministic seed: **300 products**, 50 each in beverages, snacks, canned goods, household items, frozen goods and weighted products. All names/SKUs/barcodes are fictional; 13-digit test barcodes have valid check digits. Weighted items use kilograms and grams. Six baseline products intentionally have zero stock; 294 opening batches have matching stock movements. There are **24 fictional households**, two independent cashier accounts and an owner. Additional automated workflows create explicitly fictional customers/products/employees without replacing baseline data.
- Seed is idempotent without reset. The write workload refuses an existing scenario file to prevent an accidental second baseline run. `--reports` refreshes read-only business reconciliation evidence (authentication still adds audit events). No runtime credentials, cookies, archives, PDFs or transaction exports are included in source control.
- TLS uses a private copy of the existing LAN leaf certificate/public CA, checks its chain/expiry/127.0.0.1 SAN and installs no trust. Chromium automation uses the existing strict Node CA-validated route transport. Native OS/browser/phone trust is still manual; TLS verification is never disabled.

## Coverage and results

| Suite/check | Expected | Actual | Evidence |
| --- | --- | --- | --- |
| Backend + real PostgreSQL migrations/runtime role | All commerce, permissions, constraints, isolation and rounding assertions pass | **96 passed, 0 failed/skipped** | `.runtime/test-results/backend.trx`; individual cases below |
| Frontend components/totals/scanner/API feedback | All 6 test files pass | **32 passed, 0 failed/skipped** | `.runtime/acceptance/frontend-results.json`; cases below |
| Built app in Chromium | Every workflow passes on strict loopback HTTPS | **14 passed, 0 failed/skipped/flaky** | `.runtime/acceptance/browser-results.json`; cases below |
| Fictional shop acceptance | Catalog, cashier races, retries, refunds, utang, reports and CSVs reconcile | **17 passed, 0 failed** | `.runtime/acceptance/scenarios.json`; expected/actual table below |
| Complete database reconciliation | Every sale/line/batch/household/payment ledger satisfies business invariants | **8 invariants passed**, zero discrepancies | `.runtime/acceptance/reconciliation.json`; restricted-role queries in AcceptanceReconciliation.cs |
| PDF + print layouts | Device/browser PDFs match 58/80 mm widths; readable expected totals/cashier; original weighted slip correct | **5 artifacts passed** and rendered: 58 device 1 page, 58 browser 2 pages, 80 device/browser 1 page each, original weighted PDF 1 page | `verify-device-receipts.mjs`, `verify-pdf.mjs`; ignored PDFs/PNG renders under `.runtime` |
| Release build/publish | TypeScript, Vite, solution build and isolated Release publish succeed | Passed; .NET build **0 warnings/errors** | `.runtime/acceptance/final-build.log` |
| Migration consistency | No pending EF model change; fresh databases apply both migrations | Passed; no pending model changes; new acceptance/test databases migrated | `dotnet ef migrations has-pending-model-changes`; backend TRX |
| Formatting/syntax | C# formatter, frontend Prettier, PowerShell parser and Git whitespace checks pass | Passed after scoped formatting corrections | `.runtime/acceptance/dotnet-format-final.log`; commands below |
| Dependencies | Query current NuGet/npm advisories including transitive packages | **No known vulnerable packages / npm 0 vulnerabilities** | `.runtime/acceptance/dotnet-audit.log`, `npm-audit.log` |
| Isolated backup/restore | Checksum verified; new temporary DB restores exact source data with restricted role | Passed; **all 36 table/sequence states**, financial/stock/refund/last-receipt aggregates match; source unchanged | `.runtime/acceptance/recovery.log`, `backup-snapshot.json`; private dump/SHA256 retained |
| Controlled restart | Stopped host unavailable; existing secure session and all data survive restart | Passed: expected ECONNREFUSED while stopped; session resumed without login; exact pre/post snapshot | `.runtime/acceptance/recovery-result.json`; this is controlled shutdown, not power failure |
| Existing profiles/security | All four hosts healthy; profiles/identities separate; stage/LAN TLS, CSRF, Host, CORS and anonymous access guards remain valid | Passed; loopback listeners verified | `verify-acceptance-isolation.mjs`, existing stage/LAN verification scripts |
| Progress/source safety | JSON/dashboard/docs agree; runtime/secrets excluded; proposed files reviewed | Passed; no secret/runtime/customer-data/backup findings; exact Git index checked separately before publication | Progress scripts; private changed-source/known-secret scan |

## Fictional shop scenarios

Each row records the expected behavior and the observed assertion result. A01–A14 were executed once against the fictional baseline; A15–A17 were refreshed after final browser workflows. Evidence: [acceptance harness](../src/minishop-web/scripts/software-acceptance.mjs), [dataset](../tools/MiniShop.Staging/AcceptanceDataset.cs) and ignored `.runtime/acceptance/scenarios.json`.

| ID / scenario | Expected result | Actual result | Status |
| --- | --- | --- | --- |
| A01 — 300-product fictional convenience store catalog | 300 unique SKUs/barcodes, 50 per category; 6 initial out-of-stock products | 300 products, six categories, unique codes, six empty products verified through paginated API | Passed |
| A02 — Repeated scans, weighted basket, discount, cash and change | Subtotal 173.46; owner discount 3.46; total 170; tender 200; change 30; refund restores exact stock | Sale MS-20261018-879D89C963BC: exact weighted rounding/tender and full stock reversal passed | Passed |
| A03 — Out-of-stock and invalid baskets roll back | 409 for empty stock; 400 for fractional piece, insufficient cash and excess discount; unchanged stock | Four rejected baskets; no inventory effect | Passed |
| A04 — Utang, partial repayment and refund after repayment | 70 sale: cash 20 + debt 50; repay 15 leaves 35; refund cash 35 and debt zero | Two cashier identities, partial repayment, refund cash and customer balance reconciled | Passed |
| A05 — Concurrent duplicate checkout and key conflicts | Eight identical requests create one sale/one stock decrement; changed payload/actor rejected 409 | Eight responses share sale 3; single inventory effect | Passed |
| A06 — Uncertain checkout response and safe retry | Discard committed response then retry original request key: same sale and one inventory effect | Lost-acknowledgement simulation recovered one committed sale; transport fault before send covered by browser workflow | Passed |
| A07 — Two cashiers race for scarce stock | 20 requests for five available units: exactly five sales, 15 conflicts, final stock zero | 5 committed, 15 safely rejected, 0 units remaining | Passed |
| A08 — Concurrent utang respects a household credit limit | 12 requests of 20 against limit 100: five accepted; balance exactly 100 | 5 charges, 7 credit-limit conflicts, balance 100 | Passed |
| A09 — Concurrent partial repayment and duplicate repayment | Eight same-key repayments of 15 produce one payment; concurrent 80 repayments accept once; balance 5 | One 15 repayment, one 80 repayment, overpayment rejected; balance 5 | Passed |
| A10 — Concurrent repeated refunds | Eight refunds return one reversal with stock restored exactly once | Eight refund responses; one stock/cash reversal (database ledger independently checked) | Passed |
| A11 — Near-expiry FEFO picking and expired receiving guard | Receive 3 near-expiry + 20 later; sale 4 consumes 3 early + 1 later; expired receive rejected | FEFO 3+1, early batch empty, later batch 19, expired receiving blocked | Passed |
| A12 — Owner-only route permission matrix | Both cashiers receive 403 on all 22 owner-only API operations; no cost-price disclosure | 44 owner-route denials, 4 business-rule denials, 2 cost-price redactions verified | Passed |
| A13 — Cashiers cannot access each other's sale or PDF | Own sale/PDF available; other cashier receives 403; sale list contains only own actor | Own and cross-cashier sale/PDF access and list filtering passed | Passed |
| A14 — 120 realistic baskets across two concurrent cashiers | 120 three-item cash baskets, concurrency 8; exact catalog-derived total and stock deltas | 120 committed baskets / 360 item lines; exact revenue 10596.00; all 90 affected product quantities reconciled | Passed |
| A15 — Reports reconcile against independent database records | Revenue, COGS, cash, outstanding, product allocations, daily totals and inventory match raw records | Revenue 12493.8; cash 12334; utang 159.8; COGS 7402; valuation 726447; zero discrepancies | Passed |
| A16 — Sales, credit and inventory CSV reconciliation | Every CSV row and financial/inventory amount matches independent database records | 174 sales, 40 customer balances, 331 inventory rows matched | Passed |
| A17 — Private progress API denies both cashiers | Both fictional cashiers receive 403 on the owner-only progress snapshot | Both cashier identities denied; browser direct-route denial also verified | Passed |

The 120-basket phase used concurrency eight, alternating two cashier identities, 360 item lines across 90 products, and independently computed expected totals and stock decrements. Separate 20-way scarce-stock and 12-way credit-limit races exceeded available stock/credit deliberately. The global writer lock serializes database mutations; this bounded verification demonstrates correctness, not a sustained throughput/latency capacity guarantee. Artificial transport failures/lost acknowledgements are distinguished from physical Wi-Fi/WAN failure.

## Final financial and inventory reconciliation

The final database contains **174 historical sales: 162 completed and 12 refunded**. It includes the baseline workload and the fictional browser/retest records; failed requests do not create sales. Database totals below were queried independently of report endpoints and then compared to sales/dashboard/inventory APIs and every CSV row.

| Measure | Final actual result |
| --- | ---: |
| Net completed revenue | PHP 12,493.80 |
| Net cash ledger, including repayments and refunds | PHP 12,334.00 |
| Outstanding utang | PHP 159.80 |
| Revenue minus cash minus outstanding | **PHP -0.00** |
| Completed cost of goods | PHP 7,402.00 |
| Net gross profit | PHP 5,091.80 |
| Inventory valuation | PHP 726,447.00 |
| Piece stock | 24219 pieces |
| Kilogram stock | 1288.75 kg |
| Gram stock | 118750 g |

Stock units are reconciled separately; adding pieces, kilograms and grams would be misleading. Every batch matches its opening/receiving/sale/refund/adjustment movements; no negative inventory. Every line quantity equals its batch allocations; costs and rounded line prices reconcile. Every sale/refund equals its cash ledger; every repayment equals its debt allocations. All customer balances are nonnegative and within configured limits. Product revenue/profit allocations and daily report sums equal the aggregate report, including discounted/refunded/free sales. Sales, credit and inventory CSV row counts and amounts match database records. The restored copy matches every source table and sequence, not just totals.

## Defects discovered and resolved

1. **Confirmed product defect — discounted product report allocations could lose/create cents.** Three PHP 0.05 lines with PHP 0.05 discount produce a PHP 0.10 sale; independent per-product rounding previously reported PHP 0.09. The regression failed before the fix (`.runtime/test-results/discount-before-fix.trx`). ReportService now allocates integer cents by largest fractional remainder with stable item-ID ties; refunds reverse the same allocation. Three backend cases cover fractional allocation, fully discounted and zero-subtotal baskets, including exact refund reversal. Final backend and whole-database report reconciliation pass. No stored transaction or schema rewrite was needed.
2. **Automation reliability — conflicting color environment generated a harmless Playwright worker warning that PowerShell treated as terminating.** The acceptance wrapper now temporarily removes/restores NO_COLOR and emits a durable JSON browser report. The initial incomplete/aborted log is not counted as a passing run; the final complete 14-case run passed.
3. **Harness correction — a 403 response with an empty body was initially parsed as JSON in the added private-progress case.** The harness now asserts the actual HTTP status directly; both cashiers receive 403 and the final A17 passes. Missing explicit migration/test connection variables in preliminary CLI attempts were corrected using private acceptance/admin configuration. These were verification setup issues, not additional application defects.
4. **Formatting findings** in the existing uncommitted LAN/security changes and new acceptance helpers were corrected only in affected files. Final C# and frontend format checks pass.

## Remaining limitations and release blockers

All **six release gates remain open**:

1. Actual thermal printer, roll widths, margins, driver, paper-out/spooler/cutter and cashier reprint acceptance.
2. Actual USB keyboard-compatible scanner speed/focus/layout/leading-zero behavior and cashier practice.
3. Trusted HTTPS on an actual phone and second PC, finalized private hostname/IP and DHCP/DNS plan, real WAN-disconnection/reconnection drill. Proposed `minishop.local` remains configurable; no firewall/trust/router changes were performed.
4. Approved service identity/managed startup, reboot and operator recovery; protected off-device encrypted backups, retention and witnessed restoration/cutover.
5. Approved operational HTTPS trust/renewal, separated provisioning access, protected session keys/configuration and fresh non-demo operational credentials.
6. Independent security, privacy/retention, commercial receipt/invoicing review and owner rollout approval.

Additional unfinished software acceptance: long-duration soak, abrupt process/power failure and database crash recovery, actual supported browser/OS matrix (only Chromium automated here), operator account-recovery acceptance on actual shop clients, larger history/selector pagination, manual spreadsheet export use, historical receipt identity and unsupported PDF Unicode scripts. Current receiving/product search permits exact test-catalog access; some batch/customer/ledger views remain capped. Browser-only offline checkout is not implemented. When the local server is unreachable, checkout requires reconnection and reuse of its saved request key; do not invent a second sale. Print/PDF tests cannot prove physical printer compatibility. Optional camera scanning is outside the accepted USB-keyboard path.

**Recommended next milestone:** a supervised shop-device and operational-recovery pilot using only fictional data. Select the scanner/printer; finalize LAN addressing and supported browsers; explicitly approve any narrow firewall/certificate-trust/service changes; complete [SHOP_DEVICE_ACCEPTANCE](SHOP_DEVICE_ACCEPTANCE.md) on the actual server, second PC and phone, including WAN loss, paper-out/reprint, boot/recovery and operator reconciliation. Run extended soak/crash/browser-matrix testing alongside that pilot before any real-data cutover.

## Reproduction

Use a normal Windows PowerShell session in the project directory. The existing local staging PostgreSQL cluster and prepared LAN certificate must already exist. No script below trusts a certificate or opens a firewall port. DPAPI session keys and Windows certificate private-key access require the same Windows identity used to run the acceptance host.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
# Only for first preparation or an idempotent check while acceptance is stopped:
.\scripts\Prepare-Acceptance.ps1
.\scripts\Start-Acceptance.ps1
. .\scripts\Env.ps1 -SkipLocalConfiguration
$env:NODE_EXTRA_CA_CERTS = Join-Path $PWD '.runtime\acceptance\ca.crt'
# One-shot write workload: refuses to overwrite existing scenarios/data.
node src/minishop-web/scripts/software-acceptance.mjs
.\scripts\Test-Acceptance.ps1 -Browser
dotnet tools/MiniShop.Staging/bin/Debug/net10.0/MiniShop.Staging.dll reconcile-acceptance "$PWD"
node src/minishop-web/scripts/software-acceptance.mjs --reports
.\scripts\Test-AcceptanceRecovery.ps1
node scripts/verify-acceptance-isolation.mjs
# Stop ONLY this extra host when finished; keep other profiles running:
# .\scripts\Stop-Acceptance.ps1
```

On this already-tested workspace, reuse `--reports`, `Test-Acceptance.ps1 -Browser` and `Test-AcceptanceRecovery.ps1`; do not delete evidence or reset any database to rerun the baseline. Browser tests intentionally add fictional records. Recompute database reconciliation after any additional write workflows. To repeat the untouched baseline, plan a separate reviewed reset/restore of only the acceptance database; these scripts do not reset it automatically. Local credentials/archives/cookies must remain private and ignored.

```powershell
$env:ConnectionStrings__Migrations = (Get-Content .runtime/acceptance/migration.json -Raw | ConvertFrom-Json).Connection
dotnet ef migrations has-pending-model-changes --project src/MiniShop.Api --no-build
dotnet format MiniShop.slnx --verify-no-changes --no-restore
npm.cmd --prefix src/minishop-web run format:check
dotnet list MiniShop.slnx package --vulnerable --include-transitive --no-restore
npm.cmd --prefix src/minishop-web audit --audit-level=low
node scripts/update-progress.mjs
node scripts/update-progress.mjs --check
git diff --check
```

Advisory checks need network access to NuGet/npm feeds; no dependency versions changed. The progress increase is limited to verified cashier acceptance (+0.75 weighted points) and partial bounded reliability/restart/recovery (+1.00), yielding 83.75% unrounded overall, 61.25/65 functional points and 19.5/30 readiness points. Employee lifecycle retains needs-verification for actual shop-client/operator acceptance; hardware and operational gates were not closed.

## Individual backend cases — expected behavior and actual result

Each case name below states its expected behavior (parameterized guards include the tested input); the linked test source contains the exact numerical/status/ledger assertions. **Actual result: Passed for every row** in the final TRX; zero skipped. This inventory includes the existing regression suite rather than counting only new tests.

| Expected behavior / test case | Actual | Assertion source |
| --- | --- | --- |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "http://127.0.0.1:5843", key: "AllowedHosts", value: "127.0.0.1;localhost") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://0.0.0.0:5843", key: "AllowedHosts", value: "127.0.0.1;localhost") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "AllowedHosts", value: "*") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "Bootstrap:Enabled", value: "true") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "ConnectionStrings:Shop", value: "Host=127.0.0.1;Port=55433;Database=minishop accept"���) | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "ConnectionStrings:Shop", value: "Host=127.0.0.1;Port=55433;Database=minishop stagin"���) | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "Database:AutoMigrate", value: "true") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "DataProtection:ApplicationName", value: "MiniShop.Staging") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "Kestrel:Endpoints:Http:Url", value: "http://0.0.0.0:5000") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Acceptance rejects shared database elevated role and network exposure(urls: "https://127.0.0.1:5843", key: "Lan:Enabled", value: "true") | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| AcceptanceTests.Fictional acceptance uses a dedicated loopback profile | Passed | [AcceptanceTests](../tests/MiniShop.Tests/AcceptanceTests.cs) |
| ApiTests.Anonymous clients cannot read development progress | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Cashier cannot access admin routes or set credit limits | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Development progress is only returned to owners(owner: False, expected: Forbidden) | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Development progress is only returned to owners(owner: True, expected: OK) | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Health responds and protected routes require authentication | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Mutation without csrf token is rejected | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Product create update deactivate and validation work | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Receipt pdf is downloadable and cashier cannot read another cashiers sale | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Scanner lookup is exact and preserves cashier price privacy | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| ApiTests.Scanner rejects ambiguous barcode SKU collisions | Passed | [ApiTests](../tests/MiniShop.Tests/ApiTests.cs) |
| CommerceTests.Adjustments cannot create negative stock | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Concurrent repayments cannot exceed customer balance | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Concurrent requests cannot oversell the last item | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Credit limit and overpayment are enforced | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Discounted product report allocations reconcile exactly to sale totals(price: 0, discount: 0) | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Discounted product report allocations reconcile exactly to sale totals(price: 0.05, discount: 0.05) | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Discounted product report allocations reconcile exactly to sale totals(price: 0.05, discount: 0.15) | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Duplicate parallel checkout returns one sale and one stock deduction | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Duplicate product lines are aggregated before stock check | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Fefo uses nearest expiry and excludes expired stock | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Historical credit and stock rows cannot be overwritten in postgres | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Invalid credit checkout rolls back all stock and financial changes | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Partial repayment and refund preserve history and refund paid credit | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Reports distinguish sales profit and refunds | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Same key with changed payload is a conflict | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| CommerceTests.Weighted checkout rounds totals and change and deducts stock | Passed | [CommerceTests](../tests/MiniShop.Tests/CommerceTests.cs) |
| DevelopmentProgressTests.Invalid snapshot returns unavailable instead of invented progress(content: "not json") | Passed | [DevelopmentProgressTests](../tests/MiniShop.Tests/DevelopmentProgressTests.cs) |
| DevelopmentProgressTests.Invalid snapshot returns unavailable instead of invented progress(content: "null") | Passed | [DevelopmentProgressTests](../tests/MiniShop.Tests/DevelopmentProgressTests.cs) |
| DevelopmentProgressTests.Missing snapshot returns safe unavailable error | Passed | [DevelopmentProgressTests](../tests/MiniShop.Tests/DevelopmentProgressTests.cs) |
| LanTests.Loopback rehearsal and explicit private adapter are supported(listen: "127.0.0.1") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Loopback rehearsal and explicit private adapter are supported(listen: "192.168.1.11") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "http://127.0.0.1:5643", key: "Lan:ListenAddress", value: "127.0.0.1") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://0.0.0.0:5643", key: "Lan:ListenAddress", value: "0.0.0.0") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "AllowedHosts", value: "*") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "Bootstrap:Enabled", value: "true") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "ConnectionStrings:Shop", value: "Host=127.0.0.1;Port=55433;Database=minishop stagin"���) | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "ConnectionStrings:Shop", value: "Host=192.168.1.11;Port=55433;Database=minishop lan"���) | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "DataProtection:ApplicationName", value: "MiniShop.Staging") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Unsafe LAN configuration fails closed(urls: "https://127.0.0.1:5643", key: "Kestrel:Endpoints:Http:Url", value: "http://0.0.0.0:5000") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "::") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "0.0.0.0") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "127.0.0.1") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "2001:db8::1") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "26.1.2.3") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LanTests.Wildcard public VPN and nonprivate server addresses are rejected(ip: "8.8.8.8") | Passed | [LanTests](../tests/MiniShop.Tests/LanTests.cs) |
| LocalStagingConfigurationTests.Isolated loopback profile is accepted | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Local staging rejects plaintext or network exposure(urls: "http://localhost:5443") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Local staging rejects plaintext or network exposure(urls: "https://0.0.0.0:5443") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Local staging rejects plaintext or network exposure(urls: "https://localhost:5443;http://localhost:5080") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "Bootstrap:Enabled", value: "true") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "Bootstrap:Password", value: "forbidden-bootstrap-secret") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "ConnectionStrings:Shop", value: "Host=127.0.0.1;Port=55432;Database=minishop;Userna"���) | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "Database:AutoMigrate", value: "true") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "DataProtection:Directory", value: "") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| LocalStagingConfigurationTests.Staging rejects development targets bootstrap and endpoint overrides(name: "Kestrel:Endpoints:Http:Url", value: "http://0.0.0.0:5443") | Passed | [LocalStagingConfigurationTests](../tests/MiniShop.Tests/LocalStagingConfigurationTests.cs) |
| RulesTests.Csv protects against spreadsheet formulas(cell: "  +cmd") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Csv protects against spreadsheet formulas(cell: "-command") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Csv protects against spreadsheet formulas(cell: "@formula") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Csv protects against spreadsheet formulas(cell: "\tcell") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Csv protects against spreadsheet formulas(cell: "=SUM(A1)") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Invalid quantities are rejected(unit: "gram", quantity: "0.0001") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Invalid quantities are rejected(unit: "kilogram", quantity: "-1") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Invalid quantities are rejected(unit: "piece", quantity: "0.5") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Invalid quantities are rejected(unit: "piece", quantity: "0") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Money rounds away from zero(value: "0.004", expected: "0.00") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Money rounds away from zero(value: "1.005", expected: "1.01") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Money rounds away from zero(value: "58.625", expected: "58.63") | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Pdf writes valid xref and multiple pages for long receipts | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Philippine date window has exact UTC boundaries | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Thermal PDF uses fixed width glyphs and wraps inside the paper(paper: 58, points: 164, characters: 30) | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| RulesTests.Thermal PDF uses fixed width glyphs and wraps inside the paper(paper: 80, points: 227, characters: 42) | Passed | [RulesTests](../tests/MiniShop.Tests/RulesTests.cs) |
| SecurityTests.Cookies headers CORS and forged csrf are secure | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Employee deactivation reactivation password reset and logout revoke sessions | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Five failed password attempts lock out a fictional employee | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Login is rate limited after fifteen requests | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "ALTER TABLE \"Products\" ADD COLUMN forbidden inte"���) | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "CREATE DATABASE minishop forbidden") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "CREATE TABLE public.forbidden (id integer)") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "CREATE TEMP TABLE forbidden (id integer)") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "DELETE FROM \"  EFMigrationsHistory\" WHERE false") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "DELETE FROM \"Sales\" WHERE false") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "TRUNCATE \"AuditLogs\"") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "UPDATE \"Payments\" SET \"Amount\" = 0 WHERE false") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime cannot administer schema or rewrite financial history(sql: "UPDATE \"Sales\" SET \"Total\" = 0 WHERE false") | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |
| SecurityTests.Runtime role passes and cluster administrator is rejected | Passed | [SecurityTests](../tests/MiniShop.Tests/SecurityTests.cs) |

## Individual frontend cases — expected behavior and actual result

Evidence: final Vitest JSON; exact assertions in the linked source. Each row's name states its expected behavior.

| Expected behavior | Actual | Assertion source |
| --- | --- | --- |
| LAN connection feedback uses the page origin for every API call | Passed | [src/api.test.ts](../src/minishop-web/src/api.test.ts) |
| LAN connection feedback explains unreachable local server and safe retry for ERR_NETWORK | Passed | [src/api.test.ts](../src/minishop-web/src/api.test.ts) |
| LAN connection feedback explains unreachable local server and safe retry for ECONNABORTED | Passed | [src/api.test.ts](../src/minishop-web/src/api.test.ts) |
| cashier totals uses decimal arithmetic and rounds each weighted line like the backend | Passed | [src/format.test.ts](../src/minishop-web/src/format.test.ts) |
| cashier totals calculates partial cash and outstanding credit after discounts | Passed | [src/format.test.ts](../src/minishop-web/src/format.test.ts) |
| cashier totals avoids binary floating point errors across many small items | Passed | [src/format.test.ts](../src/minishop-web/src/format.test.ts) |
| accessible forms and empty states blocks a missing required value and shows a useful error | Passed | [src/ui.test.tsx](../src/minishop-web/src/ui.test.tsx) |
| accessible forms and empty states submits valid values and labels inputs | Passed | [src/ui.test.tsx](../src/minishop-web/src/ui.test.tsx) |
| accessible forms and empty states explains an empty page without fabricated data | Passed | [src/ui.test.tsx](../src/minishop-web/src/ui.test.tsx) |
| evidence-based progress calculation weights task points and milestone weights, with independent normalized tracks | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation gives no completion credit to blocked or unstarted work | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation requires every task to be verified for a complete milestone | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation validates the actual audit and its transparent arithmetic | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects weights that do not sum to 100 | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects completion with no evidence or unknown evidence | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects duplicate tasks and unfinished work without acceptance steps | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects contradictory test results and unknown priority dependencies | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects missing progress data without assuming zero completion: null | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects missing progress data without assuming zero completion: {} | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| evidence-based progress calculation rejects missing progress data without assuming zero completion: {"milestones":[]} | Passed | [src/development-progress/model.test.ts](../src/minishop-web/src/development-progress/model.test.ts) |
| reviewed development progress dashboard shows separate scores, pending work and release gates | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard includes inspectable feature classifications, evidence and acceptance steps | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard handles unavailable or invalid data honestly: undefined | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard handles unavailable or invalid data honestly: null | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard handles unavailable or invalid data honestly: {} | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard handles unavailable or invalid data honestly: {"milestones":[]} | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| reviewed development progress dashboard offers a retry without changing task statuses | Passed | [src/pages/DevelopmentProgress.test.tsx](../src/minishop-web/src/pages/DevelopmentProgress.test.tsx) |
| keyboard-compatible barcode input queues repeated scans, retains leading zeros and increments one cart line | Passed | [src/pages/Pos.test.tsx](../src/minishop-web/src/pages/Pos.test.tsx) |
| keyboard-compatible barcode input never adds the sole fuzzy search result for an unknown code | Passed | [src/pages/Pos.test.tsx](../src/minishop-web/src/pages/Pos.test.tsx) |
| keyboard-compatible barcode input keeps the next typed code when a slow lookup finishes and blocks checkout until scans resolve | Passed | [src/pages/Pos.test.tsx](../src/minishop-web/src/pages/Pos.test.tsx) |
| keyboard-compatible barcode input enforces available stock across duplicate scans | Passed | [src/pages/Pos.test.tsx](../src/minishop-web/src/pages/Pos.test.tsx) |
| keyboard-compatible barcode input supports empty-input feedback and an explicit focus recovery button | Passed | [src/pages/Pos.test.tsx](../src/minishop-web/src/pages/Pos.test.tsx) |

## Individual browser workflows — expected behavior and actual result

Evidence: final Playwright JSON. All run against the built same-origin HTTPS acceptance host; fresh contexts and actual UI interactions are used. Native browser certificate-store acceptance remains separate because transport uses the private CA through the documented strict Node fixture.

| Expected workflow | Actual | Assertion source |
| --- | --- | --- |
| owner can inspect reviewed progress, evidence and a responsive mobile dashboard | Passed | [development-progress.spec.ts](../src/minishop-web/e2e/development-progress.spec.ts) |
| an unavailable progress snapshot renders an honest recoverable state | Passed | [development-progress.spec.ts](../src/minishop-web/e2e/development-progress.spec.ts) |
| cashiers cannot navigate to progress or retrieve its private API data | Passed | [development-progress.spec.ts](../src/minishop-web/e2e/development-progress.spec.ts) |
| keyboard scanner bursts use fresh exact lookups, retain duplicates and recover focus | Passed | [shop-devices.spec.ts](../src/minishop-web/e2e/shop-devices.spec.ts) |
| 58 and 80 mm previews align, print without app chrome and provide width-matched PDFs | Passed | [shop-devices.spec.ts](../src/minishop-web/e2e/shop-devices.spec.ts) |
| fresh browser works with external origins blocked while the local server stays reachable | Passed | [shop-devices.spec.ts](../src/minishop-web/e2e/shop-devices.spec.ts) |
| local server interruption preserves a pending request for safe retry after reconnection | Passed | [shop-devices.spec.ts](../src/minishop-web/e2e/shop-devices.spec.ts) |
| owner can receive stock, complete a weighted credit sale, repay it, and print a receipt | Passed | [shop.spec.ts](../src/minishop-web/e2e/shop.spec.ts) |
| a committed checkout with a lost response survives reload and retries without a second sale | Passed | [shop.spec.ts](../src/minishop-web/e2e/shop.spec.ts) |
| owner reports, inventory, employees, settings and logout work in the built app | Passed | [shop.spec.ts](../src/minishop-web/e2e/shop.spec.ts) |
| full catalog weighted checkout finds products beyond the first page | Passed | [software-acceptance.spec.ts](../src/minishop-web/e2e/software-acceptance.spec.ts) |
| cashier browser completes a sale while every owner workspace stays restricted | Passed | [software-acceptance.spec.ts](../src/minishop-web/e2e/software-acceptance.spec.ts) |
| employee password reset and deactivation revoke an existing browser session | Passed | [software-acceptance.spec.ts](../src/minishop-web/e2e/software-acceptance.spec.ts) |
| HTTPS staging preserves secure sessions, refunds, stock and utang ledgers | Passed | [staging-security.spec.ts](../src/minishop-web/e2e/staging-security.spec.ts) |

## Independent database invariant inventory

Expected result for each row: true for every applicable record, including failed-request rollback, completed/refunded sales and repayment allocations. Actual result: passed for every row. Evidence: [AcceptanceReconciliation.cs](../tools/MiniShop.Staging/AcceptanceReconciliation.cs) and private final reconciliation JSON.

| Expected invariant | Actual |
| --- | --- |
| Every batch equals its complete stock movement ledger; no negative stock | Passed |
| Every sale subtotal, discount, tender split and cost reconciles | Passed |
| Every line allocation, price and batch cost reconciles | Passed |
| Every sale and refund matches its cash ledger | Passed |
| Every repayment equals its debt allocations | Passed |
| Every completed/refunded sale debt reconciles | Passed |
| Every household balance is nonnegative and within its limit | Passed |
| Net completed revenue equals net cash ledger plus outstanding utang | Passed |
