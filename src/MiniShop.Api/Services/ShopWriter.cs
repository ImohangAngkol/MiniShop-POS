using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Services;

// All commerce writers take the same PostgreSQL transaction-scoped advisory lock.
// This deliberately serializes short writes for a single small shop, including across API processes.
public sealed class ShopWriter(ShopDb db)
{
    public async Task<T> Run<T>(Func<Task<T>> action, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(716298401)", ct);
        var result = await action();
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return result;
    }
    public void Audit(string actor, string action, string detail) => db.AuditLogs.Add(new AuditLog { ActorId = actor, Action = action, Detail = detail });
}
