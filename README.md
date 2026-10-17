# MiniShop POS

A working React + ASP.NET Core 10 + PostgreSQL application for a small Philippine shop. Products, batch inventory, weighted checkout, cash and utang, customer repayments, receipts, employee roles, dashboard, reports, and CSV exports are connected to real APIs.

**Status:** locally implemented and tested; commercial deployment still requires operational, printer, security, and invoicing review. See [testing evidence](docs/TESTING_REPORT.md) and [known limits](docs/PROJECT_OVERVIEW.md). The current development database contains labeled fictional demo and E2E records.

## Run on this Windows computer

Open PowerShell in `C:\Users\User\Desktop\Mini Shop POS`:

```powershell
# Dependencies are already restored in this workspace. For a fresh checkout:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Restore-Dependencies.ps1

# Start/reuse the separate project-local PostgreSQL cluster (port 55432).
# Omit -SeedDemo for a fresh empty database. It does not erase existing data.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-Dev.ps1 -SeedDemo

# Build both applications, apply migrations, and serve the complete app.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

Open **http://localhost:5080**. Sign in as `owner@example.test` with the generated owner password in **`.runtime/local-env.ps1`**. Open that ignored local file privately; it also contains database credentials. No shared default password exists. Use Employees to change a password; changing a bootstrap variable does not reset an existing account.

`-ExecutionPolicy Bypass` applies only to the launched process. No machine-wide policy change is needed. Use `npm.cmd` in Windows PowerShell.

Press **Ctrl+C** in the app terminal to stop it. To stop the development database:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Stop-DevDatabase.ps1
```

## Development and checks

```powershell
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\Env.ps1
dotnet run --project src/MiniShop.Api --no-launch-profile
# Separate terminal, same environment setup:
npm.cmd --prefix src/minishop-web run dev
# http://127.0.0.1:5173 proxies /api to the backend.
```

Stop the app before rebuilding backend tests on Windows because its executable can be locked. Real database tests create and remove their own randomly named databases; the configured test role needs CREATEDB.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test.ps1
# Unit tests without PostgreSQL:
dotnet test --filter FullyQualifiedName~RulesTests --no-restore
# Optional browser tests: start the built app separately first.
$env:E2E_EMAIL = $env:Bootstrap__Email
$env:E2E_PASSWORD = $env:Bootstrap__Password
npm.cmd --prefix src/minishop-web exec -- playwright install chromium
npm.cmd --prefix src/minishop-web run test:e2e
```

Browser tests write clearly named fictional records to the selected instance. Run them only against a development database. Playwright browsers and all caches live under ignored `.runtime/` when `Env.ps1` is loaded. See [SETUP_GUIDE](docs/SETUP_GUIDE.md) for complete prerequisites and recovery from common errors.

## Back up the database

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Backup.ps1
# Substitute the archive path printed by Backup.ps1:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify-Backup.ps1 -BackupFile '.runtime\backups\minishop-YYYYMMDD-HHMMSS.dump'
```

Copy backups to encrypted separate storage. The restore drill creates a separate temporary database and never restores over the live database. [Deployment and recovery instructions](docs/DEPLOYMENT_GUIDE.md) cover LAN HTTPS, firewall rules, production database roles, startup, and future cloud design. No LAN firewall rule or system service was installed automatically.

## How the C# side works

`Program.cs` assembles the application and registers dependencies. Controllers receive HTTP requests and enforce roles. DTO records validate input. Services apply shop rules. `ShopDb` is the EF Core database session; Npgsql translates its queries into PostgreSQL commands. `ShopWriter` surrounds commerce writes with a transaction and a PostgreSQL lock. Entities describe persisted records; migrations create and evolve tables. ASP.NET Identity handles password hashes and authenticated cookies. See the Python-to-C# explanations and checkout walkthrough in [BACKEND_GUIDE](docs/BACKEND_GUIDE.md).

Start reading with [project overview](docs/PROJECT_OVERVIEW.md), [user manual](docs/USER_MANUAL.md), [architecture](docs/ARCHITECTURE.md), and [progress checklist](docs/PROGRESS.md). All 12 requested guides are in `docs/`.
