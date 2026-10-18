using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using Npgsql;

internal static class AcceptanceReconciliation
{
    public static async Task Run(string root)
    {
        var directory = Path.Combine(Path.GetFullPath(root), ".runtime", "acceptance");
        var runtime = JsonSerializer.Deserialize<Dictionary<string, string>>(await File.ReadAllTextAsync(Path.Combine(directory, "runtime.json")))!;
        var connection = new NpgsqlConnectionStringBuilder(runtime["ConnectionStrings__Shop"]);
        if (connection.Host != "127.0.0.1" || connection.Port != 55433 || connection.Database != "minishop_acceptance" || connection.Username != "minishop_acceptance_app") throw new InvalidOperationException("Refusing a non-acceptance reconciliation target.");
        await using var db = new ShopDb(new DbContextOptionsBuilder<ShopDb>().UseNpgsql(connection.ConnectionString).Options);
        var sales = await db.Sales.AsNoTracking().Include(s => s.Items).ThenInclude(i => i.Allocations).ToListAsync();
        var batches = await db.Batches.AsNoTracking().ToListAsync();
        var movements = await db.StockMovements.AsNoTracking().ToListAsync();
        var payments = await db.Payments.AsNoTracking().ToListAsync();
        var credit = await db.CreditTransactions.AsNoTracking().ToListAsync();
        var customers = await db.Customers.AsNoTracking().ToListAsync();
        var products = await db.Products.AsNoTracking().ToListAsync();
        var checks = new List<string>();
        void Check(bool condition, string name) { if (!condition) throw new InvalidOperationException("Acceptance reconciliation failed: " + name); checks.Add(name); }
        Check(batches.All(b => b.Quantity >= 0 && b.Quantity == movements.Where(m => m.BatchId == b.Id).Sum(m => m.Quantity)), "Every batch equals its complete stock movement ledger; no negative stock");
        Check(sales.All(s => s.Subtotal == s.Items.Sum(i => i.LineTotal) && s.Total == s.Subtotal - s.Discount && s.Total == s.CashApplied + s.Credit && s.CostTotal == s.Items.Sum(i => i.CostTotal)), "Every sale subtotal, discount, tender split and cost reconciles");
        Check(sales.SelectMany(s => s.Items).All(i => i.Quantity == i.Allocations.Sum(a => a.Quantity) && i.CostTotal == Rules.Money(i.Allocations.Sum(a => a.Quantity * a.UnitCost)) && i.LineTotal == Rules.Money(i.Quantity * i.UnitPrice)), "Every line allocation, price and batch cost reconciles");
        Check(sales.All(s => payments.Where(p => p.SaleId == s.Id && p.Kind == "CashSale").Sum(p => p.Amount) == s.CashApplied && payments.Where(p => p.SaleId == s.Id && p.Kind == "Refund").Sum(p => p.Amount) == -s.RefundCash), "Every sale and refund matches its cash ledger");
        Check(payments.Where(p => p.Kind == "Repayment").All(p => credit.Where(c => c.PaymentId == p.Id).Sum(c => c.Amount) == -p.Amount), "Every repayment equals its debt allocations");
        Check(sales.All(s => credit.Where(c => c.SaleId == s.Id).Sum(c => c.Amount) == (s.Status == "Refunded" ? 0 : s.Credit + credit.Where(c => c.SaleId == s.Id && c.Kind == "Repayment").Sum(c => c.Amount))), "Every completed/refunded sale debt reconciles");
        Check(customers.All(c => credit.Where(t => t.CustomerId == c.Id).Sum(t => t.Amount) >= 0 && (c.CreditLimit == null || credit.Where(t => t.CustomerId == c.Id).Sum(t => t.Amount) <= c.CreditLimit)), "Every household balance is nonnegative and within its limit");
        var revenue = sales.Where(s => s.Status == "Completed").Sum(s => s.Total);
        var cash = payments.Sum(p => p.Amount); var outstanding = credit.Sum(c => c.Amount);
        Check(revenue == cash + outstanding, "Net completed revenue equals net cash ledger plus outstanding utang");
        var summary = new { database = "minishop_acceptance", fictional = true, checkedAt = DateTimeOffset.UtcNow, checks, saleCount = sales.Count, completed = sales.Count(s => s.Status == "Completed"), refunded = sales.Count(s => s.Status == "Refunded"), revenue, cash, outstanding, costOfGoods = sales.Where(s => s.Status == "Completed").Sum(s => s.CostTotal), valuation = batches.Sum(b => b.Quantity * b.UnitCost), stockByUnit = products.GroupBy(p => p.Unit).ToDictionary(g => g.Key, g => batches.Where(b => g.Select(p => p.Id).Contains(b.ProductId)).Sum(b => b.Quantity)), products = products.Select(p => new { p.Id, p.Sku, p.Name, p.Unit, stock = batches.Where(b => b.ProductId == p.Id).Sum(b => b.Quantity), value = batches.Where(b => b.ProductId == p.Id).Sum(b => b.Quantity * b.UnitCost) }), customers = customers.Select(c => new { c.Id, c.Name, balance = credit.Where(t => t.CustomerId == c.Id).Sum(t => t.Amount) }), sales = sales.Select(s => new { s.Id, s.Reference, s.Total, s.Status, s.Discount, s.CashApplied, s.Credit, s.RefundCash }) };
        await File.WriteAllTextAsync(Path.Combine(directory, "reconciliation.json"), JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"{checks.Count} database reconciliation invariants passed across {sales.Count} sales, {batches.Count} batches and {movements.Count} movements. Net revenue {revenue:0.00} = cash {cash:0.00} + outstanding {outstanding:0.00}.");
    }
}
