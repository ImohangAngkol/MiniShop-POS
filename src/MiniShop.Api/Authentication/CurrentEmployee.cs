using System.Security.Claims;

namespace MiniShop.Api.Authentication;

public static class CurrentEmployee
{
    public static string EmployeeId(this ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new UnauthorizedAccessException();
    public static bool IsOwner(this ClaimsPrincipal user) => user.IsInRole("Owner");
}
