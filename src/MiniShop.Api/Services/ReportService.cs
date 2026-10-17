using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;

namespace MiniShop.Api.Services;

public sealed class ReportService(ShopDb db)
{
    public async Task<object> Sales(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var (start, end) = Rules.Period(from, to);
        var booked = await db.Sales.AsNoTracking().Include(x => x.Items).Where(x => x.CreatedAt >= start && x.CreatedAt < end).ToListAsync(ct);
        var refunded = await db.Sales.AsNoTracking().Include(x => x.Items).Where(x => x.RefundedAt >= start && x.RefundedAt < end).ToListAsync(ct);
        var revenue = booked.Sum(x => x.Total) - refunded.Sum(x => x.Total);
        var cogs = booked.Sum(x => x.CostTotal) - refunded.Sum(x => x.CostTotal);
        return new
        {
            from,
            to,
            revenue,
            grossProfit = revenue - cogs,
            costOfGoods = cogs,
            discounts = booked.Sum(x => x.Discount),
            transactions = booked.Count(x => x.Status == "Completed"),
            refunds = refunded.Sum(x => x.Total),
            cashSales = booked.Sum(x => x.CashApplied),
            refundCash = refunded.Sum(x => x.RefundCash),
            repayments = await db.Payments.Where(x => x.Kind == "Repayment" && x.CreatedAt >= start && x.CreatedAt < end).SumAsync(x => x.Amount, ct),
            daily = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1).Select(i =>
            {
                var day = from.AddDays(i); return new
                {
                    date = day,
                    sales = booked.Where(x => LocalDate(x.CreatedAt) == day).Sum(x => x.Total) - refunded.Where(x => LocalDate(x.RefundedAt!.Value) == day).Sum(x => x.Total)
                };
            }),
            products = booked.SelectMany(x => x.Items.Select(i => new { i.ProductId, i.Name, i.Quantity, Revenue = i.LineTotal * (x.Subtotal == 0 ? 0 : x.Total / x.Subtotal), i.CostTotal }))
                .Concat(refunded.SelectMany(x => x.Items.Select(i => new { i.ProductId, i.Name, Quantity = -i.Quantity, Revenue = -i.LineTotal * (x.Subtotal == 0 ? 0 : x.Total / x.Subtotal), CostTotal = -i.CostTotal })))
                .GroupBy(x => x.ProductId).Select(x => new { id = x.Key, name = x.First().Name, quantity = x.Sum(i => i.Quantity), revenue = Rules.Money(x.Sum(i => i.Revenue)), grossProfit = Rules.Money(x.Sum(i => i.Revenue - i.CostTotal)) }).OrderByDescending(x => x.revenue)
        };
    }
    public async Task<object> Dashboard(CancellationToken ct)
    {
        var today = Rules.Today; var near = today.AddDays(30);
        return new
        {
            today = await Sales(today, today, ct),
            trend = await Sales(today.AddDays(-6), today, ct),
            outstandingCredit = await db.CreditTransactions.SumAsync(x => x.Amount, ct),
            lowStock = await db.Products.Where(x => x.Active && x.Batches.Where(b => b.ExpiresOn == null || b.ExpiresOn >= today).Sum(b => b.Quantity) <= x.LowStockThreshold)
                .OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Unit, stock = x.Batches.Where(b => b.ExpiresOn == null || b.ExpiresOn >= today).Sum(b => b.Quantity), x.LowStockThreshold }).Take(20).ToListAsync(ct),
            nearExpiry = await db.Batches.Where(x => x.Quantity > 0 && x.ExpiresOn != null && x.ExpiresOn <= near).OrderBy(x => x.ExpiresOn).Select(x => new { x.Id, ProductName = x.Product.Name, x.Quantity, x.ExpiresOn, expired = x.ExpiresOn < today }).Take(20).ToListAsync(ct),
            recent = (await db.Sales.AsNoTracking().Include(x => x.Customer).OrderByDescending(x => x.Id).Take(6).ToListAsync(ct)).Select(DTOs.Responses.Sale)
        };
    }
    public async Task<object> Inventory(CancellationToken ct) => new
    {
        valuation = await db.Batches.SumAsync(x => x.Quantity * x.UnitCost, ct),
        expiredValuation = await db.Batches.Where(x => x.ExpiresOn < Rules.Today).SumAsync(x => x.Quantity * x.UnitCost, ct),
        products = await db.Products.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Unit, stock = x.Batches.Sum(b => b.Quantity), value = x.Batches.Sum(b => b.Quantity * b.UnitCost) }).ToListAsync(ct)
    };
    public async Task<byte[]> Export(string kind, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var text = new StringBuilder("\uFEFF");
        if (kind == "sales")
        {
            var (start, end) = Rules.Period(from, to); text.AppendLine("Reference,Created (UTC),Status,Total,Discount,Cash applied,Credit,Refunded (UTC),Cash refunded");
            var sales = await db.Sales.AsNoTracking().Where(x => (x.CreatedAt >= start && x.CreatedAt < end) || (x.RefundedAt >= start && x.RefundedAt < end)).OrderBy(x => x.Id).ToListAsync(ct);
            foreach (var s in sales) text.AppendLine(string.Join(',', Csv(s.Reference), Csv(s.CreatedAt.ToString("O")), Csv(s.Status), Number(s.Total), Number(s.Discount), Number(s.CashApplied), Number(s.Credit), Csv(s.RefundedAt?.ToString("O") ?? ""), Number(s.RefundCash)));
        }
        else if (kind == "credit")
        {
            text.AppendLine("Customer,Contact,Outstanding");
            var list = await db.Customers.Select(x => new { x.Name, x.Contact, Balance = db.CreditTransactions.Where(c => c.CustomerId == x.Id).Sum(c => c.Amount) }).ToListAsync(ct);
            foreach (var x in list) text.AppendLine($"{Csv(x.Name)},{Csv(x.Contact ?? "")},{Number(x.Balance)}");
        }
        else if (kind == "inventory")
        {
            text.AppendLine("SKU,Product,Unit,Quantity,Valuation");
            var list = await db.Products.Select(x => new { x.Sku, x.Name, x.Unit, Qty = x.Batches.Sum(b => b.Quantity), Value = x.Batches.Sum(b => b.Quantity * b.UnitCost) }).ToListAsync(ct);
            foreach (var x in list) text.AppendLine($"{Csv(x.Sku)},{Csv(x.Name)},{Csv(x.Unit)},{Number(x.Qty)},{Number(x.Value)}");
        }
        else throw new BusinessException("Export kind must be sales, credit, or inventory.");
        return Encoding.UTF8.GetBytes(text.ToString());
    }
    public static string Csv(string value) { if (value.TrimStart().StartsWith('=') || value.TrimStart().StartsWith('+') || value.TrimStart().StartsWith('-') || value.TrimStart().StartsWith('@') || value.StartsWith('\t') || value.StartsWith('\r')) value = "'" + value; return "\"" + value.Replace("\"", "\"\"") + "\""; }
    private static string Number(decimal n) => n.ToString(CultureInfo.InvariantCulture);
    private static DateOnly LocalDate(DateTimeOffset value) => DateOnly.FromDateTime(value.ToOffset(TimeSpan.FromHours(8)).DateTime);
}
