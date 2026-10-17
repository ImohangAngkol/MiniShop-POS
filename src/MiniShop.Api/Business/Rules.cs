namespace MiniShop.Api.Business;

public sealed class BusinessException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}
public static class Rules
{
    public static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    public static void MoneyInput(decimal value)
    {
        if (value < 0 || value > 99999999 || Money(value) != value) throw new BusinessException("Amounts must be nonnegative, below 100 million, and have at most two decimal places.");
    }
    public static void Quantity(string unit, decimal quantity, bool signed = false)
    {
        if ((!signed && quantity <= 0) || quantity == 0 || Math.Abs(quantity) > 99999999 || decimal.Round(quantity, 3) != quantity)
            throw new BusinessException("Quantity must be nonzero with at most three decimal places.");
        if (unit == "piece" && decimal.Truncate(quantity) != quantity) throw new BusinessException("Products sold by piece require whole quantities.");
    }
    public static void RequestId(Guid id) { if (id == Guid.Empty) throw new BusinessException("A nonempty requestId is required."); }
    public static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Manila").DateTime);
    public static (DateTimeOffset Start, DateTimeOffset End) Period(DateOnly from, DateOnly to)
    {
        if (to < from || to.DayNumber - from.DayNumber > 366) throw new BusinessException("Choose a date range of no more than 367 days.");
        return (new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(8)).ToUniversalTime(),
            new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(8)).ToUniversalTime());
    }
}
