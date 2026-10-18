using Npgsql;

namespace MiniShop.Api.Authentication;

public static class LocalStagingSecurity
{
    public static void Validate(IConfiguration config, string? urls)
    {
        if (urls != "https://localhost:5443" || config.GetSection("Kestrel:Endpoints").GetChildren().Any())
            throw new InvalidOperationException("Local staging only permits https://localhost:5443. LAN binding needs a separately reviewed deployment profile.");
        var db = new NpgsqlConnectionStringBuilder(config.GetConnectionString("Shop"));
        if (db.Host != "127.0.0.1" || db.Port != 55433 || db.Database != "minishop_staging" || db.Username != "minishop_staging_app")
            throw new InvalidOperationException("Local staging requires its dedicated loopback database and runtime role.");
        if (config.GetValue<bool>("Database:AutoMigrate") || config.GetValue<bool>("Bootstrap:Enabled", true) || config.GetValue<bool>("Bootstrap:SeedDemo")
            || !string.IsNullOrEmpty(config["Bootstrap:Password"]) || string.IsNullOrWhiteSpace(config["DataProtection:Directory"]))
            throw new InvalidOperationException("Local staging must use private keys, no bootstrap secret and no startup migration/seeding.");
    }
}
