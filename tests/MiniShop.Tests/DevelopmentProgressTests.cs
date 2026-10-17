using Microsoft.Extensions.Configuration;
using MiniShop.Api.Business;
using MiniShop.Api.Services;

namespace MiniShop.Tests;

public sealed class DevelopmentProgressTests
{
    [Fact]
    public async Task Missing_snapshot_returns_safe_unavailable_error()
    {
        var path = Path.Combine(Path.GetTempPath(), "minishop-missing-" + Guid.NewGuid() + ".json");
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["DevelopmentProgress:FilePath"] = path }).Build();
        var error = await Assert.ThrowsAsync<BusinessException>(() => new DevelopmentProgressReader(config).Read(default));
        Assert.Equal(503, error.Status);
        Assert.DoesNotContain(path, error.Message);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    public async Task Invalid_snapshot_returns_unavailable_instead_of_invented_progress(string content)
    {
        var path = Path.Combine(Path.GetTempPath(), "minishop-invalid-" + Guid.NewGuid() + ".json");
        try
        {
            await File.WriteAllTextAsync(path, content);
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["DevelopmentProgress:FilePath"] = path }).Build();
            var error = await Assert.ThrowsAsync<BusinessException>(() => new DevelopmentProgressReader(config).Read(default));
            Assert.Equal(503, error.Status);
        }
        finally { File.Delete(path); }
    }
}
