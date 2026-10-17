using System.ComponentModel.DataAnnotations;

namespace MiniShop.Api.DTOs;

public sealed record LoginRequest([Required, EmailAddress] string Email, [Required, StringLength(200)] string Password);
public sealed record CategoryRequest([Required, StringLength(80, MinimumLength = 1)] string Name);
public sealed record ProductRequest(
    [Required, StringLength(150, MinimumLength = 1)] string Name,
    [Required, StringLength(60, MinimumLength = 1)] string Sku,
    [StringLength(80)] string? Barcode,
    [Range(1, int.MaxValue)] int CategoryId,
    [Required, RegularExpression("^(piece|gram|kilogram)$")] string Unit,
    [Range(typeof(decimal), "0", "99999999")] decimal CostPrice,
    [Range(typeof(decimal), "0", "99999999")] decimal SellingPrice,
    [Range(typeof(decimal), "0", "99999999")] decimal LowStockThreshold,
    bool Active = true);
public sealed record ReceiveRequest([Range(1, int.MaxValue)] int ProductId,
    [Range(typeof(decimal), "0.001", "99999999")] decimal Quantity,
    [Range(typeof(decimal), "0", "99999999")] decimal UnitCost,
    DateOnly? ExpiresOn, [Required, StringLength(100, MinimumLength = 1)] string Reference);
public sealed record AdjustRequest([Range(1, long.MaxValue)] long BatchId,
    [Range(typeof(decimal), "-99999999", "99999999")] decimal Quantity,
    [Required, StringLength(300, MinimumLength = 3)] string Reason);
public sealed record CartLine([Range(1, int.MaxValue)] int ProductId,
    [Range(typeof(decimal), "0.001", "99999999")] decimal Quantity);
public sealed record CheckoutRequest(Guid RequestId, [Required, MinLength(1), MaxLength(200)] List<CartLine> Items,
    [Range(typeof(decimal), "0", "99999999")] decimal Discount,
    [Range(typeof(decimal), "0", "99999999")] decimal CashReceived,
    int? CustomerId, bool OnCredit);
public sealed record RefundRequest([Required, StringLength(300, MinimumLength = 3)] string Reason);
public sealed record CustomerRequest([Required, StringLength(150, MinimumLength = 1)] string Name,
    [StringLength(100)] string? Contact, [Range(typeof(decimal), "0", "99999999")] decimal? CreditLimit, bool Active = true);
public sealed record RepayRequest(Guid RequestId, [Range(typeof(decimal), "0.01", "99999999")] decimal Amount);
public sealed record EmployeeRequest([Required, EmailAddress, StringLength(200)] string Email,
    [Required, StringLength(100, MinimumLength = 1)] string DisplayName,
    [Required, StringLength(200, MinimumLength = 12)] string Password,
    [Required, RegularExpression("^(Owner|Cashier)$")] string Role);
public sealed record EmployeeStatusRequest(bool Active);
public sealed record PasswordRequest([Required, StringLength(200, MinimumLength = 12)] string Password);
public sealed record SettingsRequest([Required, StringLength(150, MinimumLength = 1)] string StoreName,
    [StringLength(150)] string Contact, [StringLength(250)] string Address,
    [StringLength(250)] string ReceiptFooter, [Range(58, 80)] int ThermalWidthMm);
