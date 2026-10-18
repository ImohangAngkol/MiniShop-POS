using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Authentication;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;

namespace MiniShop.Api.Controllers;

[ApiController, Authorize, Route("api/sales")]
public sealed class SalesController(ShopDb db, CommerceService commerce, UserManager<Employee> users, IReceiptRenderer receipts) : ControllerBase
{
    [HttpPost]
    public async Task<object> Checkout(CheckoutRequest r, CancellationToken ct) { var u = (await users.FindByIdAsync(User.EmployeeId()))!; return Responses.Sale(await commerce.Checkout(r, u.Id, u.DisplayName, User.IsOwner(), ct)); }
    [HttpGet]
    public async Task<object> List(DateOnly? from, DateOnly? to, string? search, int page = 1, CancellationToken ct = default)
    {
        var (start, end) = Rules.Period(from ?? Rules.Today.AddDays(-30), to ?? Rules.Today);
        var q = db.Sales.AsNoTracking().Include(x => x.Customer).Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        if (!User.IsOwner()) { var id = User.EmployeeId(); q = q.Where(x => x.CashierId == id); }
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(x => x.Reference.Contains(search));
        var total = await q.CountAsync(ct); var items = await q.OrderByDescending(x => x.Id).Skip((Math.Max(1, page) - 1) * 50).Take(50).ToListAsync(ct);
        return new { total, items = items.Select(Responses.Sale) };
    }
    [HttpGet("{id:long}")]
    public async Task<object> Get(long id, CancellationToken ct) => Responses.Sale(await Find(id, ct));
    [HttpGet("{id:long}/pdf")]
    public async Task<IActionResult> Pdf(long id, CancellationToken ct, int? paperWidth = null)
    {
        if (paperWidth is not (null or 58 or 80)) throw new BusinessException("Receipt paper width must be 58 or 80 mm.");
        var s = await Find(id, ct); var store = await db.Settings.AsNoTracking().SingleAsync(ct);
        if (paperWidth != null) store.ThermalWidthMm = paperWidth.Value; // Untracked preview only; never changes store settings.
        return File(receipts.Pdf(s, store), "application/pdf", s.Reference + ".pdf");
    }
    [HttpPost("{id:long}/refund"), Authorize(Roles = "Owner")]
    public async Task<object> Refund(long id, RefundRequest r, CancellationToken ct) => Responses.Sale(await commerce.Refund(id, r.Reason, User.EmployeeId(), ct));
    private async Task<Sale> Find(long id, CancellationToken ct)
    {
        var s = await db.Sales.AsNoTracking().Include(x => x.Items).Include(x => x.Customer).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new BusinessException("Sale not found.", 404);
        if (!User.IsOwner() && s.CashierId != User.EmployeeId()) throw new BusinessException("You can only access your own sales.", 403);
        return s;
    }
}
