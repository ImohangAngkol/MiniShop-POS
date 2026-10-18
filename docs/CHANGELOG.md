# Implementation history

## 2026-10-18 - full software acceptance and reliability verification

- Added an isolated loopback HTTPS acceptance environment with 300 fictional products, 24 baseline households, an owner and two cashiers; existing development, staging and LAN data remain separate.
- Verified 120 concurrent cashier baskets, scarce-stock and credit-limit races, duplicate requests, lost responses, repayments/refunds, owner-only permissions, browser session revocation, CSV/PDF receipts and independent financial/inventory reconciliation.
- Fixed discounted product report allocations losing or creating cents; stable integer-cent allocation and refund reversal now have regression coverage.
- Recorded 96 backend, 32 frontend, 14 Chromium and 17 fictional-shop acceptance scenarios passing; verified all 36 restored table/sequence states, controlled restart/session persistence, build/publish, formatting, migration consistency and dependency checks.
- Updated progress to 83.8% overall, 94.2% functional and 65.0% readiness. Six device/operational release gates remain open; long-duration soak, power-loss and supported-browser-matrix acceptance remain outstanding. No physical hardware or production approval is claimed.

## 2026-10-18 - LAN and hardware acceptance preparation

- Prepared a separate fictional LAN profile with configurable minishop.local identity, private CA/SAN validation, separate roles/session keys/publish and default loopback-only 5643 listener. No device trust, firewall, router or public network changes were made.
- Replaced scanner submission from cached fuzzy results with queued exact lookups; added unknown/ambiguous/duplicate/stock/focus/latency coverage. Added 58/80 mm previews, matching PDF widths, fixed-width PDF wrapping, print alignment and mobile POS overflow fixes.
- Added simulated WAN dependency loss and local-server interruption/retry workflows. Browser HTTPS automation now uses TLS-verifying Node transport rather than a certificate-exception flag.
- Recorded 82 backend, 32 frontend and 11 browser workflows, with physical scanner/printer/native-device trust and actual LAN/WAN acceptance pending. Overall 82.0%, functional 93.1% and readiness 61.7% remain unchanged; no hardware gate is closed by simulated tests.

## 2026-10-18 - isolated secure local staging

- Added separate fictional PostgreSQL staging on loopback 55433 and HTTPS on localhost 5443, with a generated untrusted certificate, private NTFS configuration and separate DPAPI/session-cookie scope. No trust installation, firewall rule, machine setting, commit or push was performed.
- Separated migration/bootstrap from non-development web startup. Runtime grants permit necessary commerce/Identity operations while rejecting schema administration, migration writes and financial-history changes. Existing development hosting remains available.
- Verified 62 backend, 24 frontend and 7 HTTPS browser workflows, strict TLS/security checks, PDF output, migration consistency, dependency advisories and a reconciled temporary-database restore of all 36 table/sequence states.
- Added role, HTTPS, staging and release-gate documentation. Regenerated progress to 82.0% overall and 61.7% readiness; six release gates remain open, including trusted devices/LAN, service identity, actual hardware and human recovery/security/invoicing acceptance.

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
