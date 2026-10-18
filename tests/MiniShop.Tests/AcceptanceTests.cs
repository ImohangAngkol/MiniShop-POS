using Microsoft.Extensions.Configuration;
using MiniShop.Api.Authentication;

namespace MiniShop.Tests;

public sealed class AcceptanceTests
{
    private static Dictionary<string, string?> Settings() => new()
    {
        ["ConnectionStrings:Shop"] = "Host=127.0.0.1;Port=55433;Database=minishop_acceptance;Username=minishop_acceptance_app",
        ["Bootstrap:Enabled"] = "false",
        ["AllowedHosts"] = "127.0.0.1;localhost",
        ["DataProtection:ApplicationName"] = "MiniShop.SoftwareAcceptance",
        ["DataProtection:Directory"] = "private-acceptance-keys"
    };
    [Fact]
    public void Fictional_acceptance_uses_a_dedicated_loopback_profile() => AcceptanceSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(Settings()).Build(), "https://127.0.0.1:5843");

    [Theory]
    [InlineData("https://0.0.0.0:5843", "AllowedHosts", "127.0.0.1;localhost")]
    [InlineData("http://127.0.0.1:5843", "AllowedHosts", "127.0.0.1;localhost")]
    [InlineData("https://127.0.0.1:5843", "ConnectionStrings:Shop", "Host=127.0.0.1;Port=55433;Database=minishop_staging;Username=minishop_staging_app")]
    [InlineData("https://127.0.0.1:5843", "ConnectionStrings:Shop", "Host=127.0.0.1;Port=55433;Database=minishop_acceptance;Username=minishop_staging_admin")]
    [InlineData("https://127.0.0.1:5843", "Bootstrap:Enabled", "true")]
    [InlineData("https://127.0.0.1:5843", "Database:AutoMigrate", "true")]
    [InlineData("https://127.0.0.1:5843", "Lan:Enabled", "true")]
    [InlineData("https://127.0.0.1:5843", "Kestrel:Endpoints:Http:Url", "http://0.0.0.0:5000")]
    [InlineData("https://127.0.0.1:5843", "AllowedHosts", "*")]
    [InlineData("https://127.0.0.1:5843", "DataProtection:ApplicationName", "MiniShop.Staging")]
    public void Acceptance_rejects_shared_database_elevated_role_and_network_exposure(string urls, string key, string value)
    {
        var settings = Settings(); settings[key] = value;
        Assert.Throws<InvalidOperationException>(() => AcceptanceSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), urls));
    }
}
