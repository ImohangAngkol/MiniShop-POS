using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;
using Npgsql;

if (args.Length >= 2 && args[0] == "prepare-lan") { await LanPreparation.Prepare(args); return; }
if (args.Length == 2 && args[0] == "prepare-acceptance") { await AcceptancePreparation.Prepare(args[1]); return; }
if (args.Length == 2 && args[0] == "reconcile-acceptance") { await AcceptanceReconciliation.Run(args[1]); return; }
var acceptanceRecovery = args.Length > 0 && args[0] is "acceptance-snapshot" or "acceptance-recovery-check";
if (acceptanceRecovery) args[0] = args[0][11..];
var lanRecovery = args.Length > 0 && args[0] is "lan-snapshot" or "lan-recovery-check";
if (lanRecovery) args[0] = args[0][4..];
if (args.Length is < 2 or > 3 || args[0] is not ("generate" or "provision" or "verify" or "snapshot" or "recovery-check")
    || args.Length != (args[0] == "recovery-check" ? 3 : 2))
    throw new ArgumentException("Usage: MiniShop.Staging generate|provision|verify|snapshot|recovery-check <workspace-root> [recovery-database]");
var root = Path.GetFullPath(args[1]);
if (!File.Exists(Path.Combine(root, "MiniShop.slnx"))) throw new InvalidOperationException("Expected the MiniShop workspace.");
var directory = Path.Combine(root, ".runtime", acceptanceRecovery ? "acceptance" : lanRecovery ? "lan" : "staging");
var databaseName = acceptanceRecovery ? "minishop_acceptance" : lanRecovery ? "minishop_lan" : "minishop_staging";
var runtimeRole = databaseName + "_app";
var migrationRole = databaseName + "_migrator";
Directory.CreateDirectory(directory);
string FilePath(string name) => Path.Combine(directory, name);
string Secret() => "Stage!9a" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
string Connection(string database, string user, string password) => new NpgsqlConnectionStringBuilder
{ Host = "127.0.0.1", Port = 55433, Database = database, Username = user, Password = password, IncludeErrorDetail = false }.ConnectionString;
async Task Save(string name, object value) => await File.WriteAllTextAsync(FilePath(name), JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true }));
async Task<Dictionary<string, string>> Read(string name) => JsonSerializer.Deserialize<Dictionary<string, string>>(await File.ReadAllTextAsync(FilePath(name)))!;
void ValidateConnection(string value, string database, string user)
{
    var parsed = new NpgsqlConnectionStringBuilder(value);
    if (parsed.Host != "127.0.0.1" || parsed.Port != 55433 || parsed.Database != database || parsed.Username != user)
        throw new InvalidOperationException("Refusing a non-staging database connection. Development and operational databases are never provisioning/recovery targets.");
}
if (args[0] == "generate")
{
    // Refuse to replace any existing state, including a partially initialized environment.
    if (Directory.EnumerateFileSystemEntries(directory).Any()) throw new InvalidOperationException("Staging already contains state; refusing to replace credentials or data.");
    var adminPassword = Secret(); var migrationPassword = Secret(); var appPassword = Secret(); var ownerPassword = Secret(); var certificatePassword = Secret();
    using var key = RSA.Create(3072);
    var request = new CertificateRequest("CN=MiniShop Local Staging", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("localhost"); san.AddIpAddress(IPAddress.Loopback); san.AddIpAddress(IPAddress.IPv6Loopback);
    request.CertificateExtensions.Add(san.Build());
    request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
    request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
    request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.1") }, true));
    using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(90));
    await File.WriteAllBytesAsync(FilePath("localhost.pfx"), certificate.Export(X509ContentType.Pfx, certificatePassword));
    await File.WriteAllTextAsync(FilePath("localhost.crt"), certificate.ExportCertificatePem());
    await Save("admin.json", new Dictionary<string, string> { ["Connection"] = Connection("postgres", "minishop_staging_admin", adminPassword) });
    await Save("migration.json", new Dictionary<string, string> { ["Connection"] = Connection("minishop_staging", "minishop_staging_migrator", migrationPassword), ["Bootstrap:Email"] = "staging-owner@example.test", ["Bootstrap:Password"] = ownerPassword, ["Bootstrap:SeedDemo"] = "true" });
    await Save("fictional-owner.json", new { Email = "staging-owner@example.test", Password = ownerPassword });
    await Save("runtime.json", new Dictionary<string, string>
    {
        ["ConnectionStrings__Shop"] = Connection("minishop_staging", "minishop_staging_app", appPassword),
        ["ASPNETCORE_ENVIRONMENT"] = "Staging",
        ["DOTNET_ENVIRONMENT"] = "Staging",
        ["ASPNETCORE_URLS"] = "https://localhost:5443",
        ["AllowedHosts"] = "localhost;127.0.0.1;[::1]",
        ["LocalStaging__Enabled"] = "true",
        ["Database__AutoMigrate"] = "false",
        ["Bootstrap__Enabled"] = "false",
        ["Bootstrap__SeedDemo"] = "false",
        ["DataProtection__Directory"] = FilePath("keys"),
        ["DataProtection__ApplicationName"] = "MiniShop.Staging",
        ["LocalStaging__CertificatePath"] = FilePath("localhost.pfx"),
        ["LocalStaging__CertificatePassword"] = certificatePassword
    });
    Console.WriteLine($"Staging credentials and 90-day localhost certificate generated privately. SHA256 certificate fingerprint: {certificate.GetCertHashString(HashAlgorithmName.SHA256)}. No certificate store was changed.");
    return;
}
var runtime = await Read("runtime.json");
ValidateConnection(runtime["ConnectionStrings__Shop"], databaseName, runtimeRole);
async Task<SortedDictionary<string, string>> Snapshot(string connectionString)
{
    await using var connection = new NpgsqlConnection(connectionString); await connection.OpenAsync();
    var result = new SortedDictionary<string, string>(StringComparer.Ordinal);
    var names = new List<string>();
    await using (var tables = new NpgsqlCommand("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", connection))
    await using (var reader = await tables.ExecuteReaderAsync()) { while (await reader.ReadAsync()) names.Add(reader.GetString(0)); }
    foreach (var name in names)
    {
        var quoted = new NpgsqlCommandBuilder().QuoteIdentifier(name);
        await using var digest = new NpgsqlCommand($"SELECT count(*)::text || ':' || md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) FROM public.{quoted} t", connection);
        result["table:" + name] = (string)(await digest.ExecuteScalarAsync())!;
    }
    names.Clear();
    await using (var sequences = new NpgsqlCommand("SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename", connection))
    await using (var reader = await sequences.ExecuteReaderAsync()) { while (await reader.ReadAsync()) names.Add(reader.GetString(0)); }
    foreach (var name in names)
    {
        await using var state = new NpgsqlCommand($"SELECT last_value::text || ':' || is_called::text FROM public.{new NpgsqlCommandBuilder().QuoteIdentifier(name)}", connection);
        result["sequence:" + name] = (string)(await state.ExecuteScalarAsync())!;
    }
    await using var totals = new NpgsqlCommand("""
        SELECT json_build_object('stock',(SELECT COALESCE(sum("Quantity"),0) FROM "Batches"),
          'saleTotals',(SELECT COALESCE(sum("Total"),0) FROM "Sales"),
          'cashLedger',(SELECT COALESCE(sum("Amount"),0) FROM "Payments"),
          'creditBalance',(SELECT COALESCE(sum("Amount"),0) FROM "CreditTransactions"),
          'refundCash',(SELECT COALESCE(sum("RefundCash"),0) FROM "Sales"),
          'latestReceipt',(SELECT "Reference" FROM "Sales" ORDER BY "Id" DESC LIMIT 1))::text
        """, connection);
    result["reconciliation"] = (string)(await totals.ExecuteScalarAsync())!;
    return result;
}
if (args[0] == "snapshot")
{
    await Save("backup-snapshot.json", await Snapshot(runtime["ConnectionStrings__Shop"]));
    Console.WriteLine($"Recovery baseline captured privately for {databaseName}: every table, sequence and stock/cash/credit/refund/receipt reconciliation.");
    return;
}
if (args[0] == "recovery-check")
{
    if (args.Length != 3 || !System.Text.RegularExpressions.Regex.IsMatch(args[2], "^" + databaseName + "_restore_[a-f0-9]{32}$")) throw new ArgumentException("Expected an isolated acceptance recovery database name.");
    var migrator = new NpgsqlConnectionStringBuilder((await Read("migration.json"))["Connection"]) { Database = args[2] };
    ValidateConnection(migrator.ConnectionString, args[2], migrationRole);
    await RuntimeDatabasePolicy.ApplyAsync(migrator.ConnectionString, runtimeRole);
    var recovered = new NpgsqlConnectionStringBuilder(runtime["ConnectionStrings__Shop"]) { Database = args[2] };
    await RuntimeDatabasePolicy.VerifyAsync(recovered.ConnectionString);
    var baseline = await Read("backup-snapshot.json");
    bool Matches(SortedDictionary<string, string> snapshot) => snapshot.Count == baseline.Count && baseline.All(e => snapshot.TryGetValue(e.Key, out var value) && e.Value == value);
    if (!Matches(await Snapshot(runtime["ConnectionStrings__Shop"]))) throw new InvalidOperationException("Staging changed during the recovery drill; quiesce it and repeat.");
    if (!Matches(await Snapshot(recovered.ConnectionString))) throw new InvalidOperationException("Recovered data does not match staging baseline.");
    Console.WriteLine($"Recovery verified with the restricted runtime role: all {baseline.Count - 1} table/sequence states and stock/cash/credit/refund/last-receipt totals match. Source {databaseName} unchanged.");
    return;
}
if (args[0] == "verify")
{
    await RuntimeDatabasePolicy.VerifyAsync(runtime["ConnectionStrings__Shop"]);
    Console.WriteLine("Staging runtime database role passed least-privilege checks.");
    return;
}
var admin = await Read("admin.json"); var migration = await Read("migration.json");
ValidateConnection(admin["Connection"], "postgres", "minishop_staging_admin");
ValidateConnection(migration["Connection"], "minishop_staging", "minishop_staging_migrator");
await using (var db = new NpgsqlConnection(admin["Connection"]))
{
    await db.OpenAsync();
    // Hard-coded staging identifiers; password literals are quoted by PostgreSQL, never sent as CLI arguments or logs.
    foreach (var entry in new[] { ("minishop_staging_migrator", migration["Connection"]), ("minishop_staging_app", runtime["ConnectionStrings__Shop"]) })
    {
        await using var format = new NpgsqlCommand("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', @name, @password)", db);
        format.Parameters.AddWithValue("name", entry.Item1); format.Parameters.AddWithValue("password", new NpgsqlConnectionStringBuilder(entry.Item2).Password!);
        // Existing roles are deliberately not altered/reset on repeated initialization.
        await using var exists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=@name)", db); exists.Parameters.AddWithValue("name", entry.Item1);
        if (await exists.ExecuteScalarAsync() is false) { await using var create = new NpgsqlCommand((string)(await format.ExecuteScalarAsync())!, db); await create.ExecuteNonQueryAsync(); }
    }
    await using var databaseExists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='minishop_staging')", db);
    if (await databaseExists.ExecuteScalarAsync() is false)
    {
        await using var create = new NpgsqlCommand("CREATE DATABASE minishop_staging OWNER minishop_staging_migrator", db); await create.ExecuteNonQueryAsync();
    }
    // Other maintenance databases cannot be reached by the application role.
    await using var restrict = new NpgsqlCommand("REVOKE ALL ON DATABASE postgres, template1 FROM PUBLIC", db); await restrict.ExecuteNonQueryAsync();
}
var services = new ServiceCollection();
services.AddLogging(); services.AddDataProtection();
services.AddDbContext<ShopDb>(o => o.UseNpgsql(migration["Connection"]));
services.AddIdentity<Employee, IdentityRole>(o => { o.Password.RequiredLength = 12; o.User.RequireUniqueEmail = true; }).AddEntityFrameworkStores<ShopDb>().AddDefaultTokenProviders();
await using (var provider = services.BuildServiceProvider())
{
    await using var scope = provider.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ShopDb>();
    await db.Database.MigrateAsync();
    await Bootstrap.Initialize(scope.ServiceProvider, new ConfigurationBuilder().AddInMemoryCollection(migration!).Build());
    var settings = await db.Settings.SingleAsync();
    if (!settings.DemoData) throw new InvalidOperationException("Staging must be explicitly marked fictional demo data.");
    settings.StoreName = "MiniShop STAGING (fictional)";
    await db.SaveChangesAsync();
}
await RuntimeDatabasePolicy.ApplyAsync(migration["Connection"], "minishop_staging_app");
await RuntimeDatabasePolicy.VerifyAsync(runtime["ConnectionStrings__Shop"]);
Console.WriteLine("Staging migrations and fictional seed completed separately. The runtime identity has no migration or administrator privileges.");
