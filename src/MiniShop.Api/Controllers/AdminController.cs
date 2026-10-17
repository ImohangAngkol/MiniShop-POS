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

[ApiController, Authorize(Roles = "Owner"), Route("api/employees")]
public sealed class EmployeesController(ShopDb db, UserManager<Employee> users, ShopWriter writer) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(CancellationToken ct) { var list = await db.Users.AsNoTracking().OrderBy(x => x.DisplayName).ToListAsync(ct); var result = new List<object>(); foreach (var u in list) result.Add(new { u.Id, u.Email, u.DisplayName, u.Active, Roles = await users.GetRolesAsync(u) }); return result; }
    [HttpPost]
    public Task<object> Create(EmployeeRequest r, CancellationToken ct) => writer.Run<object>(async () =>
    {
        var u = new Employee { Email = r.Email.Trim(), UserName = r.Email.Trim(), DisplayName = r.DisplayName.Trim(), EmailConfirmed = true };
        var result = await users.CreateAsync(u, r.Password); if (!result.Succeeded) throw new BusinessException(string.Join(" ", result.Errors.Select(x => x.Description)));
        var role = await users.AddToRoleAsync(u, r.Role); if (!role.Succeeded) throw new BusinessException("Unable to assign role.");
        writer.Audit(User.EmployeeId(), "Employee.Create", u.Id); return new { u.Id };
    }, ct);
    [HttpPut("{id}/status")]
    public async Task<IActionResult> Status(string id, EmployeeStatusRequest r, CancellationToken ct)
    {
        if (id == User.EmployeeId()) throw new BusinessException("You cannot deactivate your own account.");
        await writer.Run(async () => { var u = await users.FindByIdAsync(id) ?? throw new BusinessException("Employee not found.", 404); u.Active = r.Active; await users.UpdateSecurityStampAsync(u); writer.Audit(User.EmployeeId(), "Employee.Status", $"{id}; active={r.Active}"); return true; }, ct); return NoContent();
    }
    [HttpPut("{id}/password")]
    public async Task<IActionResult> Password(string id, PasswordRequest r, CancellationToken ct)
    {
        await writer.Run(async () => { var u = await users.FindByIdAsync(id) ?? throw new BusinessException("Employee not found.", 404); var token = await users.GeneratePasswordResetTokenAsync(u); var result = await users.ResetPasswordAsync(u, token, r.Password); if (!result.Succeeded) throw new BusinessException(string.Join(" ", result.Errors.Select(x => x.Description))); writer.Audit(User.EmployeeId(), "Employee.PasswordReset", id); return true; }, ct); return NoContent();
    }
}
[ApiController, Authorize, Route("api/settings")]
public sealed class SettingsController(ShopDb db, ShopWriter writer) : ControllerBase
{
    [HttpGet] public Task<StoreSettings> Get(CancellationToken ct) => db.Settings.AsNoTracking().SingleAsync(ct);
    [HttpPut, Authorize(Roles = "Owner")]
    public async Task<IActionResult> Save(SettingsRequest r, CancellationToken ct)
    {
        if (r.ThermalWidthMm != 58 && r.ThermalWidthMm != 80) throw new BusinessException("Thermal width must be 58 or 80 mm.");
        await writer.Run(async () => { var s = await db.Settings.SingleAsync(ct); s.StoreName = r.StoreName.Trim(); s.Address = r.Address.Trim(); s.Contact = r.Contact.Trim(); s.ReceiptFooter = r.ReceiptFooter.Trim(); s.ThermalWidthMm = r.ThermalWidthMm; writer.Audit(User.EmployeeId(), "Settings.Update", "Receipt configuration"); return true; }, ct); return NoContent();
    }
    [HttpGet("audit"), Authorize(Roles = "Owner")]
    public async Task<object> Audit(int page = 1, CancellationToken ct = default) => await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.Id).Skip((Math.Max(1, page) - 1) * 100).Take(100).ToListAsync(ct);
}
