using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
var connection = builder.Configuration.GetConnectionString("Shop") ?? throw new InvalidOperationException("Set ConnectionStrings__Shop. See docs/SETUP_GUIDE.md.");
builder.Services.AddDbContext<ShopDb>(o => o.UseNpgsql(connection));
builder.Services.AddIdentity<Employee, IdentityRole>(o =>
{
    o.Password.RequiredLength = 12; o.User.RequireUniqueEmail = true;
    o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<ShopDb>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "MiniShop.Session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromHours(8); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = async c =>
    {
        await SecurityStampValidator.ValidatePrincipalAsync(c);
        var id = c.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var db = c.HttpContext.RequestServices.GetRequiredService<ShopDb>();
        if (id == null || !await db.Users.AnyAsync(x => x.Id == id && x.Active)) { c.RejectPrincipal(); await c.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme); }
    };
});
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
// The built-in MVC antiforgery filter's services are supplied by AddControllersWithViews.
// We serve only API controllers; React owns all UI routes.
builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));
builder.Services.AddOpenApi(); builder.Services.AddProblemDetails(); builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddScoped<ShopWriter>(); builder.Services.AddScoped<CatalogService>(); builder.Services.AddScoped<CommerceService>();
builder.Services.AddScoped<ReportService>(); builder.Services.AddSingleton<IReceiptRenderer, ReceiptRenderer>();
builder.Services.AddSingleton<DevelopmentProgressReader>();
var keys = builder.Configuration["DataProtection:Directory"];
if (!string.IsNullOrWhiteSpace(keys))
{
    var protection = builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keys)).SetApplicationName("MiniShop");
    if (OperatingSystem.IsWindows()) protection.ProtectKeysWithDpapi();
}
var app = builder.Build();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "same-origin"; ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (BusinessException e) { await Results.Problem(statusCode: e.Status, title: e.Message).ExecuteAsync(ctx); }
    catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
    {
        await Results.Problem(statusCode: 409, title: "That SKU, barcode, category, email, or request key already exists.").ExecuteAsync(ctx);
    }
    catch (Exception e)
    {
        app.Logger.LogError(e, "Request failed {TraceId}", ctx.TraceIdentifier);
        await Results.Problem(statusCode: 500, title: "The operation failed. Retry only with the same request key where applicable.", extensions: new Dictionary<string, object?> { ["traceId"] = ctx.TraceIdentifier }).ExecuteAsync(ctx);
    }
});
if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseDefaultFiles(); app.UseStaticFiles(); app.UseRouting(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.MapControllers();
if (app.Environment.IsDevelopment()) app.MapOpenApi().RequireAuthorization();
app.MapGet("/api/health", async (ShopDb db, CancellationToken ct) =>
{
    try { return await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "healthy", database = "PostgreSQL" }) : Results.StatusCode(503); }
    catch { return Results.StatusCode(503); }
}).AllowAnonymous();
app.MapFallback(async ctx =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") || !HttpMethods.IsGet(ctx.Request.Method)) { ctx.Response.StatusCode = 404; return; }
    var file = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (File.Exists(file)) { ctx.Response.ContentType = "text/html"; await ctx.Response.SendFileAsync(file); } else ctx.Response.StatusCode = 404;
});
if (!app.Environment.IsEnvironment("Testing"))
{
    await using var scope = app.Services.CreateAsyncScope();
    if (builder.Configuration.GetValue<bool>("Database:AutoMigrate")) await scope.ServiceProvider.GetRequiredService<ShopDb>().Database.MigrateAsync();
    await Bootstrap.Initialize(scope.ServiceProvider, builder.Configuration);
}
await app.RunAsync();
public partial class Program { }
