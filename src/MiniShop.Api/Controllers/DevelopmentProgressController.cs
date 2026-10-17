using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiniShop.Api.Services;

namespace MiniShop.Api.Controllers;

[ApiController, Authorize(Roles = "Owner"), Route("api/admin/development-progress")]
public sealed class DevelopmentProgressController(DevelopmentProgressReader progress) : ControllerBase
{
    [HttpGet]
    public Task<JsonElement> Get(CancellationToken ct) => progress.Read(ct);
}
