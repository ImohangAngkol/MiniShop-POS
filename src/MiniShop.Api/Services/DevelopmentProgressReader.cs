using System.Text.Json;
using MiniShop.Api.Business;

namespace MiniShop.Api.Services;

// Kept outside wwwroot and only read by an owner-authorized controller.
public sealed class DevelopmentProgressReader(IConfiguration configuration)
{
    public async Task<JsonElement> Read(CancellationToken ct)
    {
        var path = configuration["DevelopmentProgress:FilePath"]
            ?? Path.Combine(AppContext.BaseDirectory, "Progress", "development-progress.json");
        try
        {
            await using var stream = File.OpenRead(path);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                throw new BusinessException("Development progress is temporarily unavailable. Ask the owner to restore the reviewed progress file.", 503);
            return document.RootElement.Clone();
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException)
        {
            throw new BusinessException("Development progress is temporarily unavailable. Ask the owner to restore the reviewed progress file.", 503);
        }
    }
}
