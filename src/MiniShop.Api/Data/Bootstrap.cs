using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Data;

public static class Bootstrap
{
    public static async Task Initialize(IServiceProvider services, IConfiguration config)
    {
        var db = services.GetRequiredService<ShopDb>();
        var users = services.GetRequiredService<UserManager<Employee>>();
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var name in new[] { "Owner", "Cashier" }) if (!await roles.RoleExistsAsync(name)) await roles.CreateAsync(new IdentityRole(name));
        if (!await users.Users.AnyAsync())
        {
            var email = config["Bootstrap:Email"]; var password = config["Bootstrap:Password"];
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Initial setup requires Bootstrap__Email and Bootstrap__Password. No default password is provided.");
            var owner = new Employee { UserName = email, Email = email, DisplayName = "Shop Owner", EmailConfirmed = true };
            var result = await users.CreateAsync(owner, password);
            if (!result.Succeeded) throw new InvalidOperationException("Bootstrap password does not meet Identity policy (12 characters, upper/lower case, digit, symbol), or email is invalid.");
            await users.AddToRoleAsync(owner, "Owner");
        }
        if (!await db.Settings.AnyAsync()) db.Settings.Add(new StoreSettings());
        await db.SaveChangesAsync();
        if (config.GetValue<bool>("Bootstrap:SeedDemo") && !await db.Products.AnyAsync())
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var category = new Category { Name = "Demo essentials" }; db.Categories.Add(category);
            var samples = new[] { ("Demo Jasmine Rice", "DEMO-RICE", "kilogram", 48m, 58m, 25m), ("Demo Coffee Sachet", "DEMO-COFFEE", "piece", 6m, 9m, 80m), ("Demo Sugar", "DEMO-SUGAR", "gram", 0.06m, 0.09m, 5000m) };
            foreach (var (name, sku, unit, cost, price, quantity) in samples)
            {
                var p = new Product { Name = name, Sku = sku, Category = category, Unit = unit, CostPrice = cost, SellingPrice = price, LowStockThreshold = unit == "gram" ? 500 : 5 };
                var batch = new InventoryBatch { Product = p, Quantity = quantity, UnitCost = cost, Reference = "FICTIONAL-DEMO", ExpiresOn = DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(6) };
                db.Products.Add(p); db.Batches.Add(batch);
                await db.SaveChangesAsync();
                db.StockMovements.Add(new StockMovement { ProductId = p.Id, Batch = batch, Quantity = quantity, Kind = "DemoSeed", Reason = "Fictional development inventory", ActorId = "development-seed" });
            }
            db.Customers.Add(new Customer { Name = "Demo Customer (fictional)", CreditLimit = 1000 });
            (await db.Settings.SingleAsync()).DemoData = true;
            await db.SaveChangesAsync(); await tx.CommitAsync();
        }
    }
}
