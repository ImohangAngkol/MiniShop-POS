# Development progress change: verification evidence

Current milestone evidence: [SOFTWARE_ACCEPTANCE_REPORT](SOFTWARE_ACCEPTANCE_REPORT.md). Verified totals are **96 backend, 32 frontend, 14 browser and 17 fictional-shop acceptance scenarios**, all passing. The JSON records **83.8% overall, 94.2% functional and 65.0% readiness**: cashier permission acceptance is verified; bounded workload/controlled restart/recovery earns partial reliability credit. Long-duration soak, abrupt power loss, browser matrix and all six operational/device release gates remain open. Earlier milestone numbers below are historical. Run `node scripts/update-progress.mjs` and `node scripts/update-progress.mjs --check`; progress unit/browser assertions use the same reviewed arithmetic.

Reviewed on 2026-10-17 (Asia/Manila), against clean baseline commit `afe3b92` plus local progress-tracking changes. All changes are local; no commit or GitHub push was performed.

## Audit and scope

Reviewed the existing React pages/forms/API/query/session logic; API controllers, services, DTOs and Identity configuration; PostgreSQL model, migrations and append-only constraints; inventory/POS/credit/receipt/report behavior; test fixtures and cases; Windows build/start/backup/restore scripts; and the existing architecture/setup/user/testing/deployment documentation. The 45 acceptance tasks in the JSON/report record the resulting classifications and source/evidence references. The original all-checked implementation log is preserved in IMPLEMENTATION_HISTORY; it did not prove production acceptance.

The baseline regression run executed **32 backend tests and 6 frontend tests successfully** before this feature was added. Existing receipt, restore and advisory-audit claims retain their dated prior evidence; they were not invented from source existence or relabeled as newly executed hardware/security checks.

## Executed results after implementation

| Verification | Result |
| --- | --- |
| Backend build | Succeeded, zero warnings/errors |
| Frontend strict TypeScript/Vite build | Succeeded |
| Backend xUnit + real PostgreSQL suite | **38 passed, 0 failed, 0 skipped** |
| Frontend Vitest/RTL suite | **24 passed, 0 failed** |
| Playwright Chromium, existing and new workflows | **6 passed** |
| Progress generation/check | Generates matching root PROGRESS.md, roadmap and docs navigation; `--check` passes |
| Source diff whitespace | `git diff --check` passed |
| Release packaging | Publish succeeded; reviewed JSON is under private `Progress/`, absent from `wwwroot` and its values are absent from public JS bundles. The three progress browser checks also passed against the published Release DLL. |

Backend results are recorded in ignored `.runtime/test-results/development-progress.trx`; the baseline run is `progress-audit-baseline.trx`. Browser screenshots are `.runtime/development-progress-desktop.png`, `.runtime/development-progress-mobile.png` and `.runtime/development-progress-mobile-viewport.png`. These files may contain development records and are intentionally not committed.

## What the new checks establish

- A deliberately mixed fixture (including nonuniform task points) yields 53.75% overall, 62.5% functional, 75% readiness and 0% preparation. It checks normalization and a single final display rounding, independently of the project's own score.
- The actual audited manifest yields **81.5% overall**, **93.1% functional development**, **60% production readiness**, **60% cloud preparation**, two complete milestones, 28 verified tasks, 17 pending tasks, four external blockers and six open release gates.
- Invalid total weights, missing/unknown evidence, duplicate task ids, missing remaining acceptance, contradictory test results, unknown dependencies and absent data are rejected. A partly verified milestone cannot become Complete.
- React renders distinct scores, all status classifications, native expandable detail/evidence controls, release gates and a dated test summary. Missing/invalid data shows an honest unavailable state with no fabricated 0% bar; retry is functional.
- Real authenticated API tests return 200 to Owner, 403 to Cashier and 401 to anonymous clients. Cashier responses contain no milestone payload. Missing files and invalid JSON/null roots return safe 503 errors without private paths.
- Browser checks use the real app/API for owner access and evidence disclosures, no page-level overflow at 390 px, reduced-motion rendering, a simulated 503 followed by recovery, and a newly created fictional cashier denied both the direct page and API. Attempting the private snapshot path under `/Progress` does not return its JSON.
- All three pre-existing shop workflows still pass: receiving and weighted utang/repayment/receipts, committed-response-loss idempotent recovery, and report/admin navigation plus logout.

An initial browser attempt was interrupted when it was found to be using the old published instance on port 5080. That prior session was stopped and the updated app was started before the successful six-workflow run. The interrupted attempt is not counted as passing.

## Files created or modified

Created:

- `progress/development-progress.json`
- `scripts/update-progress.mjs`
- `PROGRESS.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/PROGRESS_MAINTENANCE.md`
- `docs/DEVELOPMENT_PROGRESS_TESTING.md`
- `docs/IMPLEMENTATION_HISTORY.md`
- `src/MiniShop.Api/Controllers/DevelopmentProgressController.cs`
- `src/MiniShop.Api/Services/DevelopmentProgressReader.cs`
- `src/minishop-web/src/development-progress/model.ts`
- `src/minishop-web/src/development-progress/model.test.ts`
- `src/minishop-web/src/development-progress/progress.css`
- `src/minishop-web/src/pages/DevelopmentProgress.tsx`
- `src/minishop-web/src/pages/DevelopmentProgress.test.tsx`
- `src/minishop-web/e2e/development-progress.spec.ts`
- `tests/MiniShop.Tests/DevelopmentProgressTests.cs`

Modified:

- `README.md`
- `docs/API_DOCUMENTATION.md`
- `docs/CHANGELOG.md`
- `docs/PROGRESS.md`
- `docs/TESTING_REPORT.md`
- `scripts/Build.ps1`
- `scripts/Test.ps1`
- `src/MiniShop.Api/MiniShop.Api.csproj`
- `src/MiniShop.Api/Program.cs`
- `src/minishop-web/package.json`
- `src/minishop-web/src/App.tsx`
- `tests/MiniShop.Tests/ApiTests.cs`

No existing inventory/POS/credit/receipt/report service or database migration was changed. `.gitignore` and the active `api.ts`/`CurrentEmployee.cs` files were preserved. Local browser evidence, build output and temporary guard checks remain ignored under `.runtime`/test-results.

## Remaining acceptance limits

No device/LAN/production/commercial blocker was resolved by adding this dashboard. Physical printers/scanners, trusted shop LAN/WAN-loss acceptance, least-privilege production deployment, managed startup/off-site recovery, long-duration and multi-browser testing, independent security and commercial invoicing/privacy review remain as recorded. Counts in the dashboard are manually reviewed run snapshots; refresh/generation never executes tests or completes tasks automatically.

See [PROGRESS_MAINTENANCE](PROGRESS_MAINTENANCE.md) for reproduction and review rules. The optional API file-path override is server configuration only. No progress-edit API, database migration, new dependency, external network integration, or GitHub publishing action was added.
