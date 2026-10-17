using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Data;

public sealed class ShopDb(DbContextOptions<ShopDb> options) : IdentityDbContext<Employee>(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<InventoryBatch> Batches => Set<InventoryBatch>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SaleAllocation> Allocations => Set<SaleAllocation>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Discount> Discounts => Set<Discount>();
    public DbSet<CreditTransaction> CreditTransactions => Set<CreditTransaction>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StoreSettings> Settings => Set<StoreSettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var p in entity.GetProperties())
            {
                if (p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)) { p.SetPrecision(18); p.SetScale(p.Name.Contains("Quantity") || p.Name == "LowStockThreshold" ? 3 : 2); }
                if (p.ClrType == typeof(string) && p.GetMaxLength() == null) p.SetMaxLength(500);
            }
        b.Entity<Product>().HasIndex(x => x.Sku).IsUnique();
        b.Entity<Product>().HasIndex(x => x.Barcode).IsUnique();
        b.Entity<Category>().HasIndex(x => x.Name).IsUnique();
        b.Entity<Product>().ToTable(t =>
        {
            t.HasCheckConstraint("CK_Product_Prices", "\"CostPrice\" >= 0 AND \"SellingPrice\" >= 0 AND \"LowStockThreshold\" >= 0");
            t.HasCheckConstraint("CK_Product_Unit", "\"Unit\" IN ('piece','gram','kilogram')");
        });
        b.Entity<InventoryBatch>().HasIndex(x => new { x.ProductId, x.ExpiresOn });
        b.Entity<InventoryBatch>().ToTable(t => t.HasCheckConstraint("CK_Batch_Nonnegative", "\"Quantity\" >= 0 AND \"UnitCost\" >= 0"));
        b.Entity<Sale>().HasIndex(x => x.RequestId).IsUnique();
        b.Entity<Sale>().HasIndex(x => x.Reference).IsUnique();
        b.Entity<Sale>().HasIndex(x => x.CreatedAt);
        b.Entity<Sale>().HasOne<Employee>().WithMany().HasForeignKey(x => x.CashierId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Sale>().ToTable(t => t.HasCheckConstraint("CK_Sale_Totals", "\"Total\" >= 0 AND \"Discount\" >= 0 AND \"Total\" = \"Subtotal\" - \"Discount\" AND \"CashApplied\" + \"Credit\" = \"Total\""));
        b.Entity<SaleItem>().ToTable(t => t.HasCheckConstraint("CK_SaleItem_Quantity", "\"Quantity\" > 0 AND \"UnitPrice\" >= 0"));
        b.Entity<Payment>().HasIndex(x => x.RequestId).IsUnique();
        b.Entity<Payment>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId);
        b.Entity<StockMovement>().HasOne<Sale>().WithMany().HasForeignKey(x => x.SaleId);
        b.Entity<Discount>().HasIndex(x => x.SaleId).IsUnique();
        b.Entity<Discount>().HasOne<Employee>().WithMany().HasForeignKey(x => x.AuthorizedBy);
        b.Entity<Discount>().ToTable(t => t.HasCheckConstraint("CK_Discount_Positive", "\"Amount\" > 0"));
        b.Entity<CreditTransaction>().HasIndex(x => new { x.CustomerId, x.SaleId });
        b.Entity<StockMovement>().HasIndex(x => new { x.ProductId, x.CreatedAt });
        b.Entity<StockMovement>().HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<SaleItem>().HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Customer>().ToTable(t => t.HasCheckConstraint("CK_Customer_Limit", "\"CreditLimit\" IS NULL OR \"CreditLimit\" >= 0"));
        b.Entity<StoreSettings>().ToTable(t => t.HasCheckConstraint("CK_Store_Singleton", "\"Id\" = 1 AND \"ThermalWidthMm\" IN (58,80)"));
        // Financial records are retained; the API exposes no hard-delete operation.
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(x => x.GetForeignKeys())) fk.DeleteBehavior = DeleteBehavior.Restrict;
    }
}
