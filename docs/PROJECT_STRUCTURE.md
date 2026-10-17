# Project structure

```text
MiniShop.slnx                  .NET solution containing API and tests
global.json                    .NET 10 SDK selection
Directory.Build.props          Warnings as errors and transitive NuGet audit
NuGet.Config                   Explicit NuGet source
dotnet-tools.json              Pinned local EF migration tool
.env.example                   Documented variable names, no usable credentials
src/
  MiniShop.Api/
    Program.cs                 Dependency registration, security, hosting, health
    Authentication/            Current-employee claim helpers
    Controllers/               REST routes, role checks, response mapping
    DTOs/                      Validated request records and safe sale responses
    Business/Rules.cs          Money, quantity, date, request-key rules
    Entities/Models.cs         Identity employee and shop database entities
    Data/ShopDb.cs             EF mapping, indexes, precision, constraints
    Data/ShopDbFactory.cs      Design-time EF tooling connection
    Data/Bootstrap.cs          First owner, roles, optional fictional demo records
    Data/Migrations/           Versioned schema and append-only triggers
    Services/CatalogService.cs Product/receiving/adjustment rules
    Services/CommerceService.cs Checkout, repayments, full refunds
    Services/ShopWriter.cs     Atomic writes and PostgreSQL serialization lock
    Services/ReportService.cs  Analytics, CSV protection and exports
    Services/ReceiptRenderer.cs PDF interface and text-slip renderer
    wwwroot/                   Generated frontend, ignored by Git
  minishop-web/
    src/App.tsx                Login, authenticated shell, role routes, lazy pages
    src/api.ts                 Axios, CSRF, query cache, session expiry handling
    src/ui.tsx                 Forms, modal, loading/errors, tables, notifications
    src/format.ts              PHP/PHT formatting and decimal preview totals
    src/types.ts               Typed API response contracts
    src/pages/                 Functional dashboard/catalog/cashier/credit/etc.
    src/styles.css             Responsive layout and print styles
    src/readability.css        Higher contrast and larger cashier controls
    e2e/shop.spec.ts            Real built-app browser workflows
    scripts/verify-pdf.mjs      PDF.js/canvas parser and PNG verification helper
    package-lock.json          Reproducible JS dependency graph
tests/MiniShop.Tests/           xUnit rules, real PostgreSQL and HTTP tests
scripts/                       Windows setup/build/start/backup/test helpers
docs/                          Beginner guides, evidence and progress
.runtime/                      Ignored credentials, databases, keys, caches,
                               browsers, backups and QA artifacts
```

Change business behavior in a service and corresponding tests. Keep HTTP-only concerns (roles, status codes, cookies) in controllers/hosting. For schema changes, edit entities/mappings and generate a new migration; do not silently edit an already-applied migration. Built output and local runtime files are disposable only after important database/backups are safely retained: **`.runtime/postgres` contains actual development database files**, not just a cache. Never erase `.runtime` to solve a package-cache problem.
