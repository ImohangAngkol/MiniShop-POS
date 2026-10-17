using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MiniShop.Api.Authentication;
using MiniShop.Api.DTOs;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;
using MiniShop.Api.Data;

namespace MiniShop.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(UserManager<Employee> users, SignInManager<Employee> signIn, IAntiforgery csrf, ShopWriter writer, ShopDb db) : ControllerBase
{
    [HttpGet("csrf"), AllowAnonymous]
    public object Csrf() => new { token = csrf.GetAndStoreTokens(HttpContext).RequestToken };
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest r)
    {
        var user = await users.FindByEmailAsync(r.Email);
        var result = user is { Active: true } ? await signIn.PasswordSignInAsync(user, r.Password, false, true) : Microsoft.AspNetCore.Identity.SignInResult.Failed;
        if (!result.Succeeded) return Unauthorized(new ProblemDetails { Title = "Unable to sign in. Check credentials, account status, or wait if locked out.", Status = 401 });
        writer.Audit(user!.Id, "Auth.Login", "Successful sign-in"); await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Email, user.DisplayName, Roles = await users.GetRolesAsync(user) });
    }
    [HttpGet("me"), Authorize]
    public async Task<object> Me() { var user = (await users.FindByIdAsync(User.EmployeeId()))!; return new { user.Id, user.Email, user.DisplayName, Roles = await users.GetRolesAsync(user) }; }
    [HttpPost("logout"), Authorize]
    public async Task<IActionResult> Logout() { writer.Audit(User.EmployeeId(), "Auth.Logout", "Sign-out"); await db.SaveChangesAsync(); await signIn.SignOutAsync(); return NoContent(); }
}
