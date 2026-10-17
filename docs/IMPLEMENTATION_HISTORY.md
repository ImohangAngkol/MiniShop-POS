# Historical implementation checklist

This is the preserved implementation-session record. The current weighted assessment is [PROGRESS.md](../PROGRESS.md); checked implementation milestones below do not mean hardware, LAN, commercial or production acceptance was complete.

- [x] Inspect workspace and installed tools (empty workspace; .NET 10.0.401, Node 24.11.1, npm 11.6.2, PostgreSQL 18.6, Git 2.52)
- [x] Milestone 1: foundation, database, migrations, health, setup
- [x] Milestone 2: products, categories, batches, receiving, adjustments, history
- [x] Milestone 3: cashier, atomic checkout, idempotency, receipts, controlled refunds
- [x] Milestone 4: Identity, roles, customers, append-only credit and repayments, audit
- [x] Milestone 5: dashboard, reports, CSV exports
- [x] Milestone 6: available backend, frontend, integration, concurrency, browser and dependency/security checks; remaining hardware/operational checks recorded
- [x] Milestone 7: local build/publish/startup, LAN instructions, tested backup/restore, cloud design and all requested guides

## Environment findings

The authorized workspace is `C:\Users\User\Desktop\Mini Shop POS`; the differently named path in the brief does not exist. No existing source or AGENTS.md was found. PostgreSQL tools are installed in `C:\Program Files\PostgreSQL\18\bin` but are absent from PATH. An existing PostgreSQL service listens on 5432. Use a separate local development cluster on 55432 for verification. PowerShell execution policy blocks npm.ps1; use npm.cmd. Python's WindowsApps alias is unusable; Docker and uv are absent. No system-wide software installation is planned. Initial sandbox dependency fetches were denied; restore will use explicit access review and project-local caches.

## Milestone evidence

1. .NET and React build; PostgreSQL migrations apply; `/api/health` returns healthy.
2. Real database tests and browser delivery workflow cover product changes and stock receiving; stock constraints and FEFO are tested.
3. Parallel checkout, duplicate keys, rollback, weighted totals, PDFs and browser thermal output verified. Browser response-loss recovery test added.
4. Role and CSRF API tests pass; browser credit sale and partial repayment pass. Append-only database triggers installed.
5. Dashboard and report screens use API data; CSV exports protect text fields from spreadsheet formula injection.
6. Final result: 32 backend, 6 frontend and 3 browser workflows pass. Browser tests identified alphanumeric barcode search and logout cache issues; both fixed and verified. A real committed-response-loss/reload/retry test confirms one sale and stock deduction. NuGet/npm audits report no known vulnerable packages. PDF parsed/rendered and print screenshot inspected.
7. Release published app serves HTML and healthy API; EF reports no pending model changes. Final backup restored 11 products, 6 sales, 8 credit rows, 17 stock movements and 2 migrations into a separate temporary database. All 12 requested guides, README and operational scripts are complete. No physical/LAN/cloud or commercial-compliance readiness claim is made; see TESTING_REPORT.
