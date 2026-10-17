using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MiniShop.Api.DTOs;

namespace MiniShop.Tests;

[Collection("PostgreSQL")]
public sealed class ApiTests(DatabaseFixture fixture)
{
    private async Task<HttpClient> Login(bool owner)
    {
        var client = fixture.Factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await Csrf(client); var r = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(owner ? "test-owner@example.test" : "test-cashier@example.test", fixture.Password)); r.EnsureSuccessStatusCode(); await Csrf(client); return client;
    }
    private static async Task Csrf(HttpClient client) { var token = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf"); client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString()); }
    [Fact]
    public async Task Health_responds_and_protected_routes_require_authentication()
    {
        using var client = fixture.Factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false }); Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health")).StatusCode); Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/products")).StatusCode);
    }
    [Fact] public async Task Mutation_without_csrf_token_is_rejected() { using var client = await Login(true); client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/categories", new { name = "No csrf" })).StatusCode); }
    [Fact]
    public async Task Cashier_cannot_access_admin_routes_or_set_credit_limits()
    {
        using var client = await Login(false);
        foreach (var path in new[] { "/api/employees", "/api/inventory/batches", "/api/reports/dashboard", "/api/settings/audit" }) Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/customers", new CustomerRequest("Test", null, 100))).StatusCode);
    }
    [Fact]
    public async Task Product_create_update_deactivate_and_validation_work()
    {
        using var client = await Login(true); var category = await client.PostAsJsonAsync("/api/categories", new { name = "API " + Guid.NewGuid() }); category.EnsureSuccessStatusCode(); var c = await category.Content.ReadFromJsonAsync<JsonElement>();
        var barcode = "BC" + Guid.NewGuid().ToString("N").ToUpperInvariant();
        var body = new ProductRequest("API Test", Guid.NewGuid().ToString("N"), barcode, c.GetProperty("id").GetInt32(), "piece", 4, 10, 2);
        var created = await client.PostAsJsonAsync("/api/products", body); created.EnsureSuccessStatusCode(); var p = await created.Content.ReadFromJsonAsync<JsonElement>(); var id = p.GetProperty("id").GetInt32();
        var found = await client.GetFromJsonAsync<JsonElement>("/api/products?search=" + barcode.ToLowerInvariant()); Assert.Equal(1, found.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/products/{id}", body with { SellingPrice = 12 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/products", body with { SellingPrice = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/products/{id}")).StatusCode);
        var list = await client.GetFromJsonAsync<JsonElement>($"/api/products?search={body.Sku}&includeInactive=true"); Assert.False(list.GetProperty("items")[0].GetProperty("active").GetBoolean());
    }
    [Fact]
    public async Task Receipt_pdf_is_downloadable_and_cashier_cannot_read_another_cashiers_sale()
    {
        var p = await fixture.Product(); using var owner = await Login(true); var response = await owner.PostAsJsonAsync("/api/sales", new CheckoutRequest(Guid.NewGuid(), [new(p, 1)], 0, 100, null, false)); response.EnsureSuccessStatusCode(); var sale = await response.Content.ReadFromJsonAsync<JsonElement>(); var id = sale.GetProperty("id").GetInt64();
        var pdf = await owner.GetAsync($"/api/sales/{id}/pdf"); Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType); Assert.True((await pdf.Content.ReadAsByteArrayAsync()).Length > 500);
        using var cashier = await Login(false); Assert.Equal(HttpStatusCode.Forbidden, (await cashier.GetAsync($"/api/sales/{id}")).StatusCode);
    }
}
