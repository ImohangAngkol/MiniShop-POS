using Microsoft.Extensions.Configuration;
using MiniShop.Api.Authentication;

namespace MiniShop.Tests;

public sealed class LanTests
{
    private static Dictionary<string, string?> Settings() => new()
    {
        ["Lan:ServerAddress"] = "192.168.1.11",
        ["Lan:ListenAddress"] = "127.0.0.1",
        ["Lan:HostName"] = "minishop.local",
        ["Lan:Port"] = "5643",
        ["AllowedHosts"] = "localhost;127.0.0.1;192.168.1.11;minishop.local",
        ["ConnectionStrings:Shop"] = "Host=127.0.0.1;Port=55433;Database=minishop_lan;Username=minishop_lan_app",
        ["Bootstrap:Enabled"] = "false",
        ["DataProtection:Directory"] = "private-lan-keys",
        ["DataProtection:ApplicationName"] = "MiniShop.Lan"
    };
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("192.168.1.11")]
    public void Loopback_rehearsal_and_explicit_private_adapter_are_supported(string listen)
    {
        var config = Settings(); config["Lan:ListenAddress"] = listen;
        LanSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(config).Build(), $"https://{listen}:5643");
    }
    [Theory]
    [InlineData("0.0.0.0")]
    [InlineData("26.1.2.3")]
    [InlineData("8.8.8.8")]
    [InlineData("::")]
    [InlineData("2001:db8::1")]
    [InlineData("127.0.0.1")]
    public void Wildcard_public_VPN_and_nonprivate_server_addresses_are_rejected(string ip)
    {
        var settings = Settings(); settings["Lan:ServerAddress"] = ip;
        Assert.Throws<InvalidOperationException>(() => LanSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), "https://127.0.0.1:5643"));
    }
    [Theory]
    [InlineData("http://127.0.0.1:5643", "Lan:ListenAddress", "127.0.0.1")]
    [InlineData("https://0.0.0.0:5643", "Lan:ListenAddress", "0.0.0.0")]
    [InlineData("https://127.0.0.1:5643", "AllowedHosts", "*")]
    [InlineData("https://127.0.0.1:5643", "ConnectionStrings:Shop", "Host=192.168.1.11;Port=55433;Database=minishop_lan;Username=minishop_lan_app")]
    [InlineData("https://127.0.0.1:5643", "ConnectionStrings:Shop", "Host=127.0.0.1;Port=55433;Database=minishop_staging;Username=minishop_staging_app")]
    [InlineData("https://127.0.0.1:5643", "Bootstrap:Enabled", "true")]
    [InlineData("https://127.0.0.1:5643", "DataProtection:ApplicationName", "MiniShop.Staging")]
    [InlineData("https://127.0.0.1:5643", "Kestrel:Endpoints:Http:Url", "http://0.0.0.0:5000")]
    public void Unsafe_LAN_configuration_fails_closed(string urls, string key, string value)
    {
        var settings = Settings(); settings[key] = value;
        Assert.Throws<InvalidOperationException>(() => LanSecurity.Validate(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), urls));
    }
}
