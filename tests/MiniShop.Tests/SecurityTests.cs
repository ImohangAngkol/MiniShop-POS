using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using MiniShop.Api.Authentication;
using MiniShop.Api.Data;
using MiniShop.Api.DTOs;
using Npgsql;

namespace MiniShop.Tests;

[Collection("PostgreSQL")]
public sealed class SecurityTests(DatabaseFixture fixture) : IDisposable
{
    // Separate limiter state per test without weakening the real application policy.
    private readonly Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory = fixture.CreateFactory();
    public void Dispose() => factory.Dispose();
    private HttpClient Client() => factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
    private static async Task Csrf(HttpClient client)
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
    }
    private async Task Login(HttpClient client, string email, string? password = null)
    {
        await Csrf(client);
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password ?? fixture.Password))).EnsureSuccessStatusCode();
        await Csrf(client);
    }
    [Fact]
    public async Task Runtime_role_passes_and_cluster_administrator_is_rejected()
    {
        await RuntimeDatabasePolicy.VerifyAsync(fixture.Connection);
        await Assert.ThrowsAsync<InvalidOperationException>(() => RuntimeDatabasePolicy.VerifyAsync(fixture.OwnerConnection));
    }
    [Theory]
    [InlineData("CREATE TABLE public.forbidden (id integer)")]
    [InlineData("CREATE TEMP TABLE forbidden (id integer)")]
    [InlineData("CREATE DATABASE minishop_forbidden")]
    [InlineData("ALTER TABLE \"Products\" ADD COLUMN forbidden integer")]
    [InlineData("TRUNCATE \"AuditLogs\"")]
    [InlineData("DELETE FROM \"Sales\" WHERE false")]
    [InlineData("UPDATE \"Sales\" SET \"Total\" = 0 WHERE false")]
    [InlineData("UPDATE \"Payments\" SET \"Amount\" = 0 WHERE false")]
    [InlineData("DELETE FROM \"__EFMigrationsHistory\" WHERE false")]
    public async Task Runtime_cannot_administer_schema_or_rewrite_financial_history(string sql)
    {
        await using var connection = new NpgsqlConnection(fixture.Connection); await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        var error = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }
    [Fact]
    public async Task Cookies_headers_CORS_and_forged_csrf_are_secure()
    {
        using var client = Client(); await Csrf(client);
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("test-owner@example.test", fixture.Password));
        login.EnsureSuccessStatusCode();
        var cookie = Assert.Single(login.Headers.GetValues("Set-Cookie"), x => x.StartsWith("MiniShop.Session="));
        Assert.Contains("secure", cookie.ToLowerInvariant()); Assert.Contains("httponly", cookie.ToLowerInvariant()); Assert.Contains("samesite=strict", cookie.ToLowerInvariant());
        Assert.DoesNotContain("expires=", cookie.ToLowerInvariant());
        Assert.True(login.Headers.CacheControl?.NoStore);
        Assert.Equal("DENY", login.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("frame-ancestors 'none'", login.Headers.GetValues("Content-Security-Policy").Single());
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/products");
        request.Headers.Add("Origin", "https://untrusted.example.test"); request.Headers.Add("Access-Control-Request-Method", "POST");
        Assert.False((await client.SendAsync(request)).Headers.Contains("Access-Control-Allow-Origin"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", "forged");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/categories", new { name = "Forged" })).StatusCode);
    }
    [Fact]
    public async Task Login_is_rate_limited_after_fifteen_requests()
    {
        using var client = Client(); await Csrf(client);
        for (var attempt = 0; attempt < 15; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("absent@example.test", "Incorrect!9a"))).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("absent@example.test", "Incorrect!9a"))).StatusCode);
    }
    [Fact]
    public async Task Employee_deactivation_reactivation_password_reset_and_logout_revoke_sessions()
    {
        using var owner = Client(); await Login(owner, "test-owner@example.test");
        var email = "fictional-" + Guid.NewGuid().ToString("N") + "@example.test";
        var create = await owner.PostAsJsonAsync("/api/employees", new { email, displayName = "Fictional security test", password = fixture.Password, role = "Cashier" });
        create.EnsureSuccessStatusCode(); var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        using var first = Client(); using var second = Client(); await Login(first, email); await Login(second, email);
        (await owner.PutAsJsonAsync($"/api/employees/{id}/status", new { active = false })).EnsureSuccessStatusCode();
        foreach (var client in new[] { first, second }) Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        (await owner.PutAsJsonAsync($"/api/employees/{id}/status", new { active = true })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync("/api/auth/me")).StatusCode);
        await Login(first, email); await Login(second, email);
        var replacement = "Replacement!9a" + Guid.NewGuid().ToString("N");
        (await owner.PutAsJsonAsync($"/api/employees/{id}/password", new { password = replacement })).EnsureSuccessStatusCode();
        foreach (var client in new[] { first, second }) Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        await Csrf(first); Assert.Equal(HttpStatusCode.Unauthorized, (await first.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, fixture.Password))).StatusCode);
        await Login(first, email, replacement); (await first.PostAsync("/api/auth/logout", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync("/api/auth/me")).StatusCode);
    }
    [Fact]
    public async Task Five_failed_password_attempts_lock_out_a_fictional_employee()
    {
        using var owner = Client(); await Login(owner, "test-owner@example.test");
        var email = "lockout-" + Guid.NewGuid().ToString("N") + "@example.test";
        (await owner.PostAsJsonAsync("/api/employees", new { email, displayName = "Fictional lockout test", password = fixture.Password, role = "Cashier" })).EnsureSuccessStatusCode();
        using var client = Client(); await Csrf(client);
        for (var attempt = 0; attempt < 5; attempt++) Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "Incorrect!9a"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, fixture.Password))).StatusCode);
        await using var db = fixture.Db();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(db.Users, x => x.Email == email);
        Assert.True(user.LockoutEnd > DateTimeOffset.UtcNow.AddMinutes(14));
        // Advance only this fictional account's lockout deadline; no wall-clock wait or production override.
        user.LockoutEnd = DateTimeOffset.UtcNow.AddSeconds(-1); await db.SaveChangesAsync();
        await Login(client, email);
    }
}

public sealed class LocalStagingConfigurationTests
{
    private static Dictionary<string, string?> Valid() => new()
    {
        ["ConnectionStrings:Shop"] = "Host=127.0.0.1;Port=55433;Database=minishop_staging;Username=minishop_staging_app",
        ["Bootstrap:Enabled"] = "false",
        ["Database:AutoMigrate"] = "false",
        ["DataProtection:Directory"] = "private-staging-keys"
    };
    [Fact]
    public void Isolated_loopback_profile_is_accepted() => LocalStagingSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(Valid()).Build(), "https://localhost:5443");
    [Theory]
    [InlineData("ConnectionStrings:Shop", "Host=127.0.0.1;Port=55432;Database=minishop;Username=minishop")]
    [InlineData("Bootstrap:Enabled", "true")]
    [InlineData("Bootstrap:Password", "forbidden-bootstrap-secret")]
    [InlineData("Database:AutoMigrate", "true")]
    [InlineData("DataProtection:Directory", "")]
    [InlineData("Kestrel:Endpoints:Http:Url", "http://0.0.0.0:5443")]
    public void Staging_rejects_development_targets_bootstrap_and_endpoint_overrides(string name, string value)
    {
        var settings = Valid(); settings[name] = value;
        Assert.Throws<InvalidOperationException>(() => LocalStagingSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), "https://localhost:5443"));
    }
    [Theory]
    [InlineData("http://localhost:5443")]
    [InlineData("https://0.0.0.0:5443")]
    [InlineData("https://localhost:5443;http://localhost:5080")]
    public void Local_staging_rejects_plaintext_or_network_exposure(string urls)
    {
        var config = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => LocalStagingSecurity.Validate(config, urls));
    }
}
