using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MiniShop.Api.Authentication;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;
using Npgsql;

internal static class LanPreparation
{
    public static async Task Prepare(string[] args)
    {
        if (args.Length != 4 || !LanSecurity.IsPrivateIPv4(args[2])) throw new ArgumentException("Usage: prepare-lan <workspace-root> <RFC1918-IP> <name.home.arpa>");
        var root = Path.GetFullPath(args[1]); var ip = args[2]; var host = args[3].ToLowerInvariant();
        if (!File.Exists(Path.Combine(root, "MiniShop.slnx"))) throw new InvalidOperationException("Expected MiniShop workspace.");
        var directory = Path.Combine(root, ".runtime", "lan"); Directory.CreateDirectory(directory);
        string FilePath(string name) => Path.Combine(directory, name);
        async Task<Dictionary<string, string>> Read(string path) => JsonSerializer.Deserialize<Dictionary<string, string>>((await File.ReadAllTextAsync(path)).TrimStart('\uFEFF'))!;
        async Task Save(string name, object value) => await File.WriteAllTextAsync(FilePath(name), JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true }));
        string Secret() => "Lan!9a" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        string Connection(string user, string password) => new NpgsqlConnectionStringBuilder { Host = "127.0.0.1", Port = 55433, Database = "minishop_lan", Username = user, Password = password }.ConnectionString;
        Dictionary<string, string> runtime;
        Dictionary<string, string> migration;
        if (!File.Exists(FilePath("runtime.json")))
        {
            if (Directory.EnumerateFileSystemEntries(directory).Any()) throw new InvalidOperationException("Partial LAN configuration exists; refusing to overwrite it.");
            var ownerPassword = Secret(); var appPassword = Secret(); var migrationPassword = Secret(); var pfxPassword = Secret(); var caPassword = Secret();
            runtime = new()
            {
                ["ConnectionStrings__Shop"] = Connection("minishop_lan_app", appPassword),
                ["ASPNETCORE_ENVIRONMENT"] = "Staging",
                ["DOTNET_ENVIRONMENT"] = "Staging",
                ["ASPNETCORE_URLS"] = "https://127.0.0.1:5643",
                ["AllowedHosts"] = $"localhost;127.0.0.1;{ip};{host}",
                ["LocalStaging__Enabled"] = "false",
                ["Lan__Enabled"] = "true",
                ["Lan__ServerAddress"] = ip,
                ["Lan__HostName"] = host,
                ["Lan__ListenAddress"] = "127.0.0.1",
                ["Lan__Port"] = "5643",
                ["Lan__CertificatePath"] = FilePath("server.pfx"),
                ["Lan__CertificatePassword"] = pfxPassword,
                ["Lan__CaPath"] = FilePath("ca.crt"),
                ["Bootstrap__Enabled"] = "false",
                ["Bootstrap__SeedDemo"] = "false",
                ["Database__AutoMigrate"] = "false",
                ["DataProtection__Directory"] = FilePath("keys"),
                ["DataProtection__ApplicationName"] = "MiniShop.Lan"
            };
            // Validate before generating files or touching any database.
            var validation = runtime.ToDictionary(e => e.Key.Replace("__", ":"), e => (string?)e.Value);
            LanSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(validation).Build(), runtime["ASPNETCORE_URLS"]);
            using var caKey = RSA.Create(3072);
            var caRequest = new CertificateRequest("CN=MiniShop LAN Acceptance CA", caKey, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            caRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, true, 0, true));
            caRequest.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, true));
            caRequest.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(caRequest.PublicKey, false));
            using var ca = caRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddYears(1));
            using var serverKey = RSA.Create(3072);
            var request = new CertificateRequest($"CN={host}", serverKey, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
            request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
            request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.1") }, true));
            var san = new SubjectAlternativeNameBuilder(); san.AddDnsName(host); san.AddDnsName("localhost"); san.AddIpAddress(IPAddress.Parse(ip)); san.AddIpAddress(IPAddress.Loopback); request.CertificateExtensions.Add(san.Build());
            using var issued = request.Create(ca, DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(90), RandomNumberGenerator.GetBytes(16));
            using var server = issued.CopyWithPrivateKey(serverKey);
            var chain = new X509Certificate2Collection(server) { X509CertificateLoader.LoadCertificate(ca.RawData) };
            await File.WriteAllBytesAsync(FilePath("server.pfx"), chain.Export(X509ContentType.Pkcs12, pfxPassword)!);
            await File.WriteAllBytesAsync(FilePath("ca.pfx"), ca.Export(X509ContentType.Pkcs12, caPassword));
            await File.WriteAllTextAsync(FilePath("ca.crt"), ca.ExportCertificatePem());
            await File.WriteAllTextAsync(FilePath("server.crt"), server.ExportCertificatePem());
            migration = new() { ["Connection"] = Connection("minishop_lan_migrator", migrationPassword), ["Bootstrap:Email"] = "lan-owner@example.test", ["Bootstrap:Password"] = ownerPassword, ["Bootstrap:SeedDemo"] = "true", ["CaPassword"] = caPassword };
            await Save("migration.json", migration); await Save("fictional-owner.json", new { Email = "lan-owner@example.test", Password = ownerPassword }); await Save("runtime.json", runtime);
            Console.WriteLine($"Private LAN CA/leaf generated, NOT trusted or installed. CA SHA256: {ca.GetCertHashString(HashAlgorithmName.SHA256)}");
        }
        else
        {
            runtime = await Read(FilePath("runtime.json")); migration = await Read(FilePath("migration.json"));
            if (runtime["Lan__ServerAddress"] != ip || runtime["Lan__HostName"] != host) throw new InvalidOperationException("LAN identity changed. Arrange certificate renewal; do not overwrite the existing environment.");
        }
        var admin = await Read(Path.Combine(root, ".runtime", "staging", "admin.json"));
        var adminCs = new NpgsqlConnectionStringBuilder(admin["Connection"]);
        if (adminCs.Host != "127.0.0.1" || adminCs.Port != 55433 || adminCs.Database != "postgres" || adminCs.Username != "minishop_staging_admin") throw new InvalidOperationException("Refusing non-staging cluster administrator.");
        foreach (var entry in new[] { ("minishop_lan_migrator", migration["Connection"]), ("minishop_lan_app", runtime["ConnectionStrings__Shop"]) })
        {
            var cs = new NpgsqlConnectionStringBuilder(entry.Item2);
            if (cs.Host != "127.0.0.1" || cs.Port != 55433 || cs.Database != "minishop_lan" || cs.Username != entry.Item1) throw new InvalidOperationException("Refusing non-LAN acceptance connection.");
        }
        await using (var adminDb = new NpgsqlConnection(adminCs.ConnectionString))
        {
            await adminDb.OpenAsync();
            foreach (var entry in new[] { ("minishop_lan_migrator", migration["Connection"]), ("minishop_lan_app", runtime["ConnectionStrings__Shop"]) })
            {
                await using var exists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=@name)", adminDb); exists.Parameters.AddWithValue("name", entry.Item1);
                if (await exists.ExecuteScalarAsync() is true) continue;
                await using var format = new NpgsqlCommand("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', @name, @password)", adminDb);
                format.Parameters.AddWithValue("name", entry.Item1); format.Parameters.AddWithValue("password", new NpgsqlConnectionStringBuilder(entry.Item2).Password!);
                await using var create = new NpgsqlCommand((string)(await format.ExecuteScalarAsync())!, adminDb); await create.ExecuteNonQueryAsync();
            }
            await using var databaseExists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='minishop_lan')", adminDb);
            if (await databaseExists.ExecuteScalarAsync() is false) { await using var create = new NpgsqlCommand("CREATE DATABASE minishop_lan OWNER minishop_lan_migrator", adminDb); await create.ExecuteNonQueryAsync(); }
        }
        var services = new ServiceCollection(); services.AddLogging(); services.AddDataProtection();
        services.AddDbContext<ShopDb>(o => o.UseNpgsql(migration["Connection"]));
        services.AddIdentity<Employee, IdentityRole>(o => { o.Password.RequiredLength = 12; o.User.RequireUniqueEmail = true; }).AddEntityFrameworkStores<ShopDb>().AddDefaultTokenProviders();
        await using (var provider = services.BuildServiceProvider())
        {
            await using var scope = provider.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<ShopDb>(); await db.Database.MigrateAsync();
            await Bootstrap.Initialize(scope.ServiceProvider, new ConfigurationBuilder().AddInMemoryCollection(migration!).Build());
            var settings = await db.Settings.SingleAsync(); if (!settings.DemoData) throw new InvalidOperationException("LAN rehearsal requires fictional data.");
            settings.StoreName = "MiniShop LAN ACCEPTANCE (fictional)"; await db.SaveChangesAsync();
        }
        await RuntimeDatabasePolicy.ApplyAsync(migration["Connection"], "minishop_lan_app"); await RuntimeDatabasePolicy.VerifyAsync(runtime["ConnectionStrings__Shop"]);
        Console.WriteLine("Independent fictional LAN database ready. Default listener remains 127.0.0.1:5643; no LAN service, trust or firewall change was made.");
    }
}
