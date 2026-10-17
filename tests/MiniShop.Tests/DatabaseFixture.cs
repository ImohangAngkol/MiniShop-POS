using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Configuration;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;
using MiniShop.Api.DTOs;
using MiniShop.Api.Services;
using Npgsql;

namespace MiniShop.Tests;

public sealed class DatabaseFixture : IAsyncLifetime
{
    private readonly string name = "minishop_tests_" + Guid.NewGuid().ToString("N");
    private string admin = "";
    public string Connection { get; private set; } = "";
    public string OwnerId { get; private set; } = "";
    public string Password { get; } = "Test!9a" + Guid.NewGuid().ToString("N");
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public ShopDb Db() => new(new DbContextOptionsBuilder<ShopDb>().UseNpgsql(Connection).Options);
    public async Task InitializeAsync()
    {
        var source = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION") ?? Environment.GetEnvironmentVariable("ConnectionStrings__Shop") ?? throw new InvalidOperationException("Integration tests require TEST_DB_CONNECTION or ConnectionStrings__Shop pointing at a PostgreSQL role allowed to CREATE DATABASE. See SETUP_GUIDE; unit tests can run with --filter FullyQualifiedName~RulesTests.");
        var cs = new NpgsqlConnectionStringBuilder(source) { Database = "postgres" }; admin = cs.ConnectionString;
        await using (var c = new NpgsqlConnection(admin)) { await c.OpenAsync(); await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", c); await cmd.ExecuteNonQueryAsync(); }
        cs.Database = name; Connection = cs.ConnectionString;
        await using (var db = Db()) await db.Database.MigrateAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Shop"] = Connection }));
            b.ConfigureServices(s => { s.RemoveAll<DbContextOptions<ShopDb>>(); s.AddDbContext<ShopDb>(o => o.UseNpgsql(Connection)); });
        });
        await using var scope = Factory.Services.CreateAsyncScope();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Bootstrap:Email"] = "test-owner@example.test", ["Bootstrap:Password"] = Password }).Build();
        await Bootstrap.Initialize(scope.ServiceProvider, config);
        var users = scope.ServiceProvider.GetRequiredService<UserManager<Employee>>(); OwnerId = (await users.FindByEmailAsync("test-owner@example.test"))!.Id;
        var cashier = new Employee { UserName = "test-cashier@example.test", Email = "test-cashier@example.test", DisplayName = "Fictional cashier", EmailConfirmed = true };
        Assert.True((await users.CreateAsync(cashier, Password)).Succeeded); Assert.True((await users.AddToRoleAsync(cashier, "Cashier")).Succeeded);
    }
    public async Task<int> Product(string unit = "piece", decimal quantity = 10, decimal price = 10, DateOnly? expiry = null)
    {
        await using var db = Db(); var category = new Category { Name = "Test " + Guid.NewGuid().ToString("N") };
        var p = new Product { Name = "Fictional test product", Sku = Guid.NewGuid().ToString("N"), Category = category, Unit = unit, CostPrice = 4, SellingPrice = price, LowStockThreshold = 2 };
        db.Products.Add(p); await db.SaveChangesAsync();
        await new CatalogService(db, new ShopWriter(db)).Receive(new ReceiveRequest(p.Id, quantity, 4, expiry, "TEST DELIVERY"), OwnerId, default); return p.Id;
    }
    public async Task<int> Customer(decimal? limit = null)
    {
        await using var db = Db(); var c = new Customer { Name = "Fictional test customer", CreditLimit = limit }; db.Customers.Add(c); await db.SaveChangesAsync(); return c.Id;
    }
    public async Task DisposeAsync()
    {
        if (Factory != null) await Factory.DisposeAsync(); NpgsqlConnection.ClearAllPools();
        if (string.IsNullOrEmpty(admin)) return;
        await using var c = new NpgsqlConnection(admin); await c.OpenAsync(); await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", c); await cmd.ExecuteNonQueryAsync();
    }
}
[CollectionDefinition("PostgreSQL")]
public sealed class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }
