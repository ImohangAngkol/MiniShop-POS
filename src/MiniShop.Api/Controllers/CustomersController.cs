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

[ApiController, Authorize, Route("api/customers")]
public sealed class CustomersController(ShopDb db, ShopWriter writer, CommerceService commerce) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(string? search, CancellationToken ct)
    {
        var q = db.Customers.AsNoTracking(); if (!string.IsNullOrWhiteSpace(search)) q = q.Where(x => x.Name.ToLower().Contains(search.ToLower()));
        return await q.OrderBy(x => x.Name).Take(500).Select(x => new { x.Id, x.Name, x.Contact, x.CreditLimit, x.Active, Balance = db.CreditTransactions.Where(c => c.CustomerId == x.Id).Sum(c => c.Amount) }).ToListAsync(ct);
    }
    [HttpPost]
    public Task<Customer> Create(CustomerRequest r, CancellationToken ct) => Save(null, r, ct);
    [HttpPut("{id:int}"), Authorize(Roles = "Owner")]
    public Task<Customer> Update(int id, CustomerRequest r, CancellationToken ct) => Save(id, r, ct);
    private Task<Customer> Save(int? id, CustomerRequest r, CancellationToken ct) => writer.Run(async () =>
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new BusinessException("Customer name is required.");
        if (r.CreditLimit != null) Rules.MoneyInput(r.CreditLimit.Value);
        if (!User.IsOwner() && (r.CreditLimit != null || !r.Active)) throw new BusinessException("Only owners can set credit limits or deactivate customers.", 403);
        var c = id == null ? new Customer() : await db.Customers.FindAsync([id.Value], ct) ?? throw new BusinessException("Customer not found.", 404);
        if (r.CreditLimit != null && r.CreditLimit < await commerce.Balance(c.Id, ct)) throw new BusinessException("Credit limit cannot be lower than the existing balance.");
        c.Name = r.Name.Trim(); c.Contact = r.Contact?.Trim(); c.CreditLimit = r.CreditLimit; c.Active = r.Active;
        if (id == null) db.Customers.Add(c); writer.Audit(User.EmployeeId(), id == null ? "Customer.Create" : "Customer.Update", $"Customer {c.Id}"); return c;
    }, ct);
    [HttpGet("{id:int}/ledger")]
    public async Task<object> Ledger(int id, CancellationToken ct) => new { balance = await commerce.Balance(id, ct), items = await db.CreditTransactions.AsNoTracking().Where(x => x.CustomerId == id).OrderByDescending(x => x.Id).Take(500).Select(x => new { x.Id, x.SaleId, Reference = x.Sale.Reference, x.Amount, x.Kind, x.CreatedAt, x.ActorId }).ToListAsync(ct) };
    [HttpPost("{id:int}/repayments")]
    public async Task<object> Repay(int id, RepayRequest r, CancellationToken ct) { var p = await commerce.Repay(id, r, User.EmployeeId(), ct); return new { p.Id, p.Amount, Balance = await commerce.Balance(id, ct) }; }
}
