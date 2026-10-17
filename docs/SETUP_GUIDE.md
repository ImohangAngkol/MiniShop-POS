# Windows setup, step by step

## 1. Prerequisites

Use Windows 10/11, .NET 10 SDK, a supported Node.js release (this build used Node 24), and PostgreSQL 18 with command-line tools. Git is useful but not needed to run the downloaded source. Download installers from [Microsoft .NET](https://dotnet.microsoft.com/download/dotnet/10.0), [Node.js](https://nodejs.org/), and [PostgreSQL](https://www.postgresql.org/download/windows/). Installing system-wide tools is an operator action; this project did not install or change a PostgreSQL Windows service or firewall rule.

Check versions in PowerShell:

```powershell
dotnet --info
node --version
npm.cmd --version
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --version
```

Docker and Python are not runtime requirements. The project pins its .NET SDK in `global.json`; `latestFeature` accepts later .NET 10 SDK feature bands. Package versions are pinned in `.csproj`, `dotnet-tools.json`, and `package-lock.json`.

## 2. Open the correct folder

```powershell
Set-Location 'C:\Users\User\Desktop\Mini Shop POS'
```

This is the actual implemented workspace. `MiniShop-POS` in the original brief was not present. Do not create a second copy by accident.

Run scripts using `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`. This changes execution policy for that process only. For interactive development, `Set-ExecutionPolicy -Scope Process Bypass` lets the current terminal dot-source `scripts/Env.ps1`. Scripts use `npm.cmd` to avoid the blocked PowerShell npm wrapper.

## 3. Restore dependencies (internet required once)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Restore-Dependencies.ps1
```

`Env.ps1` puts .NET/NuGet/npm/Playwright caches under `.runtime`. An existing `ConnectionStrings__Shop` environment value takes precedence over the optional local configuration file. The restore script checks exit codes. If a network restriction blocks NuGet/npm, allow the official package sources through your network policy, then rerun. Do not substitute unknown package mirrors or disable TLS validation.

## 4. Initialize a separate development database

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-Dev.ps1 -SeedDemo
```

This uses the installed PostgreSQL binaries to create a separate **workspace-local** cluster at `.runtime/postgres`, listening only on `127.0.0.1:55432`. It uses SCRAM password authentication, random generated credentials, and a database named `minishop`. It leaves any existing service on 5432 alone. If PostgreSQL is installed elsewhere, pass `-PostgresBin 'D:\path\to\bin'`.

The script is safe to rerun: it reuses its cluster and local secrets. The owner account is created on first application startup, with email `owner@example.test` and a generated strong password in `.runtime/local-env.ps1`. Open this file privately in an editor; never commit, upload, or send it to anyone. It contains the database password too.

`-SeedDemo` sets an opt-in flag for fictional products/customer/stock. The application checks that there are no products before seeding. Omit it for a new empty setup. Existing local secrets retain their saved seed setting, so for an empty shop use a new database with `Bootstrap__SeedDemo=false`; do not delete historical rows from the demonstration database and pretend it is a clean production database.

The development cluster role is a cluster administrator for convenient isolated tests. Use separate restricted application and migration roles for an operational database; see DEPLOYMENT_GUIDE.

## 5. Build and start

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

This runs the strict TypeScript/Vite build, copies assets into API `wwwroot`, builds .NET, applies migrations, and starts Kestrel. Open **http://localhost:5080**. For an already-built copy, pass `-SkipBuild`. PostgreSQL must already be running. A successful `/api/health` request returns `{"status":"healthy","database":"PostgreSQL"}`.

Log in, set your store details, create a category/product, receive a batch, and make a test sale. Sign out after use. The app is running only while its terminal/process is alive. Press Ctrl+C to stop it cleanly; then use `Stop-DevDatabase.ps1` if you also want PostgreSQL stopped.

## 6. Frontend hot reload

Keep the backend on 5080 in one terminal. In a second terminal:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\Env.ps1
npm.cmd --prefix src/minishop-web run dev
```

Open `http://127.0.0.1:5173`. Vite proxies API requests, so use one consistent browser origin; mixing localhost/127.0.0.1 tabs changes cookies. Vite is for development. The built single-origin app is the deployment target.

## 7. Existing PostgreSQL instead of the isolated cluster

Create a fresh database and role using pgAdmin/psql. Set `ConnectionStrings__Shop` using the canonical keys `Host`, `Port`, `Database`, `Username`, `Password`; quote/escape password values correctly using Npgsql connection-string rules. Also set `Bootstrap__Email` and a strong `Bootstrap__Password` for the first owner, `Bootstrap__SeedDemo=false`, and a private `DataProtection__Directory`. Environment variables are read by the application; `.env.example` is documentation and **is not loaded automatically**. Do not put real credentials in tracked appsettings files.

Run `dotnet ef database update --project src/MiniShop.Api` after loading the script environment. The application does not auto-migrate by default. `Database__AutoMigrate=true` is an explicit optional startup setting; prefer an operator-controlled migration step with a backup.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Scripts disabled | Use the process-only commands above; do not change machine policy |
| `.dotnet`/NuGet permission denied | Load `Env.ps1`, restore with `--configfile NuGet.Config`; caches belong in the workspace |
| PostgreSQL connection refused | Rerun Initialize-Dev, check port 55432, and inspect `.runtime/postgres.log` privately |
| Port already used | Stop the relevant project process or choose a deliberate alternate port in PostgreSQL and the local connection string |
| Login rejected | Use the generated password; five failed attempts lock the account for 15 minutes. Bootstrap settings do not reset existing accounts |
| CSRF failure | Reload the page and sign in again with one consistent origin. Never disable CSRF to work around a stale token |
| Build says executable is in use | Stop the running MiniShop process with Ctrl+C before rebuilding/test/publish |
| Database schema missing | Run EF migrations; a build alone does not create tables |
| White page / missing chunks after rebuild | Reload the browser; keep frontend and API releases together |
| Internet drops | Existing built app and local database keep working; dependency restoration requires internet |
| Server/PC or Wi-Fi drops | Keep the pending checkout tab open, restore the server/network, and retry the saved request |

Never delete the database directory to troubleshoot an application issue. Back up and investigate first.
