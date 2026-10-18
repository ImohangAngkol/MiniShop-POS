# Executed verification report

The latest [full software acceptance report](SOFTWARE_ACCEPTANCE_REPORT.md) supersedes milestone totals below: **96 backend, 32 frontend, 14 browser and 17 acceptance scenarios passed**, with independent stock/financial/report reconciliation, controlled restart and isolated restore. Current scores are **83.8% overall, 94.2% functional and 65.0% readiness**; six release gates remain open. Historical [LAN](LAN_VERIFICATION.md)/staging evidence below remains valid within its recorded scope. Native device trust and physical acceptance remain pending in [SHOP_DEVICE_ACCEPTANCE](SHOP_DEVICE_ACCEPTANCE.md).

For the current secure-staging milestone, see [STAGING_VERIFICATION](STAGING_VERIFICATION.md): **62 backend, 24 frontend and 7 HTTPS browser tests** passed, with an isolated restricted-role database, DPAPI session keys, strict certificate validation and exact backup/restore reconciliation. The older reports below retain their historical scope and counts.

For the subsequent development-progress feature, see [the newer verification report](DEVELOPMENT_PROGRESS_TESTING.md): 38 backend, 24 frontend and 6 browser tests passed. The original implementation-session evidence below is preserved with its original counts and scope.

Verified on **2026-10-17, Asia/Manila**. This report describes commands actually executed and bounded results, not a production-readiness certification.

## Environment

Windows; PowerShell 5.1; .NET SDK 10.0.401/MSBuild 18.9; ASP.NET/.NET runtime 10.0.12; Node 24.11.1; npm 11.6.2; Git 2.52.0; PostgreSQL 18.6. The existing PostgreSQL service on 5432 was not used for shop verification. A SCRAM-authenticated development cluster was initialized under `.runtime/postgres`, listening only on 127.0.0.1:55432. Generated credentials, keys, caches, browsers, logs and database/backup files are ignored by Git.

Initial sandbox access denied package downloads and user-level NuGet configuration. Project-local caches and reviewed package-fetch commands resolved dependency restoration. The PowerShell npm wrapper was blocked by execution policy, so npm.cmd and process-only script policy were used. Python/Poppler were unavailable; PDF.js with a local canvas renderer provided PDF parsing and actual PNG rendering. No machine-wide software, firewall rule or persistent app service was installed.

## Results

| Check | Executed result |
| --- | --- |
| .NET build | Succeeded, zero warnings/errors |
| Strict TypeScript + Vite build | Succeeded; route splitting keeps individual generated JS chunks below the original bundle warning threshold |
| Release publish | `dotnet publish ... -c Release --no-restore -o .runtime/publish` succeeded |
| Published app | Started the Release DLL with explicit published content root; HTML 200 and health healthy; browser suite ran against this published build in Development environment |
| EF migrations | InitialShop and FinancialLinks applied to development DB; tests also apply both to new separate databases |
| EF model snapshot | `has-pending-model-changes` reported no changes since last migration |
| Backend xUnit | **32 passed, 0 failed, 0 skipped**: 14 rules/PDF/CSV/date cases and 18 real PostgreSQL/HTTP cases |
| Frontend Vitest/RTL | **6 passed, 0 failed** across two files |
| Playwright Chromium | **3 passed** against the final published application |
| Health endpoint | `/api/health` → 200, `status=healthy`, `database=PostgreSQL` |
| Security headers | CSP present on the served root; HTTP role/CSRF behavior checked by integration tests |
| Downloaded PDF | Parsed successfully, expected content verified, 1 page at 227 × 270 points; rendered to PNG with PDF.js standard fonts and visually inspected |
| Thermal browser print | 80 mm layout rendered under print media; screenshot and browser-generated PDF inspected; application chrome hidden |
| Backup and restore | Custom pg_dump archive + SHA-256 created, restored with `--exit-on-error` into a separate temporary database, schema/count query succeeded, temporary database removed |
| npm vulnerability audit | 0 reported vulnerabilities in the installed dependency graph |
| NuGet transitive audit | No vulnerable packages reported for API or tests by the configured current source |
| Frontend formatting | Prettier check passed for source, tests and configs |

The final restore drill archive was `.runtime/backups/minishop-20261017-224301.dump`. It restored **11 products, 6 sales, 8 credit entries, 17 stock movements and 2 migrations**. These were fictional demonstration/E2E data. The drill verifies recoverable archive/schema/data loading; it is not a full operational failover or an independent reconciliation of real business records.

## Backend behaviors verified

- Weighted quantities and per-line decimal rounding, with PHP 65.96 total and PHP 34.04 change for a 1.125 × PHP 58.63 cash transaction tendered PHP 100.
- Three simultaneous identical checkout requests produce one sale and one stock deduction.
- Eight simultaneous independent attempts to buy the last piece produce exactly one successful sale and zero remaining stock.
- Same key/different payload conflicts; duplicate product lines are aggregated before availability checks.
- Invalid credit checkout rolls back sale, stock, stock movements and financial effects.
- Earliest-expiry stock is consumed first; expired batches are excluded, and batch cost snapshots match allocation cost.
- Partial cash/utang, credit limits, overpayment rejection, duplicate repayments, simultaneous repayments without over-collection, and full refund after partial repayment preserve history and the correct cash/credit split.
- Nonnegative stock enforcement and SQL attempts to rewrite/delete protected historical credit/stock rows are rejected.
- Sales/profit reports account for owner discounts and compensating refunds; applied discount rows are retained.
- Health and anonymous access; owner product create/update/deactivate/invalid-price validation; case-insensitive alphanumeric barcode lookup.
- Cashier requests to employee/inventory/report/audit routes and attempts to set a credit limit return 403. A cashier cannot view another cashier's sale.
- Missing CSRF token is rejected; authenticated PDF download returns a real PDF. PDF xref offsets, escaping and multiple-page output for long receipts are checked.
- Philippine UTC date boundaries and CSV formula-injection protection are checked.

## Browser behaviors verified

1. Owner login → category/product create → stock receiving → customer create → barcode search → 1.125 kg sale with PHP 20 cash and PHP 45.96 credit → receipt/PDF download/print → PHP 15 repayment → PHP 30.96 remaining balance. Desktop/POS/receipt/mobile screenshots captured; 390 px dashboard had no page-level horizontal overflow. No JavaScript page error occurred in this workflow.
2. A route interceptor lets checkout commit at the backend, then deliberately aborts its response. The UI keeps its saved request, survives a reload, retries to the original sale id, and shows stock reduced only once with one sale movement. This tests an actual uncertain result, not a mocked successful checkout response.
3. Owner navigates inventory/reports/employees/settings/sales, then logs out. The login screen returns and a subsequent product API request returns 401.

Earlier failed runs were investigated, fixed and rerun. These included test DOM cleanup, a locked running Windows apphost, a missing MVC antiforgery filter service, an exact customer-label selector, uppercase barcode search, and logout cache-observer behavior. A PowerShell dictionary-adapter/SQL-quoting problem in backup verification was fixed before the successful restore drill. No failed run was counted as passing.

## Evidence and reproduction

Source: `tests/MiniShop.Tests`, `src/minishop-web/src/*.test.*`, `src/minishop-web/e2e/shop.spec.ts`. Local evidence: `.runtime/test-results/backend.trx`, `.runtime/dashboard-desktop.png`, `.runtime/dashboard-mobile.png`, `.runtime/pos-desktop.png`, `.runtime/thermal-receipt.png`, `.runtime/verified-sales-slip.pdf`, `.runtime/generated-pdf-render.png`, and `.runtime/thermal-browser-print.pdf`. Runtime artifacts are intentionally not source-controlled.

Run `scripts/Test.ps1` for backend/frontend tests. PostgreSQL integration tests create a uniquely named test database using TEST_DB_CONNECTION or ConnectionStrings__Shop and drop only that database on cleanup; CREATEDB is required. For independent non-database checks, use `dotnet test --filter FullyQualifiedName~RulesTests` after loading Env.ps1. For browser testing, start the built app separately, set E2E_EMAIL/E2E_PASSWORD for a development account, and run the web project's `test:e2e` script. Browser tests intentionally leave labeled fictional records in that selected development instance. They do not reset an arbitrary shop database.

## Limits and remaining acceptance

No physical thermal printer/scanner, cash drawer, real phone/LAN HTTPS certificate, Wi-Fi outage, router configuration, system-service restart, power-cut, prolonged soak/load, real customer dataset, or cloud deployment was available for verification. Physical printing at both widths, device-specific scanning, real LAN/WAN-loss operation and recovery, least-privilege production roles, OS/file permissions, HTTPS certificates, and retention/restore operations need operator acceptance. Browser keyboard entry/print rendering and database transaction concurrency were tested, which does not replace that hardware/environment acceptance.

Dependency audits found no known advisories in the queried graph at this time. This is not a penetration test or a guarantee of no vulnerabilities. Source review covers parameterized queries, server prices, roles, CSRF, non-default passwords, immutable ledgers, cookie handling, idempotency, negative-stock constraints, safe error responses and CSV protection. Apply future dependency updates and independent security review before exposing the service beyond localhost.

Commercial invoicing/BIR compliance was not assessed. Documents remain internal sales slips. Partial refunds, expense/net-profit accounting, direct printer integration and cloud synchronization are not implemented. See PROJECT_OVERVIEW for the complete feature boundaries.
