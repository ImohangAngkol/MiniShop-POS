using System.Globalization;
using System.Text;
using MiniShop.Api.Entities;

namespace MiniShop.Api.Services;

public interface IReceiptRenderer { byte[] Pdf(Sale sale, StoreSettings store); }

// A small, dependency-free PDF 1.4 writer for a text-only sales slip.
// Thermal HTML supports Unicode; the built-in PDF Courier font substitutes unsupported characters.
public sealed class ReceiptRenderer : IReceiptRenderer
{
    public byte[] Pdf(Sale s, StoreSettings store)
    {
        var lines = new List<string> { store.StoreName, store.Address, store.Contact, "SALES SLIP / NOT AN OFFICIAL INVOICE", s.Reference,
            s.CreatedAt.ToOffset(TimeSpan.FromHours(8)).ToString("yyyy-MM-dd HH:mm 'PHT'", CultureInfo.InvariantCulture), "Cashier: " + s.CashierName,
            "Customer: " + (s.Customer?.Name ?? "Walk-in"), "--------------------------------------" };
        foreach (var i in s.Items) { lines.Add(i.Name); lines.Add($"{i.Quantity:0.###} {i.Unit} x PHP {i.UnitPrice:0.00} = {i.LineTotal:0.00}"); }
        lines.AddRange(["--------------------------------------", $"Subtotal: PHP {s.Subtotal:0.00}", $"Discount: PHP {s.Discount:0.00}", $"TOTAL: PHP {s.Total:0.00}", $"Cash received: PHP {s.CashReceived:0.00}", $"Change: PHP {s.Change:0.00}", $"Credit at sale: PHP {s.Credit:0.00}", $"Status: {s.Status}"]);
        if (s.Status == "Refunded") lines.AddRange([$"Cash refunded: PHP {s.RefundCash:0.00}", "Reason: " + s.RefundReason]);
        lines.Add(store.ReceiptFooter);
        var wrapped = lines.SelectMany(x => Wrap(Ascii(x), store.ThermalWidthMm == 58 ? 30 : 42)).ToList();
        var chunks = wrapped.Chunk(65).ToList();
        // Fixed glyph widths keep wrapped lines within both thermal paper sizes.
        var objects = new List<string> { "<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>" };
        var pageRefs = new List<int>();
        foreach (var chunk in chunks)
        {
            var pageId = objects.Count + 1; var streamId = pageId + 1; pageRefs.Add(pageId);
            var width = store.ThermalWidthMm == 58 ? 164 : 227;
            var height = Math.Max(160, chunk.Length * 12 + 30);
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 3 0 R >> >> /Contents {streamId} 0 R >>");
            var content = new StringBuilder($"BT /F1 8 Tf 12 TL 10 {height - 18} Td\n");
            foreach (var line in chunk) content.Append('(').Append(line.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)")).Append(") Tj T*\n");
            content.Append("ET\n"); var data = content.ToString();
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(data)} >>\nstream\n{data}endstream");
        }
        objects[1] = $"<< /Type /Pages /Kids [{string.Join(' ', pageRefs.Select(i => $"{i} 0 R"))}] /Count {pageRefs.Count} >>";
        using var output = new MemoryStream();
        void Write(string value) => output.Write(Encoding.ASCII.GetBytes(value));
        Write("%PDF-1.4\n"); var offsets = new List<long>();
        for (var i = 0; i < objects.Count; i++) { offsets.Add(output.Position); Write($"{i + 1} 0 obj\n{objects[i]}\nendobj\n"); }
        var xref = output.Position; Write($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) Write(offset.ToString("D10", CultureInfo.InvariantCulture) + " 00000 n \n");
        Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return output.ToArray();
    }
    private static string Ascii(string value) => new(value.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).Select(c => c is >= ' ' and <= '~' ? c : '?').ToArray());
    private static IEnumerable<string> Wrap(string value, int width) { if (value.Length == 0) yield return ""; for (var i = 0; i < value.Length; i += width) yield return value.Substring(i, Math.Min(width, value.Length - i)); }
}
