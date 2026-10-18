using System.Net;
using Npgsql;

namespace MiniShop.Api.Authentication;

public static class LanSecurity
{
    public static bool IsPrivateIPv4(string? value)
    {
        if (!IPAddress.TryParse(value, out var ip) || ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork || ip.ToString() != value) return false;
        var bytes = ip.GetAddressBytes();
        return bytes[0] == 10 || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) || (bytes[0] == 192 && bytes[1] == 168);
    }

    public static void Validate(IConfiguration config, string? urls)
    {
        var server = config["Lan:ServerAddress"]; var listen = config["Lan:ListenAddress"];
        var name = config["Lan:HostName"] ?? "";
        if (!IsPrivateIPv4(server) || (listen != "127.0.0.1" && listen != server) || config.GetValue<int>("Lan:Port") != 5643
            || urls != $"https://{listen}:5643" || config.GetSection("Kestrel:Endpoints").GetChildren().Any())
            throw new InvalidOperationException("LAN acceptance permits only loopback rehearsal or one explicit RFC1918 IPv4 address over HTTPS port 5643; no wildcard, VPN/public or extra endpoints.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(local|home\.arpa)$"))
            throw new InvalidOperationException("Use a private DNS name under .local or .home.arpa for LAN acceptance; name resolution must be configured separately.");
        var allowed = (config["AllowedHosts"] ?? "").Split(';').ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!allowed.SetEquals(new[] { "localhost", "127.0.0.1", server!, name })) throw new InvalidOperationException("LAN AllowedHosts must exactly list the selected private IP/name and loopback rehearsal names.");
        var db = new NpgsqlConnectionStringBuilder(config.GetConnectionString("Shop"));
        if (db.Host != "127.0.0.1" || db.Port != 55433 || db.Database != "minishop_lan" || db.Username != "minishop_lan_app")
            throw new InvalidOperationException("LAN acceptance requires its own fictional database and restricted loopback login.");
        if (config.GetValue<bool>("LocalStaging:Enabled") || config.GetValue<bool>("Database:AutoMigrate") || config.GetValue<bool>("Bootstrap:Enabled", true)
            || config.GetValue<bool>("Bootstrap:SeedDemo") || !string.IsNullOrEmpty(config["Bootstrap:Password"])
            || string.IsNullOrWhiteSpace(config["DataProtection:Directory"]) || config["DataProtection:ApplicationName"] != "MiniShop.Lan")
            throw new InvalidOperationException("LAN runtime must be isolated from development/local staging, with private session keys and no bootstrap/migration privileges.");
    }
}
