using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;
using Npgsql;

internal static class AcceptancePreparation
{
    public static async Task Prepare(string root)
    {
        root = Path.GetFullPath(root);
        if (!File.Exists(Path.Combine(root, "MiniShop.slnx"))) throw new InvalidOperationException("Expected MiniShop workspace.");
        var directory = Path.Combine(root, ".runtime", "acceptance"); Directory.CreateDirectory(directory);
        string FilePath(string name) => Path.Combine(directory, name);
        async Task<Dictionary<string, string>> Read(string file) => JsonSerializer.Deserialize<Dictionary<string, string>>((await File.ReadAllTextAsync(file)).TrimStart('\uFEFF'))!;
        async Task Save(string name, object value) => await File.WriteAllTextAsync(FilePath(name), JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true }));
        string Secret() => "Accept!9a" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        string Connection(string user, string password) => new NpgsqlConnectionStringBuilder { Host = "127.0.0.1", Port = 55433, Database = "minishop_acceptance", Username = user, Password = password }.ConnectionString;
        Dictionary<string, string> runtime; Dictionary<string, string> migration; Dictionary<string, string> credentials;
        if (!File.Exists(FilePath("runtime.json")))
        {
            if (Directory.EnumerateFileSystemEntries(directory).Any()) throw new InvalidOperationException("Partial acceptance configuration exists. Refusing to overwrite it.");
            var tls = await Read(Path.Combine(root, ".runtime", "lan", "runtime.json"));
            File.Copy(tls["Lan__CertificatePath"], FilePath("server.pfx")); File.Copy(tls["Lan__CaPath"], FilePath("ca.crt"));
            credentials = new()
            {
                ["OwnerEmail"] = "acceptance-owner@example.test",
                ["OwnerPassword"] = Secret(),
                ["Cashier1Email"] = "acceptance-cashier1@example.test",
                ["Cashier1Password"] = Secret(),
                ["Cashier2Email"] = "acceptance-cashier2@example.test",
                ["Cashier2Password"] = Secret()
            };
            migration = new() { ["Connection"] = Connection("minishop_acceptance_migrator", Secret()), ["Bootstrap:Email"] = credentials["OwnerEmail"], ["Bootstrap:Password"] = credentials["OwnerPassword"] };
            runtime = new()
            {
                ["ConnectionStrings__Shop"] = Connection("minishop_acceptance_app", Secret()),
                ["ASPNETCORE_ENVIRONMENT"] = "Acceptance",
                ["DOTNET_ENVIRONMENT"] = "Acceptance",
                ["ASPNETCORE_URLS"] = "https://127.0.0.1:5843",
                ["AllowedHosts"] = "127.0.0.1;localhost",
                ["LocalStaging__Enabled"] = "false",
                ["Lan__Enabled"] = "false",
                ["Bootstrap__Enabled"] = "false",
                ["Bootstrap__SeedDemo"] = "false",
                ["Database__AutoMigrate"] = "false",
                ["DataProtection__Directory"] = FilePath("keys"),
                ["DataProtection__ApplicationName"] = "MiniShop.SoftwareAcceptance",
                ["Acceptance__CertificatePath"] = FilePath("server.pfx"),
                ["Acceptance__CertificatePassword"] = tls["Lan__CertificatePassword"],
                ["Acceptance__CaPath"] = FilePath("ca.crt")
            };
            await Save("runtime.json", runtime); await Save("migration.json", migration); await Save("credentials.json", credentials);
        }
        else { runtime = await Read(FilePath("runtime.json")); migration = await Read(FilePath("migration.json")); credentials = await Read(FilePath("credentials.json")); }
        var admin = await Read(Path.Combine(root, ".runtime", "staging", "admin.json"));
        var adminCs = new NpgsqlConnectionStringBuilder(admin["Connection"]);
        if (adminCs.Host != "127.0.0.1" || adminCs.Port != 55433 || adminCs.Database != "postgres" || adminCs.Username != "minishop_staging_admin") throw new InvalidOperationException("Refusing non-staging-cluster administrator.");
        var entries = new[] { ("minishop_acceptance_migrator", migration["Connection"]), ("minishop_acceptance_app", runtime["ConnectionStrings__Shop"]) };
        foreach (var entry in entries) { var c = new NpgsqlConnectionStringBuilder(entry.Item2); if (c.Host != "127.0.0.1" || c.Port != 55433 || c.Database != "minishop_acceptance" || c.Username != entry.Item1) throw new InvalidOperationException("Refusing a non-acceptance database target."); }
        await using (var db = new NpgsqlConnection(adminCs.ConnectionString))
        {
            await db.OpenAsync();
            foreach (var entry in entries)
            {
                await using var exists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=@name)", db); exists.Parameters.AddWithValue("name", entry.Item1);
                if (await exists.ExecuteScalarAsync() is true) continue;
                await using var format = new NpgsqlCommand("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', @name, @password)", db);
                format.Parameters.AddWithValue("name", entry.Item1); format.Parameters.AddWithValue("password", new NpgsqlConnectionStringBuilder(entry.Item2).Password!);
                await using var create = new NpgsqlCommand((string)(await format.ExecuteScalarAsync())!, db); await create.ExecuteNonQueryAsync();
            }
            await using var existsDb = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='minishop_acceptance')", db);
            if (await existsDb.ExecuteScalarAsync() is false) { await using var create = new NpgsqlCommand("CREATE DATABASE minishop_acceptance OWNER minishop_acceptance_migrator", db); await create.ExecuteNonQueryAsync(); }
        }
        var services = new ServiceCollection(); services.AddLogging(); services.AddDataProtection();
        services.AddDbContext<ShopDb>(o => o.UseNpgsql(migration["Connection"]));
        services.AddIdentity<Employee, IdentityRole>(o => { o.Password.RequiredLength = 12; o.User.RequireUniqueEmail = true; }).AddEntityFrameworkStores<ShopDb>().AddDefaultTokenProviders();
        await using (var provider = services.BuildServiceProvider())
        {
            await using var scope = provider.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<ShopDb>(); await db.Database.MigrateAsync();
            await Bootstrap.Initialize(scope.ServiceProvider, new ConfigurationBuilder().AddInMemoryCollection(migration!).Build());
            var users = scope.ServiceProvider.GetRequiredService<UserManager<Employee>>();
            for (var i = 1; i <= 2; i++)
            {
                if (await users.FindByEmailAsync(credentials[$"Cashier{i}Email"]) != null) continue;
                var cashier = new Employee { UserName = credentials[$"Cashier{i}Email"], Email = credentials[$"Cashier{i}Email"], DisplayName = $"Fictional acceptance cashier {i}", EmailConfirmed = true };
                if (!(await users.CreateAsync(cashier, credentials[$"Cashier{i}Password"])).Succeeded || !(await users.AddToRoleAsync(cashier, "Cashier")).Succeeded) throw new InvalidOperationException("Fictional cashier creation failed.");
            }
            await AcceptanceDataset.Seed(db, (await users.FindByEmailAsync(credentials["OwnerEmail"]))!.Id);
            await Save("dataset.json", new { fictional = true, baselineProducts = 300, categories = AcceptanceDataset.Groups, products = await db.Products.OrderBy(p => p.Sku).Select(p => new { p.Id, p.Name, p.Sku, p.Barcode, p.Unit, p.SellingPrice, p.CostPrice }).ToListAsync() });
        }
        await RuntimeDatabasePolicy.ApplyAsync(migration["Connection"], "minishop_acceptance_app"); await RuntimeDatabasePolicy.VerifyAsync(runtime["ConnectionStrings__Shop"]);
        Console.WriteLine("Separate fictional acceptance database ready: 300 baseline products, 6 categories, 24 households, owner and 2 cashiers. Existing shop databases were not seeded or reset.");
    }
}
