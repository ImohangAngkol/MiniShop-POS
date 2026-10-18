# PostgreSQL, relations and migrations

PostgreSQL is the durable source of truth. EF Core provides typed queries and migrations; Npgsql is the PostgreSQL provider. The dev cluster is isolated on port 55432 with SCRAM authentication and local-only listening. Do not expose its development administrator account to the LAN.

Secure staging uses a separate fictional cluster/database on 55433, a migration/schema owner and a restricted runtime login. See [exact grants and responsibilities](DATABASE_ROLES.md) and [staging/recovery commands](STAGING_GUIDE.md). Non-development web startup cannot migrate/bootstrap or use an elevated database role; test fixtures provision separately and then run commerce/API operations with restricted grants.

## Tables and relationships

| Table/group | Purpose and relations |
| --- | --- |
| AspNetUsers / AspNetRoles / Identity join tables | Employee account/hash/stamp/role storage managed by Identity |
| Categories | Unique category names; referenced by products |
| Products | Unique SKU and optional barcode; category, configured unit, prices, low-stock threshold, active flag |
| Batches | Product reference, remaining quantity, actual unit cost, optional expiry, receiving reference/date |
| StockMovements | Signed immutable changes against a product/batch; actor, kind, reason, optional sale reference |
| Sales | Unique receipt/reference and request UUID; cashier/name snapshot, optional customer, amounts, status/refund metadata |
| SaleItems | Product/name/SKU/unit/price/quantity/line total/cost snapshots for a sale |
| Allocations | Sale item to original batch, consumed quantity and cost; used to restore refunds accurately |
| Payments | Cash applied to a sale, customer collection, or cash refund; unique request key |
| Customers | Display/contact, optional credit limit, active flag; no mutable balance column |
| CreditTransactions | Sale/customer/payment links and signed immutable charge/repayment/refund amounts |
| Discounts | Applied owner-authorized fixed order discount linked uniquely to its sale |
| AuditLogs | Immutable actor/action/detail/time entries for sensitive operations |
| Settings | Single row with store identity and thermal receipt configuration |
| __EFMigrationsHistory | Which versioned schema changes have been applied |

Identifiers are integer/bigint for shop entities and Identity string ids for employees. Prices/costs use `numeric(18,2)` and quantities use `numeric(18,3)`. Dates/times are stored in UTC (`timestamptz`) and expiry is a date without time. Reports translate Philippine calendar ranges to half-open UTC intervals so midnight sales fall into the correct business day.

Indexes cover product SKU/barcode, category names, batch product/expiry, sale request/reference/date, payment request, credit customer/sale, and stock product/date. Foreign keys restrict deletion to retain financial history. Check constraints reject negative batch stock/cost, invalid units/prices, inconsistent sale totals, invalid limits, and invalid store configuration. Only deactivation is exposed for products/accounts.

## Quantity and cost rules

`Batch.Quantity` is current on-hand stock. Stock movements are the immutable audit of changes. Available stock excludes expiry dates before today's Philippine date. FEFO chooses the earliest expiry; undated stock follows dated stock, then receiving time/id resolves ties. Receiving sets actual batch cost; later changes to default product cost do not rewrite sale profit history.

Piece products require whole quantities. Gram/kg products allow up to three decimals **in the configured unit**. Quantities are not automatically converted. Gross profit uses cost snapshots from allocations, rounded per sale item, and subtracts the actual order discount. Inventory valuation includes expired on-hand batches, shown separately so an owner can record disposals.

## Migration commands

From the repository root, with `Env.ps1` loaded:

```powershell
dotnet ef migrations list --project src/MiniShop.Api
dotnet ef database update --project src/MiniShop.Api
# After an intentional model edit:
dotnet ef migrations add DescribeTheChange --project src/MiniShop.Api --output-dir Data/Migrations
dotnet ef migrations script --idempotent --project src/MiniShop.Api --output .runtime/schema.sql
```

The initial migration creates Identity and shop tables. `FinancialLinks` adds relational payment/discount links and append-only triggers for credit, stock movements and audit logs. Historical changes use compensating rows; an UPDATE/DELETE attempt on these ledgers raises a PostgreSQL exception. The application must never turn these triggers off to fix a balance.

Generate migrations from the real PostgreSQL provider, review their SQL, back up, and apply once. `--no-build` uses the last compiled assembly; after generating a migration, rebuild before using `--no-build` to apply it. The first implementation attempt demonstrated that otherwise EF cannot see the newly generated migration.

## Seed and backups

Bootstrap creates roles and a first owner only when no employee exists, using supplied environment credentials. There is no public registration/default password. Optional demo seeding is clearly labeled and adds fictional rice, coffee, sugar, customer and stock records. It is not a production import mechanism.

`Backup.ps1` produces a custom-format pg_dump archive and SHA-256 sidecar. `Verify-Backup.ps1` checks that hash, restores into a uniquely named separate database, verifies table counts/migrations and then drops only that temporary database. It requires CREATEDB; the running app should not. Protect archives as confidential customer/financial data. PostgreSQL database directories must not be copied casually while running as a substitute for pg_dump or a properly managed physical backup.
