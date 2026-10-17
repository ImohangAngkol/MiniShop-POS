# Maintaining development progress

`progress/development-progress.json` is the reviewed source of truth. It is **private application content**, copied into the API's `Progress/` output/publish directory, outside `wwwroot`. Only Owner can retrieve `/api/admin/development-progress`. The frontend does not import the JSON into its public application bundle; test files import it only as a fixture. No database migration or shop record is needed for progress tracking.

## Scoring contract

The dashboard and Node documentation generator import exactly the same TypeScript calculator/schema at `src/minishop-web/src/development-progress/model.ts`. Node 24 runs its erasable TypeScript directly; it does not need a new tool dependency.

Each milestone has a reviewed category weight, track and acceptance tasks. Category weights must sum to 100. Tasks have one point by default; an explicitly reviewed `points` value can assign more acceptance weight. Task status credits are centralized in the shared module:

| Classification | Display status | Earned task credit |
| --- | --- | ---: |
| Complete and verified | Complete | 100% |
| Implemented but not fully tested | Needs verification | 75% |
| Partially implemented | In progress | 50% |
| Not implemented | Not started | 0% |
| Blocked by external requirements | Blocked | 0% |

Milestone completion = sum(task points × status credit) / total task points. Overall completion = sum(milestone completion × category weight). The functional, production-readiness and cloud-preparation scores normalize only their own category weights. A milestone is Complete only when **every** acceptance task is verified. Intermediate values remain unrounded; display/report values round once to one decimal place.

These numbers express an explicit assessment rubric, not measured remaining engineering hours, statistical confidence, test coverage percentages or a probability of safety. Changing the scope or weights changes the denominator; explain such changes in the evidence register/changelog. Later optional features listed in `futureScope` do not silently reduce the initial-release score. Cloud preparation accepts reviewed design artifacts as design work, and does not claim working synchronization.

`releaseGate: true` identifies required production acceptance. Every unverified gate stays open, regardless of the aggregate percentage. External blockers retain zero credit even when a workaround or installation guide is written.

## After each milestone

1. Inspect the actual change and compare it with the task's stated acceptance scope. A file, route, passing build, commit, or successful command alone cannot prove feature completion.
2. Run meaningful tests or perform the specified acceptance check. Record the date, command/scenario, result, limitations and reviewable source/report paths. Keep raw logs, credentials, real customer data and private absolute paths out of the tracked JSON.
3. Update the evidence register and `testRuns` manually from the actual results. A test run entry is a historical snapshot, not a live CI indicator. An unchanged earlier result must keep its earlier date; do not reset verification dates just because the generator ran.
4. Review task status, remaining acceptance, dependencies and release gates. A `verified` task must reference evidence. Evidence must support that specific acceptance claim: basic API access does not prove complete employee lifecycle behavior, and browser print rendering does not prove a physical printer.
5. Update `updatedAt`, phase and baseline revision after review. If source changed since a verification, reassess affected statuses instead of assuming old evidence still applies.
6. Regenerate and check the reports from the repository root:

   ```powershell
   node scripts/update-progress.mjs
   node scripts/update-progress.mjs --check
   ```

   Equivalent web-project commands are `npm.cmd --prefix src/minishop-web run progress:generate` and `run progress:check`.

7. Run the normal tests/build. Build.ps1 and Test.ps1 first check that the reviewed JSON is valid and its generated reports are current. They **never** change a status or mark tasks complete. Rebuild/redeploy the API to copy the latest private snapshot; refreshing the browser only refetches that deployed snapshot.
8. Review the Git diff locally. Do not push or publish automatically. Obtain the user's requested approval before any GitHub push.

## Generated files

- Root `PROGRESS.md`: scores, calculation, milestones, complete/unfinished features, tests, blockers, issues, priorities and evidence.
- `docs/DEVELOPMENT_ROADMAP.md`: prioritized remaining work, dependencies and acceptance criteria.
- `docs/PROGRESS.md`: navigation to the current reports.

Do not edit these generated files directly. `docs/IMPLEMENTATION_HISTORY.md` preserves the old checklist as historical notes; its implementation checkmarks were not a production-readiness claim.

The generator validates the JSON schema, total weights, unique ids, evidence references, repository-relative file paths, test-result consistency and priority references. It checks referenced files exist, but **does not infer anything is complete from their existence**. It runs no tests, reads no database credentials and accesses no network. `--check` exits nonzero for invalid/stale reports and leaves files unchanged. Humans still need to judge evidence quality and decide whether evidence is stale.

## Missing or damaged data

Missing/unreadable/invalid JSON causes the owner API to return a safe 503 without private file paths. A structurally invalid snapshot is rejected by the shared frontend schema and shown as unavailable. Neither case substitutes 0% or fabricated completion. The owner can retry after restoring, validating and rebuilding the reviewed file. Cashiers receive 403 and anonymous clients 401 before the snapshot reader runs.

An optional `DevelopmentProgress__FilePath` setting can select a private snapshot for testing/operations; do not point it at arbitrary secret files. It is server-side configuration, never a browser parameter. Normal builds require the canonical repository JSON and package it automatically. Progress changes do not alter inventory, credit or employee records.
