using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiniShop.Api.Business;
using MiniShop.Api.Services;

namespace MiniShop.Api.Controllers;

[ApiController, Authorize(Roles = "Owner"), Route("api/reports")]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    [HttpGet("dashboard")] public Task<object> Dashboard(CancellationToken ct) => reports.Dashboard(ct);
    [HttpGet("sales")] public Task<object> Sales(DateOnly? from, DateOnly? to, CancellationToken ct) => reports.Sales(from ?? Rules.Today.AddDays(-6), to ?? Rules.Today, ct);
    [HttpGet("inventory")] public Task<object> Inventory(CancellationToken ct) => reports.Inventory(ct);
    [HttpGet("export/{kind}")] public async Task<IActionResult> Export(string kind, DateOnly? from, DateOnly? to, CancellationToken ct) => File(await reports.Export(kind, from ?? Rules.Today.AddDays(-6), to ?? Rules.Today, ct), "text/csv; charset=utf-8", $"minishop-{kind}-{Rules.Today:yyyyMMdd}.csv");
}
