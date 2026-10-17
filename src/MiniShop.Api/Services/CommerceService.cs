using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Services;

public sealed class CommerceService(ShopDb db, ShopWriter writer)
{
    public async Task<Sale> Checkout(CheckoutRequest request, string actor, string cashierName, bool owner, CancellationToken ct)
    {
        Rules.RequestId(request.RequestId);
        Rules.MoneyInput(request.Discount); Rules.MoneyInput(request.CashReceived);
        if (request.Items is not { Count: > 0 and <= 200 } || request.Items.Any(x => x.Quantity <= 0)) throw new BusinessException("A cart must have 1–200 positive item quantities.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
        return await writer.Run(async () =>
        {
            var existing = await db.Sales.Include(x => x.Items).SingleOrDefaultAsync(x => x.RequestId == request.RequestId, ct);
            if (existing != null)
            {
                if (existing.CashierId != actor || existing.RequestHash != hash) throw new BusinessException("This checkout key was already used with a different request.", 409);
                return existing;
            }
            // Group duplicate barcode entries before checking stock.
            var lines = request.Items.GroupBy(x => x.ProductId).Select(x => new CartLine(x.Key, x.Sum(v => v.Quantity))).ToList();
            var ids = lines.Select(x => x.ProductId).ToList();
            var products = await db.Products.Include(x => x.Batches).Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            var sale = new Sale
            {
                RequestId = request.RequestId,
                RequestHash = hash,
                CashierId = actor,
                CashierName = cashierName,
                Reference = $"MS-{Rules.Today:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}"
            };
            foreach (var line in lines)
            {
                if (!products.TryGetValue(line.ProductId, out var p) || !p.Active) throw new BusinessException("One or more products are unavailable.");
                Rules.Quantity(p.Unit, line.Quantity);
                var batches = p.Batches.Where(x => x.Quantity > 0 && (x.ExpiresOn == null || x.ExpiresOn >= Rules.Today))
                    .OrderBy(x => x.ExpiresOn ?? DateOnly.MaxValue).ThenBy(x => x.ReceivedAt).ThenBy(x => x.Id).ToList();
                if (batches.Sum(x => x.Quantity) < line.Quantity) throw new BusinessException($"Insufficient unexpired stock for {p.Name}.", 409);
                var item = new SaleItem
                {
                    ProductId = p.Id,
                    Name = p.Name,
                    Sku = p.Sku,
                    Unit = p.Unit,
                    Quantity = line.Quantity,
                    UnitPrice = p.SellingPrice,
                    LineTotal = Rules.Money(p.SellingPrice * line.Quantity)
                };
                var remaining = line.Quantity;
                foreach (var batch in batches)
                {
                    if (remaining == 0) break;
                    var take = Math.Min(batch.Quantity, remaining);
                    batch.Quantity -= take; remaining -= take;
                    item.Allocations.Add(new SaleAllocation { BatchId = batch.Id, Quantity = take, UnitCost = batch.UnitCost });
                    db.StockMovements.Add(new StockMovement { ProductId = p.Id, BatchId = batch.Id, Quantity = -take, Kind = "Sale", Reason = sale.Reference, ActorId = actor });
                }
                item.CostTotal = Rules.Money(item.Allocations.Sum(x => x.Quantity * x.UnitCost));
                sale.Items.Add(item);
            }
            sale.Subtotal = sale.Items.Sum(x => x.LineTotal);
            Rules.MoneyInput(sale.Subtotal);
            if (request.Discount > sale.Subtotal) throw new BusinessException("Discount cannot exceed the subtotal.");
            if (request.Discount > 0 && !owner) throw new BusinessException("An owner must authorize discounts by checking out with their own account.", 403);
            sale.Discount = request.Discount; sale.Total = sale.Subtotal - sale.Discount; sale.CostTotal = sale.Items.Sum(x => x.CostTotal);
            sale.CashReceived = request.CashReceived; sale.CashApplied = Math.Min(sale.Total, request.CashReceived);
            sale.Change = Math.Max(0, request.CashReceived - sale.Total); sale.Credit = sale.Total - sale.CashApplied;
            if (!request.OnCredit && sale.Credit > 0) throw new BusinessException("Cash received is below the total. Select a customer and enable credit to record utang.");
            if (request.OnCredit && sale.Credit <= 0) throw new BusinessException("Credit checkout requires an outstanding amount.");
            if (request.CustomerId != null)
            {
                var customer = await db.Customers.SingleOrDefaultAsync(x => x.Id == request.CustomerId && x.Active, ct) ?? throw new BusinessException("Customer is unavailable.");
                sale.CustomerId = customer.Id;
                if (sale.Credit > 0)
                {
                    var balance = await Balance(customer.Id, ct);
                    if (customer.CreditLimit is { } limit && balance + sale.Credit > limit) throw new BusinessException("This sale would exceed the customer's credit limit.", 409);
                    db.CreditTransactions.Add(new CreditTransaction { CustomerId = customer.Id, Sale = sale, Amount = sale.Credit, ActorId = actor, Kind = "Charge" });
                }
            }
            else if (sale.Credit > 0) throw new BusinessException("A named customer is required for credit sales.");
            db.Sales.Add(sale);
            if (sale.Discount > 0) db.Discounts.Add(new Discount { Sale = sale, Amount = sale.Discount, AuthorizedBy = actor });
            if (sale.CashApplied > 0) db.Payments.Add(new Payment { RequestId = request.RequestId, ActorId = actor, CustomerId = sale.CustomerId, Sale = sale, Amount = sale.CashApplied, Kind = "CashSale" });
            writer.Audit(actor, "Sale.Checkout", sale.Reference);
            return sale;
        }, ct);
    }

    public Task<decimal> Balance(int customerId, CancellationToken ct = default) => db.CreditTransactions.Where(x => x.CustomerId == customerId).SumAsync(x => x.Amount, ct);

    public async Task<Payment> Repay(int customerId, RepayRequest request, string actor, CancellationToken ct)
    {
        Rules.RequestId(request.RequestId); Rules.MoneyInput(request.Amount);
        if (request.Amount <= 0) throw new BusinessException("Payment must be greater than zero.");
        return await writer.Run(async () =>
        {
            var old = await db.Payments.SingleOrDefaultAsync(x => x.RequestId == request.RequestId, ct);
            if (old != null)
            {
                if (old.CustomerId != customerId || old.Amount != request.Amount || old.Kind != "Repayment" || old.ActorId != actor)
                    throw new BusinessException("This payment key was already used for a different request.", 409);
                return old;
            }
            if (!await db.Customers.AnyAsync(x => x.Id == customerId, ct)) throw new BusinessException("Customer not found.", 404);
            var debts = await db.CreditTransactions.Where(x => x.CustomerId == customerId).GroupBy(x => x.SaleId)
                .Select(x => new { SaleId = x.Key, Balance = x.Sum(v => v.Amount) }).Where(x => x.Balance > 0).OrderBy(x => x.SaleId).ToListAsync(ct);
            if (request.Amount > debts.Sum(x => x.Balance)) throw new BusinessException("Payment exceeds the outstanding balance.");
            var payment = new Payment { RequestId = request.RequestId, CustomerId = customerId, Amount = request.Amount, ActorId = actor, Kind = "Repayment" };
            db.Payments.Add(payment);
            var remaining = request.Amount;
            foreach (var debt in debts)
            {
                if (remaining == 0) break;
                var amount = Math.Min(remaining, debt.Balance); remaining -= amount;
                db.CreditTransactions.Add(new CreditTransaction { CustomerId = customerId, SaleId = debt.SaleId, Payment = payment, Amount = -amount, Kind = "Repayment", ActorId = actor });
            }
            writer.Audit(actor, "Credit.Repay", $"Customer {customerId}; amount {request.Amount:0.00}");
            return payment;
        }, ct);
    }

    public async Task<Sale> Refund(long id, string reason, string actor, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 3) throw new BusinessException("A refund reason is required.");
        return await writer.Run(async () =>
        {
            var sale = await db.Sales.Include(x => x.Items).ThenInclude(x => x.Allocations).ThenInclude(x => x.Batch).SingleOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new BusinessException("Sale not found.", 404);
            if (sale.Status == "Refunded") return sale; // Full reversal is naturally idempotent.
            foreach (var item in sale.Items)
                foreach (var allocation in item.Allocations)
                {
                    allocation.Batch.Quantity += allocation.Quantity;
                    db.StockMovements.Add(new StockMovement
                    {
                        ProductId = item.ProductId,
                        BatchId = allocation.BatchId,
                        Quantity = allocation.Quantity,
                        Kind = "Refund",
                        Reason = reason.Trim(),
                        ActorId = actor,
                        SaleId = sale.Id
                    });
                }
            var outstanding = await db.CreditTransactions.Where(x => x.SaleId == id).SumAsync(x => x.Amount, ct);
            if (outstanding > 0 && sale.CustomerId != null)
                db.CreditTransactions.Add(new CreditTransaction { CustomerId = sale.CustomerId.Value, SaleId = id, Amount = -outstanding, Kind = "Refund", ActorId = actor });
            sale.Status = "Refunded"; sale.RefundedAt = DateTimeOffset.UtcNow; sale.RefundReason = reason.Trim(); sale.RefundCash = sale.Total - outstanding;
            if (sale.RefundCash > 0) db.Payments.Add(new Payment { RequestId = Guid.NewGuid(), ActorId = actor, SaleId = sale.Id, CustomerId = sale.CustomerId, Amount = -sale.RefundCash, Kind = "Refund" });
            writer.Audit(actor, "Sale.Refund", $"{sale.Reference}; {reason.Trim()}");
            return sale;
        }, ct);
    }
}
