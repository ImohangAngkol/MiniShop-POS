using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;

namespace MiniShop.Tests;

[Collection("PostgreSQL")]
public sealed class CommerceTests(DatabaseFixture fixture)
{
    [Theory]
    [InlineData(0.05, 0.05)]
    [InlineData(0.05, 0.15)]
    [InlineData(0, 0)]
    public async Task Discounted_product_report_allocations_reconcile_exactly_to_sale_totals(decimal price, decimal discount)
    {
        var ids = new[] { await fixture.Product(price: price), await fixture.Product(price: price), await fixture.Product(price: price) };
        var sale = await Checkout(new CheckoutRequest(Guid.NewGuid(), ids.Select(id => new CartLine(id, 1)).ToList(), discount, 1, null, false));
        await using var db = fixture.Db();
        var report = System.Text.Json.JsonSerializer.SerializeToElement(await new ReportService(db).Sales(Rules.Today, Rules.Today, default));
        var rows = report.GetProperty("products").EnumerateArray().Where(row => ids.Contains(row.GetProperty("id").GetInt32())).ToList();
        Assert.Equal(sale.Total, rows.Sum(row => row.GetProperty("revenue").GetDecimal()));
        Assert.Equal(sale.Total - sale.CostTotal, rows.Sum(row => row.GetProperty("grossProfit").GetDecimal()));
        await new CommerceService(db, new ShopWriter(db)).Refund(sale.Id, "Discount allocation reversal", fixture.OwnerId, default);
        var reversed = System.Text.Json.JsonSerializer.SerializeToElement(await new ReportService(db).Sales(Rules.Today, Rules.Today, default));
        var reversedRows = reversed.GetProperty("products").EnumerateArray().Where(row => ids.Contains(row.GetProperty("id").GetInt32())).ToList();
        Assert.All(reversedRows, row => { Assert.Equal(0, row.GetProperty("revenue").GetDecimal()); Assert.Equal(0, row.GetProperty("grossProfit").GetDecimal()); });
    }
    private async Task<Sale> Checkout(CheckoutRequest r) { await using var db = fixture.Db(); return await new CommerceService(db, new ShopWriter(db)).Checkout(r, fixture.OwnerId, "Fictional owner", true, default); }
    private static CheckoutRequest Request(int id, decimal quantity = 1, decimal cash = 100, int? customer = null, bool credit = false, Guid? key = null) => new(key ?? Guid.NewGuid(), [new CartLine(id, quantity)], 0, cash, customer, credit);

    [Fact]
    public async Task Weighted_checkout_rounds_totals_and_change_and_deducts_stock()
    {
        var p = await fixture.Product("kilogram", 10, 58.63m); var sale = await Checkout(Request(p, 1.125m));
        Assert.Equal(65.96m, sale.Total); Assert.Equal(34.04m, sale.Change);
        await using var db = fixture.Db(); Assert.Equal(8.875m, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity)); Assert.Equal(1, await db.Payments.CountAsync(x => x.RequestId == sale.RequestId));
    }
    [Fact]
    public async Task Duplicate_parallel_checkout_returns_one_sale_and_one_stock_deduction()
    {
        var p = await fixture.Product(); var request = Request(p, key: Guid.NewGuid()); var results = await Task.WhenAll(Checkout(request), Checkout(request), Checkout(request));
        Assert.Single(results.Select(x => x.Id).Distinct()); await using var db = fixture.Db(); Assert.Equal(9, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity)); Assert.Equal(1, await db.Sales.CountAsync(x => x.RequestId == request.RequestId));
    }
    [Fact]
    public async Task Same_key_with_changed_payload_is_a_conflict()
    {
        var p = await fixture.Product(); var r = Request(p); await Checkout(r); var e = await Assert.ThrowsAsync<BusinessException>(() => Checkout(r with { CashReceived = 200 })); Assert.Equal(409, e.Status);
    }
    [Fact]
    public async Task Concurrent_requests_cannot_oversell_the_last_item()
    {
        var p = await fixture.Product(quantity: 1);
        async Task<bool> Attempt() { try { await Checkout(Request(p)); return true; } catch (BusinessException e) when (e.Status == 409) { return false; } }
        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Attempt())); Assert.Equal(1, results.Count(x => x)); await using var db = fixture.Db(); Assert.Equal(0, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity));
    }
    [Fact]
    public async Task Invalid_credit_checkout_rolls_back_all_stock_and_financial_changes()
    {
        var p = await fixture.Product(); var r = Request(p, cash: 0, credit: true); await Assert.ThrowsAsync<BusinessException>(() => Checkout(r));
        await using var db = fixture.Db(); Assert.Equal(10, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity)); Assert.False(await db.Sales.AnyAsync(x => x.RequestId == r.RequestId)); Assert.Equal(0, await db.StockMovements.CountAsync(x => x.ProductId == p && x.Kind == "Sale"));
    }
    [Fact]
    public async Task Duplicate_product_lines_are_aggregated_before_stock_check()
    {
        var p = await fixture.Product(quantity: 1); var r = Request(p) with { Items = [new(p, 1), new(p, 1)] }; await Assert.ThrowsAsync<BusinessException>(() => Checkout(r));
        await using var db = fixture.Db(); Assert.Equal(1, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity));
    }
    [Fact]
    public async Task Fefo_uses_nearest_expiry_and_excludes_expired_stock()
    {
        var p = await fixture.Product(quantity: 5, expiry: Rules.Today.AddDays(60));
        await using (var db = fixture.Db())
        {
            await new CatalogService(db, new ShopWriter(db)).Receive(new(p, 3, 5, Rules.Today.AddDays(5), "EARLY"), fixture.OwnerId, default);
            db.Batches.Add(new InventoryBatch { ProductId = p, Quantity = 100, UnitCost = 3, ExpiresOn = Rules.Today.AddDays(-1), Reference = "EXPIRED TEST" }); await db.SaveChangesAsync();
        }
        var sale = await Checkout(Request(p, 4)); await using var check = fixture.Db();
        Assert.Equal(0, await check.Batches.Where(x => x.ProductId == p && x.Reference == "EARLY").Select(x => x.Quantity).SingleAsync());
        Assert.Equal(100, await check.Batches.Where(x => x.ProductId == p && x.Reference == "EXPIRED TEST").Select(x => x.Quantity).SingleAsync());
        Assert.Equal(19, sale.CostTotal); await Assert.ThrowsAsync<BusinessException>(() => Checkout(Request(p, 5)));
    }
    [Fact]
    public async Task Partial_repayment_and_refund_preserve_history_and_refund_paid_credit()
    {
        var p = await fixture.Product(price: 100); var customer = await fixture.Customer(500); var sale = await Checkout(Request(p, cash: 20, customer: customer, credit: true));
        var paymentId = Guid.NewGuid();
        await using (var db = fixture.Db()) { var c = new CommerceService(db, new ShopWriter(db)); await c.Repay(customer, new(paymentId, 30), fixture.OwnerId, default); Assert.Equal(50, await c.Balance(customer)); }
        await using (var db = fixture.Db()) { var c = new CommerceService(db, new ShopWriter(db)); await c.Repay(customer, new(paymentId, 30), fixture.OwnerId, default); Assert.Equal(50, await c.Balance(customer)); }
        await using (var db = fixture.Db()) { var c = new CommerceService(db, new ShopWriter(db)); var refunded = await c.Refund(sale.Id, "Returned unopened", fixture.OwnerId, default); Assert.Equal(50, refunded.RefundCash); Assert.Equal(0, await c.Balance(customer)); }
        await using (var db = fixture.Db()) { var c = new CommerceService(db, new ShopWriter(db)); await c.Refund(sale.Id, "Retry", fixture.OwnerId, default); Assert.Equal(3, await db.CreditTransactions.CountAsync(x => x.CustomerId == customer)); Assert.Equal(10, await db.Batches.Where(x => x.ProductId == p).SumAsync(x => x.Quantity)); }
    }
    [Fact]
    public async Task Credit_limit_and_overpayment_are_enforced()
    {
        var p = await fixture.Product(price: 100); var customer = await fixture.Customer(50); await Assert.ThrowsAsync<BusinessException>(() => Checkout(Request(p, cash: 0, customer: customer, credit: true)));
        var sale = await Checkout(Request(p, cash: 60, customer: customer, credit: true)); Assert.Equal(40, sale.Credit);
        await using var db = fixture.Db(); var c = new CommerceService(db, new ShopWriter(db)); await Assert.ThrowsAsync<BusinessException>(() => c.Repay(customer, new(Guid.NewGuid(), 41), fixture.OwnerId, default)); Assert.Equal(40, await c.Balance(customer));
    }
    [Fact]
    public async Task Concurrent_repayments_cannot_exceed_customer_balance()
    {
        var p = await fixture.Product(price: 100); var customer = await fixture.Customer(); await Checkout(Request(p, cash: 0, customer: customer, credit: true));
        async Task<bool> Attempt() { await using var db = fixture.Db(); try { await new CommerceService(db, new ShopWriter(db)).Repay(customer, new(Guid.NewGuid(), 70), fixture.OwnerId, default); return true; } catch (BusinessException) { return false; } }
        var results = await Task.WhenAll(Attempt(), Attempt()); Assert.Single(results, x => x); await using var check = fixture.Db(); Assert.Equal(30, await new CommerceService(check, new ShopWriter(check)).Balance(customer));
    }
    [Fact]
    public async Task Adjustments_cannot_create_negative_stock()
    {
        var p = await fixture.Product(quantity: 1); await using var db = fixture.Db(); var batch = await db.Batches.SingleAsync(x => x.ProductId == p);
        await Assert.ThrowsAsync<BusinessException>(() => new CatalogService(db, new ShopWriter(db)).Adjust(new(batch.Id, -2, "Count correction"), fixture.OwnerId, default));
    }
    [Fact]
    public async Task Historical_credit_and_stock_rows_cannot_be_overwritten_in_postgres()
    {
        var p = await fixture.Product(); var customer = await fixture.Customer(); var sale = await Checkout(Request(p, cash: 0, customer: customer, credit: true));
        await using var db = fixture.Db();
        await Assert.ThrowsAsync<Npgsql.PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"CreditTransactions\" SET \"Amount\" = 0 WHERE \"SaleId\" = {sale.Id}"));
        await Assert.ThrowsAsync<Npgsql.PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM \"StockMovements\" WHERE \"ProductId\" = {p}"));
    }
    [Fact]
    public async Task Reports_distinguish_sales_profit_and_refunds()
    {
        var p = await fixture.Product(price: 100); var sale = await Checkout(Request(p) with { Discount = 10 });
        await using (var db = fixture.Db())
        {
            var report = System.Text.Json.JsonSerializer.SerializeToElement(await new ReportService(db).Sales(Rules.Today, Rules.Today, default));
            var product = report.GetProperty("products").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == p);
            Assert.Equal(90, product.GetProperty("revenue").GetDecimal()); Assert.Equal(86, product.GetProperty("grossProfit").GetDecimal()); Assert.True(await db.Discounts.AnyAsync(x => x.SaleId == sale.Id));
        }
        await using (var db = fixture.Db()) { await new CommerceService(db, new ShopWriter(db)).Refund(sale.Id, "Report reversal test", fixture.OwnerId, default); }
        await using (var db = fixture.Db())
        {
            var report = System.Text.Json.JsonSerializer.SerializeToElement(await new ReportService(db).Sales(Rules.Today, Rules.Today, default));
            var product = report.GetProperty("products").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == p); Assert.Equal(0, product.GetProperty("revenue").GetDecimal()); Assert.Equal(0, product.GetProperty("grossProfit").GetDecimal());
        }
    }
}
