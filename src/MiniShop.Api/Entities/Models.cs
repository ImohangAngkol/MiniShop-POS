using Microsoft.AspNetCore.Identity;

namespace MiniShop.Api.Entities;

public sealed class Employee : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public bool Active { get; set; } = true;
}
public sealed class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
public sealed class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Sku { get; set; } = "";
    public string? Barcode { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string Unit { get; set; } = "piece";
    public decimal CostPrice { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal LowStockThreshold { get; set; } = 5;
    public bool Active { get; set; } = true;
    public List<InventoryBatch> Batches { get; set; } = [];
}
public sealed class InventoryBatch
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Reference { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public DateOnly? ExpiresOn { get; set; }
    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class StockMovement
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public long BatchId { get; set; }
    public InventoryBatch Batch { get; set; } = null!;
    public decimal Quantity { get; set; }
    public string Kind { get; set; } = "";
    public string Reason { get; set; } = "";
    public string ActorId { get; set; } = "";
    public long? SaleId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Contact { get; set; }
    public decimal? CreditLimit { get; set; }
    public bool Active { get; set; } = true;
}
public sealed class Sale
{
    public long Id { get; set; }
    public string Reference { get; set; } = "";
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public string CashierId { get; set; } = "";
    public string CashierName { get; set; } = "";
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal CashReceived { get; set; }
    public decimal CashApplied { get; set; }
    public decimal Change { get; set; }
    public decimal Credit { get; set; }
    public decimal CostTotal { get; set; }
    public string Status { get; set; } = "Completed";
    public DateTimeOffset? RefundedAt { get; set; }
    public string? RefundReason { get; set; }
    public decimal RefundCash { get; set; }
    public List<SaleItem> Items { get; set; } = [];
}
public sealed class SaleItem
{
    public long Id { get; set; }
    public long SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public int ProductId { get; set; }
    public string Name { get; set; } = "";
    public string Sku { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal CostTotal { get; set; }
    public List<SaleAllocation> Allocations { get; set; } = [];
}
public sealed class SaleAllocation
{
    public long Id { get; set; }
    public long SaleItemId { get; set; }
    public SaleItem SaleItem { get; set; } = null!;
    public long BatchId { get; set; }
    public InventoryBatch Batch { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
}
public sealed class Payment
{
    public long Id { get; set; }
    public Guid RequestId { get; set; }
    public string ActorId { get; set; } = "";
    public int? CustomerId { get; set; }
    public long? SaleId { get; set; }
    public Sale? Sale { get; set; }
    public string Kind { get; set; } = "CashSale";
    public decimal Amount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Discount
{
    public long Id { get; set; }
    public long SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public decimal Amount { get; set; }
    public string AuthorizedBy { get; set; } = "";
}
public sealed class CreditTransaction
{
    public long Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public long SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public long? PaymentId { get; set; }
    public Payment? Payment { get; set; }
    public decimal Amount { get; set; }
    public string Kind { get; set; } = "Charge";
    public string ActorId { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class AuditLog
{
    public long Id { get; set; }
    public string ActorId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class StoreSettings
{
    public int Id { get; set; } = 1;
    public string StoreName { get; set; } = "MiniShop";
    public string Contact { get; set; } = "";
    public string Address { get; set; } = "";
    public string ReceiptFooter { get; set; } = "Thank you! Please come again.";
    public int ThermalWidthMm { get; set; } = 80;
    public bool DemoData { get; set; }
}
