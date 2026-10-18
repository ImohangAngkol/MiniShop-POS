# Staging PostgreSQL roles and runtime permissions

Software acceptance applies the same policy to dedicated `minishop_acceptance_migrator` and `minishop_acceptance_app` logins and the fictional `minishop_acceptance` database on 127.0.0.1:55433. The owner/migrator prepares schema/data; the HTTPS runtime never receives migration/admin credentials. Its private files are under `.runtime/acceptance`. `AcceptanceSecurity` rejects another database, elevated role, alternate origin, bootstrap or automatic migration. The [acceptance report](SOFTWARE_ACCEPTANCE_REPORT.md) records runtime-policy verification and restored-copy checks.

The later LAN rehearsal uses separate `minishop_lan`, `minishop_lan_migrator` and `minishop_lan_app` identities in the same loopback-only staging cluster. It applies this grant policy without changing development or `minishop_staging` data/roles. LAN configuration/credentials/session keys/publish are separate under `.runtime/lan`. The existing staging cluster administrator is used only by the private preparation process, never by the LAN web host. See [LAN_GUIDE](LAN_GUIDE.md).

The isolated PostgreSQL 18 cluster listens on **127.0.0.1:55433** with SCRAM authentication. It contains fictional staging/test/recovery data only. The development cluster/database/login are unchanged. No PostgreSQL service, firewall rule or machine configuration is installed.

| Identity | Purpose | Privileges |
| --- | --- | --- |
| minishop_staging_admin | Cluster initialization, role/database creation and disposable recovery/test databases | Cluster superuser; stored only in private admin.json; never passed to the web host |
| minishop_staging_migrator | Controlled EF migrations, initial fictional bootstrap, restore ownership and explicit grants | Login/database and schema owner; NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT; no runtime role membership |
| minishop_staging_app | Normal HTTPS application and read-only pg_dump | Login, CONNECT to staging, schema USAGE and the object permissions below; no elevated attributes, role memberships, database/schema ownership, CREATE or TEMP privileges |

The implementation is [RuntimeDatabasePolicy](../src/MiniShop.Api/Data/RuntimeDatabasePolicy.cs); provisioner code is [MiniShop.Staging](../tools/MiniShop.Staging/Program.cs). Database/public-schema PUBLIC permissions and custom-function PUBLIC execution are revoked. PUBLIC access to postgres/template1 is removed in the staging cluster. Runtime has no cross-database maintenance access. Schema changes and function/trigger ownership remain with the migration identity. New tables receive no runtime writes automatically: review/update the explicit grant list and rerun provisioning after every migration. The runtime startup audit fails closed on elevated roles.

| Objects | Runtime access | Reason |
| --- | --- | --- |
| All current public tables | SELECT | Queries, reports, Identity reads and backup; includes read-only migration history |
| Products, Categories, Batches, Customers, Settings | INSERT, UPDATE | Catalog/stock/customer/settings maintenance; deletion is soft |
| AspNetUsers | INSERT, UPDATE | Employee creation, password/stamp/lockout/status changes; no hard account deletion |
| AspNetUserClaims, AspNetUserLogins, AspNetUserRoles, AspNetUserTokens | INSERT, UPDATE, DELETE | Identity relationship/token lifecycle; no permission to create/change role definitions |
| AspNetRoles, AspNetRoleClaims | SELECT only | Role definitions initialized by provisioner |
| Sales | INSERT; UPDATE only Status, RefundedAt, RefundReason, RefundCash | Checkout then full refund; totals/cashier/history cannot be rewritten |
| StockMovements, CreditTransactions, AuditLogs, Payments, Discounts, SaleItems, Allocations | SELECT, INSERT only | Historical entries/reversals are append-only for runtime; existing ledger triggers remain additional protection |
| Sequences | USAGE, SELECT | Generated identifiers and backup state; no sequence reset/setval |
| __EFMigrationsHistory | SELECT only | Backup and inspection; runtime cannot apply migrations |

Runtime receives no TRUNCATE, REFERENCES, TRIGGER, schema CREATE, database CREATE/TEMP, role-management, replication, bypass-RLS or superuser privileges. Provisioning revokes previous runtime object grants before reapplying the allowlist. The app still needs legitimate INSERT/UPDATE privileges; a compromised runtime can misuse those. This setup is not a substitute for app authorization, backups or independent security review.

Migrations never run from non-development web startup. For the EF CLI, `ConnectionStrings__Migrations` takes precedence over the development `ConnectionStrings__Shop`; absent configuration fails rather than guessing a database. For local staging, stop the app and run `Initialize-Staging.ps1`, which reads private migration credentials separately, applies pending migrations and reapplies grants without resetting data or passwords. Do not point development scripts at real databases. Provisioner/test admin credentials must never enter deployed service environment variables.

The current staging Windows user owns both scripts and private configuration for convenience. Before operational service deployment, use distinct OS access controls for service versus migration/provisioning operators. Remove migration/admin/fictional bootstrap files from the service account's reach. Use a fresh non-demo operational database, new credentials and owner acceptance; do not promote fictional staging data.

Authoritative reference: [PostgreSQL 18 privileges](https://www.postgresql.org/docs/18/ddl-priv.html). CONNECT and TEMP privileges normally granted to PUBLIC must be explicitly revoked; owning objects or inheriting an owner role would bypass ordinary grant restrictions.
