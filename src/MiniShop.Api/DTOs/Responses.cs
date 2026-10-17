using MiniShop.Api.Entities;

namespace MiniShop.Api.DTOs;

public static class Responses
{
    public static object Sale(Sale s) => new
    {
        s.Id,
        s.Reference,
        s.CashierId,
        s.CashierName,
        s.CustomerId,
        CustomerName = s.Customer?.Name,
        s.CreatedAt,
        s.Subtotal,
        s.Discount,
        s.Total,
        s.CashReceived,
        s.CashApplied,
        s.Change,
        s.Credit,
        s.Status,
        s.RefundedAt,
        s.RefundReason,
        s.RefundCash,
        Items = s.Items.Select(x => new { x.ProductId, x.Name, x.Sku, x.Unit, x.Quantity, x.UnitPrice, x.LineTotal })
    };
}
