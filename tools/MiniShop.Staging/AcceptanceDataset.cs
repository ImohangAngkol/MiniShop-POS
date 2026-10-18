using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Business;
using MiniShop.Api.Data;
using MiniShop.Api.Entities;

internal static class AcceptanceDataset
{
    public static readonly string[] Groups = ["Beverages", "Snacks", "Canned goods", "Household items", "Frozen goods", "Weighted products"];
    private static readonly string[][] Names = [
        ["Drinking water 500 mL", "Cola 330 mL", "Orange drink 250 mL", "Milk drink 200 mL", "Coffee sachet"],
        ["Corn chips 50 g", "Crackers 100 g", "Peanut snack 80 g", "Biscuits 120 g", "Candy pack"],
        ["Sardines 155 g", "Tuna flakes 180 g", "Corned meat 150 g", "Sweet corn 400 g", "Beans 230 g"],
        ["Laundry soap bar", "Dishwashing refill", "Tissue roll", "Shampoo sachets", "Toothpaste 50 g"],
        ["Frozen dumplings 250 g", "Ice cream cup", "Frozen fries 500 g", "Frozen mixed vegetables", "Ice candy pack"],
        ["Jasmine rice", "White sugar", "Brown rice", "Salt", "Flour"]
    ];
    public static async Task Seed(ShopDb db, string owner)
    {
        if (await db.Products.AnyAsync())
        {
            if (await db.Products.CountAsync(x => x.Sku.StartsWith("ACCEPT-")) != 300) throw new InvalidOperationException("Existing acceptance catalog does not match the expected 300-product baseline; no reset was performed.");
            return;
        }
        await using var tx = await db.Database.BeginTransactionAsync();
        for (var group = 0; group < Groups.Length; group++)
        {
            var category = new Category { Name = "Fictional " + Groups[group] }; db.Categories.Add(category);
            for (var variant = 0; variant < 50; variant++)
            {
                var index = group * 50 + variant + 1;
                var unit = group == 5 ? variant % 2 == 0 ? "kilogram" : "gram" : "piece";
                var price = group switch { 0 => 20m, 1 => 15m, 2 => 32.50m, 3 => 24m, 4 => 120m, _ => unit == "gram" ? 0.09m : 58.63m };
                var cost = group switch { 0 => 12m, 1 => 9m, 2 => 20m, 3 => 14m, 4 => 80m, _ => unit == "gram" ? 0.06m : 40m };
                if (variant > 0 && group < 5) { price += variant % 7 * 0.50m; cost += variant % 5 * 0.25m; }
                var code = "299" + index.ToString("D9");
                var checksum = (10 - code.Select((digit, position) => (digit - '0') * (position % 2 == 0 ? 1 : 3)).Sum() % 10) % 10;
                var p = new Product
                {
                    Name = $"Fictional {Names[group][variant % 5]} - V{variant + 1:D2}",
                    Sku = $"ACCEPT-{index:D3}",
                    Barcode = code + checksum,
                    Category = category,
                    Unit = unit,
                    SellingPrice = price,
                    CostPrice = cost,
                    LowStockThreshold = unit == "gram" ? 500 : 5
                };
                db.Products.Add(p); await db.SaveChangesAsync();
                if (variant == 49) continue; // Six intentionally out-of-stock products.
                var batch = new InventoryBatch
                {
                    Product = p,
                    Quantity = unit == "gram" ? 5000 : unit == "kilogram" ? 50 : 100,
                    UnitCost = cost,
                    Reference = "FICTIONAL ACCEPTANCE OPENING",
                    ExpiresOn = group is 0 or 1 or 2 or 4 ? Rules.Today.AddDays(90) : null
                };
                db.Batches.Add(batch); await db.SaveChangesAsync();
                db.StockMovements.Add(new StockMovement { ProductId = p.Id, Batch = batch, Quantity = batch.Quantity, Kind = "AcceptanceSeed", Reason = batch.Reference, ActorId = owner });
            }
        }
        for (var index = 1; index <= 24; index++) db.Customers.Add(new Customer { Name = $"Fictional acceptance household {index:D2}", CreditLimit = index <= 12 ? 500 : 1500 });
        var settings = await db.Settings.SingleAsync(); settings.DemoData = true; settings.StoreName = "MiniShop SOFTWARE ACCEPTANCE (fictional)";
        settings.Address = "Fictional Test Street, Test Barangay"; settings.Contact = "Fictional acceptance only"; settings.ReceiptFooter = "FICTIONAL TEST SALE - no real goods or payment";
        await db.SaveChangesAsync(); await tx.CommitAsync();
    }
}
