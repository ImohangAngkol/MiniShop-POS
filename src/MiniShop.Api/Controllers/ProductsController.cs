using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Authentication;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;

namespace MiniShop.Api.Controllers;

[ApiController, Authorize, Route("api/products")]
public sealed class ProductsController(ShopDb db, CatalogService catalog, ShopWriter writer) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(string? search, int? categoryId, bool includeInactive = false, int page = 1, int pageSize = 100, CancellationToken ct = default)
    {
        var today = Rules.Today; var owner = User.IsOwner();
        var query = db.Products.AsNoTracking().Where(x => (includeInactive || x.Active) && (categoryId == null || x.CategoryId == categoryId));
        if (!string.IsNullOrWhiteSpace(search)) { var s = search.Trim().ToLower(); query = query.Where(x => x.Name.ToLower().Contains(s) || x.Sku.ToLower().Contains(s) || (x.Barcode != null && x.Barcode.ToLower().Contains(s))); }
        var total = await query.CountAsync(ct); pageSize = Math.Clamp(pageSize, 1, 200); page = Math.Max(page, 1);
        var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new
        {
            x.Id,
            x.Name,
            x.Sku,
            x.Barcode,
            x.CategoryId,
            CategoryName = x.Category.Name,
            x.Unit,
            CostPrice = owner ? x.CostPrice : (decimal?)null,
            x.SellingPrice,
            x.LowStockThreshold,
            x.Active,
            Stock = x.Batches.Sum(b => b.Quantity),
            AvailableStock = x.Batches.Where(b => b.ExpiresOn == null || b.ExpiresOn >= today).Sum(b => b.Quantity)
        }).ToListAsync(ct);
        return new { items, total, page, pageSize };
    }
    [HttpPost, Authorize(Roles = "Owner")]
    public async Task<object> Create(ProductRequest r, CancellationToken ct) { var p = await catalog.Save(null, r, User.EmployeeId(), ct); return new { p.Id }; }
    [HttpPut("{id:int}"), Authorize(Roles = "Owner")]
    public async Task<IActionResult> Update(int id, ProductRequest r, CancellationToken ct) { await catalog.Save(id, r, User.EmployeeId(), ct); return NoContent(); }
    [HttpDelete("{id:int}"), Authorize(Roles = "Owner")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        await writer.Run(async () => { var p = await db.Products.FindAsync([id], ct) ?? throw new BusinessException("Product not found.", 404); p.Active = false; writer.Audit(User.EmployeeId(), "Product.Deactivate", p.Sku); return true; }, ct); return NoContent();
    }
}
[ApiController, Authorize, Route("api/categories")]
public sealed class CategoriesController(ShopDb db, ShopWriter writer) : ControllerBase
{
    [HttpGet] public Task<List<Category>> List(CancellationToken ct) => db.Categories.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
    [HttpPost, Authorize(Roles = "Owner")]
    public Task<Category> Create(CategoryRequest r, CancellationToken ct) => writer.Run(() =>
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new BusinessException("Category name is required.");
        var c = new Category { Name = r.Name.Trim() }; db.Categories.Add(c); writer.Audit(User.EmployeeId(), "Category.Create", c.Name); return Task.FromResult(c);
    }, ct);
}
[ApiController, Authorize(Roles = "Owner"), Route("api/inventory")]
public sealed class InventoryController(ShopDb db, CatalogService catalog) : ControllerBase
{
    [HttpGet("batches")]
    public async Task<object> Batches(int? productId, CancellationToken ct) => await db.Batches.AsNoTracking().Where(x => productId == null || x.ProductId == productId)
        .OrderByDescending(x => x.Id).Take(500).Select(x => new { x.Id, x.ProductId, ProductName = x.Product.Name, x.Product.Unit, x.Reference, x.Quantity, x.UnitCost, x.ExpiresOn, x.ReceivedAt }).ToListAsync(ct);
    [HttpGet("movements")]
    public async Task<object> Movements(int? productId, int page = 1, CancellationToken ct = default) => await db.StockMovements.AsNoTracking().Where(x => productId == null || x.ProductId == productId)
        .OrderByDescending(x => x.Id).Skip((Math.Max(1, page) - 1) * 100).Take(100).Select(x => new { x.Id, x.ProductId, ProductName = x.Batch.Product.Name, x.BatchId, x.Quantity, x.Kind, x.Reason, x.ActorId, x.CreatedAt }).ToListAsync(ct);
    [HttpPost("receive")]
    public async Task<object> Receive(ReceiveRequest r, CancellationToken ct) { var b = await catalog.Receive(r, User.EmployeeId(), ct); return new { b.Id, b.Quantity }; }
    [HttpPost("adjust")]
    public async Task<object> Adjust(AdjustRequest r, CancellationToken ct) { var b = await catalog.Adjust(r, User.EmployeeId(), ct); return new { b.Id, b.Quantity }; }
}
