using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MiniShop.Api.Data;

public sealed class ShopDbFactory : IDesignTimeDbContextFactory<ShopDb>
{
    public ShopDb CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Shop") ?? "Host=localhost;Database=minishop;Username=minishop";
        return new ShopDb(new DbContextOptionsBuilder<ShopDb>().UseNpgsql(connection).Options);
    }
}
