using System.Text;
using MiniShop.Api.Business;
using MiniShop.Api.Entities;
using MiniShop.Api.Services;

namespace MiniShop.Tests;

public sealed class RulesTests
{
    [Theory]
    [InlineData("1.005", "1.01")]
    [InlineData("58.625", "58.63")]
    [InlineData("0.004", "0.00")]
    public void Money_rounds_away_from_zero(string value, string expected) => Assert.Equal(decimal.Parse(expected), Rules.Money(decimal.Parse(value)));
    [Theory]
    [InlineData("piece", "0.5")]
    [InlineData("gram", "0.0001")]
    [InlineData("kilogram", "-1")]
    [InlineData("piece", "0")]
    public void Invalid_quantities_are_rejected(string unit, string quantity) => Assert.Throws<BusinessException>(() => Rules.Quantity(unit, decimal.Parse(quantity)));
    [Fact] public void Philippine_date_window_has_exact_UTC_boundaries() { var (start, end) = Rules.Period(new DateOnly(2026, 10, 17), new DateOnly(2026, 10, 17)); Assert.Equal(new DateTimeOffset(2026, 10, 16, 16, 0, 0, TimeSpan.Zero), start); Assert.Equal(TimeSpan.FromDays(1), end - start); }
    [Theory]
    [InlineData("=SUM(A1)")]
    [InlineData("  +cmd")]
    [InlineData("@formula")]
    [InlineData("-command")]
    [InlineData("\tcell")]
    public void Csv_protects_against_spreadsheet_formulas(string cell) => Assert.StartsWith("\"'", ReportService.Csv(cell));
    [Fact]
    public void Pdf_writes_valid_xref_and_multiple_pages_for_long_receipts()
    {
        var sale = new Sale { Reference = "TEST-(escape)", CashierName = "Test", Total = 12 };
        for (var i = 0; i < 100; i++) sale.Items.Add(new SaleItem { Name = "A long product name (with brackets) \\ and symbols", Quantity = 1, Unit = "piece", UnitPrice = 12, LineTotal = 12 });
        var bytes = new ReceiptRenderer().Pdf(sale, new StoreSettings()); var pdf = Encoding.ASCII.GetString(bytes);
        Assert.StartsWith("%PDF-1.4", pdf); Assert.EndsWith("%%EOF\n", pdf); Assert.Matches(@"/Count [2-9]\b", pdf); Assert.Contains("\\(escape\\)", pdf);
        var xref = long.Parse(pdf.Split("startxref\n")[1].Split('\n')[0]); Assert.Equal("xref", Encoding.ASCII.GetString(bytes, (int)xref, 4));
    }
}
