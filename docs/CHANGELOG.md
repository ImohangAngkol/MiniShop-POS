# Implementation history

## 2026-10-17 - initial local release candidate

- Milestone 1: inspected an empty authorized workspace and tools; established .NET 10 solution, project-local caches, Vite/React stack, isolated PostgreSQL 18 cluster, EF migrations, health endpoint and setup scripts.
- Milestone 2: implemented category/product management, piece/gram/kg validation, batch receiving, expiry-first availability, signed owner adjustments and immutable stock movement history.
- Milestone 3: implemented decimal cashier previews/server totals, transactional checkout and request deduplication, sale/cost/batch snapshots, cash/credit/change, full owner refunds, downloadable PDF and 58/80 mm browser receipts.
- Milestone 4: added ASP.NET Identity cookies/roles, CSRF validation, lockout/rate limiting, employee management and session revocation, customers/limits, append-only credit and oldest-sale repayment allocation, audited sensitive operations and immutable database triggers.
- Milestone 5: connected dashboard and reports to actual API/database aggregates; added date-range sales/gross profit/product analytics, inventory valuation/expiry and CSV exports.
- Milestone 6: added real PostgreSQL concurrency/idempotency/rollback/ledger tests, HTTP authorization/CSRF tests, Vitest/RTL checks, Playwright workflows, and PDF parsing/rendering. Tests exposed and fixed MVC antiforgery service registration, alphanumeric barcode search and logout session-cache behavior.
- Milestone 7: added single-origin build/publish/start/stop, pg_dump backup/checksum and separate restore drill, operator/user/C# documentation and staged localhost/LAN/cloud design. No firewall rule, system service, cloud deployment or direct printer integration was applied.

Known scope limits and acceptance work are listed in PROJECT_OVERVIEW and TESTING_REPORT. Successful builds/tests do not constitute commercial, tax, security or hardware certification.
