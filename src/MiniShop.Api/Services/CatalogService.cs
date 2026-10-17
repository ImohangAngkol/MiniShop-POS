using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Services;

public sealed class CatalogService(ShopDb db, ShopWriter writer)
{
    public Task<Product> Save(int? id, ProductRequest r, string actor, CancellationToken ct) => writer.Run(async () =>
    {
        Rules.MoneyInput(r.CostPrice); Rules.MoneyInput(r.SellingPrice);
        if (r.LowStockThreshold < 0 || decimal.Round(r.LowStockThreshold, 3) != r.LowStockThreshold) throw new BusinessException("Invalid low-stock threshold.");
        if (string.IsNullOrWhiteSpace(r.Name) || string.IsNullOrWhiteSpace(r.Sku)) throw new BusinessException("Product name and SKU are required.");
        if (!await db.Categories.AnyAsync(x => x.Id == r.CategoryId, ct)) throw new BusinessException("Category not found.");
        var p = id == null ? new Product() : await db.Products.FindAsync([id.Value], ct) ?? throw new BusinessException("Product not found.", 404);
        if (id != null && p.Unit != r.Unit && await db.Batches.AnyAsync(x => x.ProductId == id, ct)) throw new BusinessException("Units cannot change after stock has been received. Create a new product instead.");
        p.Name = r.Name.Trim(); p.Sku = r.Sku.Trim().ToUpperInvariant(); p.Barcode = string.IsNullOrWhiteSpace(r.Barcode) ? null : r.Barcode.Trim();
        p.CategoryId = r.CategoryId; p.Unit = r.Unit; p.CostPrice = r.CostPrice; p.SellingPrice = r.SellingPrice; p.LowStockThreshold = r.LowStockThreshold; p.Active = r.Active;
        if (id == null) db.Products.Add(p);
        writer.Audit(actor, id == null ? "Product.Create" : "Product.Update", p.Sku);
        return p;
    }, ct);

    public Task<InventoryBatch> Receive(ReceiveRequest r, string actor, CancellationToken ct) => writer.Run(async () =>
    {
        var p = await db.Products.FindAsync([r.ProductId], ct) ?? throw new BusinessException("Product not found.", 404);
        if (!p.Active) throw new BusinessException("Activate the product before receiving stock.");
        Rules.Quantity(p.Unit, r.Quantity); Rules.MoneyInput(r.UnitCost);
        if (r.ExpiresOn < Rules.Today) throw new BusinessException("Cannot receive stock that has already expired.");
        var batch = new InventoryBatch { ProductId = p.Id, Reference = r.Reference.Trim(), Quantity = r.Quantity, UnitCost = r.UnitCost, ExpiresOn = r.ExpiresOn };
        db.Batches.Add(batch);
        db.StockMovements.Add(new StockMovement { ProductId = p.Id, Batch = batch, Quantity = r.Quantity, Kind = "Receive", Reason = r.Reference.Trim(), ActorId = actor });
        writer.Audit(actor, "Inventory.Receive", $"{p.Sku}; quantity {r.Quantity}");
        return batch;
    }, ct);

    public Task<InventoryBatch> Adjust(AdjustRequest r, string actor, CancellationToken ct) => writer.Run(async () =>
    {
        var batch = await db.Batches.Include(x => x.Product).SingleOrDefaultAsync(x => x.Id == r.BatchId, ct) ?? throw new BusinessException("Batch not found.", 404);
        Rules.Quantity(batch.Product.Unit, r.Quantity, true);
        if (batch.Quantity + r.Quantity < 0) throw new BusinessException("Adjustment would create negative stock.", 409);
        batch.Quantity += r.Quantity;
        db.StockMovements.Add(new StockMovement { ProductId = batch.ProductId, BatchId = batch.Id, Quantity = r.Quantity, Kind = "Adjustment", Reason = r.Reason.Trim(), ActorId = actor });
        writer.Audit(actor, "Inventory.Adjust", $"Batch {batch.Id}; quantity {r.Quantity}; {r.Reason.Trim()}");
        return batch;
    }, ct);
}
