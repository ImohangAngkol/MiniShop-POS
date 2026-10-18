using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MiniShop.Api.Data;

public sealed class ShopDbFactory : IDesignTimeDbContextFactory<ShopDb>
{
    public ShopDb CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Migrations")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__Shop")
            ?? throw new InvalidOperationException("Supply ConnectionStrings__Migrations for controlled migrations, or ConnectionStrings__Shop for development. No implicit database target is allowed.");
        return new ShopDb(new DbContextOptionsBuilder<ShopDb>().UseNpgsql(connection).Options);
    }
}
