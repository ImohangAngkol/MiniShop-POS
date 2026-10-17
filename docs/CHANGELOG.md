# Implementation history

## 2026-10-17 - reviewed development progress tracking

- Audited 45 acceptance tasks across the nine requested weighted categories. Functional development and production readiness are calculated separately; external release gates remain explicit.
- Added an Owner-only progress API/page with responsive animated bars, evidence disclosures, test snapshots, blockers and a prioritized roadmap. The JSON snapshot is packaged outside public static assets; missing data produces an unavailable state.
- Added a shared validated TypeScript calculator and deterministic Node generator for root PROGRESS.md, the development roadmap and docs navigation. Existing checklist notes are preserved as IMPLEMENTATION_HISTORY. Build/test scripts check generated reports without changing statuses.
- Executed 38 backend, 24 frontend and 6 browser tests successfully, including all existing regressions and progress access/missing-data/arithmetic/rendering checks. No new dependency or database migration was required. No GitHub push was performed.

## 2026-10-17 - initial local release candidate

- Milestone 1: inspected an empty authorized workspace and tools; established .NET 10 solution, project-local caches, Vite/React stack, isolated PostgreSQL 18 cluster, EF migrations, health endpoint and setup scripts.
- Milestone 2: implemented category/product management, piece/gram/kg validation, batch receiving, expiry-first availability, signed owner adjustments and immutable stock movement history.
- Milestone 3: implemented decimal cashier previews/server totals, transactional checkout and request deduplication, sale/cost/batch snapshots, cash/credit/change, full owner refunds, downloadable PDF and 58/80 mm browser receipts.
- Milestone 4: added ASP.NET Identity cookies/roles, CSRF validation, lockout/rate limiting, employee management and session revocation, customers/limits, append-only credit and oldest-sale repayment allocation, audited sensitive operations and immutable database triggers.
- Milestone 5: connected dashboard and reports to actual API/database aggregates; added date-range sales/gross profit/product analytics, inventory valuation/expiry and CSV exports.
- Milestone 6: added real PostgreSQL concurrency/idempotency/rollback/ledger tests, HTTP authorization/CSRF tests, Vitest/RTL checks, Playwright workflows, and PDF parsing/rendering. Tests exposed and fixed MVC antiforgery service registration, alphanumeric barcode search and logout session-cache behavior.
- Milestone 7: added single-origin build/publish/start/stop, pg_dump backup/checksum and separate restore drill, operator/user/C# documentation and staged localhost/LAN/cloud design. No firewall rule, system service, cloud deployment or direct printer integration was applied.

Known scope limits and acceptance work are listed in PROJECT_OVERVIEW and TESTING_REPORT. Successful builds/tests do not constitute commercial, tax, security or hardware certification.
