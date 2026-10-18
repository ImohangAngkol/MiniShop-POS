using Npgsql;

namespace MiniShop.Api.Authentication;

public static class AcceptanceSecurity
{
    public static void Validate(IConfiguration config, string? urls)
    {
        var db = new NpgsqlConnectionStringBuilder(config.GetConnectionString("Shop"));
        if (urls != "https://127.0.0.1:5843" || config.GetSection("Kestrel:Endpoints").GetChildren().Any()
            || db.Host != "127.0.0.1" || db.Port != 55433 || db.Database != "minishop_acceptance" || db.Username != "minishop_acceptance_app"
            || config.GetValue<bool>("LocalStaging:Enabled") || config.GetValue<bool>("Lan:Enabled") || config.GetValue<bool>("Bootstrap:Enabled", true)
            || config.GetValue<bool>("Bootstrap:SeedDemo") || config.GetValue<bool>("Database:AutoMigrate") || !string.IsNullOrEmpty(config["Bootstrap:Password"])
            || config["AllowedHosts"] != "127.0.0.1;localhost" || config["DataProtection:ApplicationName"] != "MiniShop.SoftwareAcceptance"
            || string.IsNullOrWhiteSpace(config["DataProtection:Directory"]))
            throw new InvalidOperationException("Software acceptance requires its own fictional database/runtime role/keys, fixed loopback HTTPS origin and no bootstrap/migrations or other hosting profiles.");
    }
}
