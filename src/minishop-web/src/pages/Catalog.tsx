import { useState } from "react";
import { Link } from "react-router-dom";
import { Edit3, Filter, Plus, Search, Truck } from "lucide-react";
import { api } from "../api";
import type { Batch, Category, Movement, Product } from "../types";
import { money, qty, dateTime } from "../format";
import {
  Badge,
  DataForm,
  Empty,
  Modal,
  PageTitle,
  QueryState,
  Table,
  useAction,
  useData,
} from "../ui";
import type { Field } from "../ui";

const numberField = (name: string, label: string, min = 0): Field => ({
  name,
  label,
  type: "number",
  required: true,
  min,
  max: 99999999,
  step: "0.01",
});
export function ProductsPage() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [inactive, setInactive] = useState(false),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<Product | "new" | null>(null),
    [addCategory, setAddCategory] = useState(false);
  const q = useData<{ items: Product[]; total: number }>(
      `/products?search=${encodeURIComponent(search)}&includeInactive=${inactive}&page=${page}&pageSize=50${category ? "&categoryId=" + category : ""}`,
    ),
    cats = useData<Category[]>("/categories");
  const save = useAction(
    async (v: Record<string, string>) => {
      const body = {
        ...v,
        categoryId: Number(v.categoryId),
        costPrice: Number(v.costPrice),
        sellingPrice: Number(v.sellingPrice),
        lowStockThreshold: Number(v.lowStockThreshold),
        active: v.active === "true",
        barcode: v.barcode || null,
      };
      if (editing !== "new" && editing)
        await api.put(`/products/${editing.id}`, body);
      else await api.post("/products", body);
    },
    "Product saved.",
    () => setEditing(null),
  );
  const saveCategory = useAction(
    (v: Record<string, string>) => api.post("/categories", v),
    "Category created.",
    () => setAddCategory(false),
  );
  const fields: Field[] = [
    { name: "name", label: "Product name", required: true },
    { name: "sku", label: "SKU", required: true },
    {
      name: "barcode",
      label: "Barcode",
      hint: "Leave blank if this product has no barcode.",
    },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      required: true,
      options: cats.data?.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      name: "unit",
      label: "Sold by",
      type: "select",
      required: true,
      options: ["piece", "gram", "kilogram"].map((u) => ({
        value: u,
        label: u,
      })),
    },
    numberField("costPrice", "Default cost (PHP)"),
    numberField("sellingPrice", "Selling price per unit (PHP)"),
    {
      ...numberField("lowStockThreshold", "Low-stock alert at"),
      step: "0.001",
    },
    {
      name: "active",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="THE SHELVES"
        title="Your products"
        description="Every everyday essential, organized and easy to find."
      >
        <button className="btn" onClick={() => setAddCategory(true)}>
          Add category
        </button>
        <button className="btn primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          Add product
        </button>
      </PageTitle>
      <div className="panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search products"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, SKU or barcode…"
            />
          </label>
          <div className="toolbar-filters">
            <Filter size={16} />
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={inactive}
                onChange={(e) => {
                  setInactive(e.target.checked);
                  setPage(1);
                }}
              />
              Include inactive
            </label>
          </div>
        </div>
        <QueryState query={q} />
        {q.data &&
          (q.data.items.length ? (
            <Table
              headers={[
                "Product",
                "Category",
                "Price",
                "Available stock",
                "Status",
                "",
              ]}
            >
              {q.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <span className="product-letter">
                        {p.name.slice(0, 1)}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.sku} · per {p.unit}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{p.categoryName}</td>
                  <td className="amount">{money(p.sellingPrice)}</td>
                  <td>
                    <span
                      className={
                        p.availableStock <= p.lowStockThreshold
                          ? "orange-text"
                          : ""
                      }
                    >
                      {qty(p.availableStock)} {p.unit}
                    </span>
                  </td>
                  <td>
                    <Badge tone={p.active ? "green" : "neutral"}>
                      {p.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Edit3 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Make room for your first product"
              text="Add a category, then create a product and receive stock."
            />
          ))}
        {q.data && (
          <div className="pagination">
            <span>{q.data.total} products</span>
            <button
              className="btn small"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="btn small"
              disabled={page * 50 >= q.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
      {editing && (
        <Modal
          title={editing === "new" ? "Add a product" : "Edit product"}
          onClose={() => setEditing(null)}
        >
          <DataForm
            fields={fields}
            initial={
              editing === "new"
                ? {
                    unit: "piece",
                    costPrice: "0",
                    sellingPrice: "0",
                    lowStockThreshold: "5",
                    active: "true",
                  }
                : Object.fromEntries(
                    Object.entries(editing).map(([k, v]) => [
                      k,
                      v == null ? "" : String(v),
                    ]),
                  )
            }
            onSubmit={(v) => save.mutate(v)}
            pending={save.isPending}
          />
        </Modal>
      )}
      {addCategory && (
        <Modal title="New category" onClose={() => setAddCategory(false)}>
          <DataForm
            fields={[{ name: "name", label: "Category name", required: true }]}
            onSubmit={(v) => saveCategory.mutate(v)}
            pending={saveCategory.isPending}
          />
        </Modal>
      )}
    </>
  );
}
export function InventoryPage() {
  const [tab, setTab] = useState<"batches" | "movements">("batches"),
    [adjust, setAdjust] = useState<Batch | null>(null),
    [page, setPage] = useState(1);
  const batches = useData<Batch[]>("/inventory/batches"),
    moves = useData<Movement[]>(`/inventory/movements?page=${page}`);
  const action = useAction(
    (v: Record<string, string>) =>
      api.post("/inventory/adjust", {
        batchId: adjust!.id,
        quantity: Number(v.quantity),
        reason: v.reason,
      }),
    "Stock adjustment recorded.",
    () => setAdjust(null),
  );
  const query = tab === "batches" ? batches : moves;
  return (
    <>
      <PageTitle
        eyebrow="KNOW YOUR STOCK"
        title="Inventory"
        description="Trace every delivery, adjustment, and sale back to the batch."
      >
        <Link className="btn primary" to="/receiving">
          <Truck size={17} />
          Receive stock
        </Link>
      </PageTitle>
      <div className="panel">
        <div className="tabs">
          <button
            className={tab === "batches" ? "selected" : ""}
            onClick={() => setTab("batches")}
          >
            Stock batches
          </button>
          <button
            className={tab === "movements" ? "selected" : ""}
            onClick={() => setTab("movements")}
          >
            Movement history
          </button>
        </div>
        <QueryState query={query} />
        {tab === "batches" &&
          batches.data &&
          (batches.data.length ? (
            <Table
              headers={[
                "Product / batch",
                "Reference",
                "On hand",
                "Unit cost",
                "Expiry",
                "",
              ]}
            >
              {batches.data.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.productName}</strong>
                    <small>Batch #{b.id}</small>
                  </td>
                  <td>{b.reference}</td>
                  <td>
                    {qty(b.quantity)} {b.unit}
                  </td>
                  <td>{money(b.unitCost)}</td>
                  <td>
                    {b.expiresOn ? (
                      <Badge
                        tone={
                          new Date(b.expiresOn + "T23:59:59+08:00") < new Date()
                            ? "red"
                            : "neutral"
                        }
                      >
                        {b.expiresOn}
                      </Badge>
                    ) : (
                      "No expiry"
                    )}
                  </td>
                  <td>
                    <button className="btn small" onClick={() => setAdjust(b)}>
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Ready for your first delivery"
              text="Receive stock to create a traceable batch."
            />
          ))}
        {tab === "movements" &&
          moves.data &&
          (moves.data.length ? (
            <>
              <Table
                headers={["Date", "Product", "Type", "Quantity", "Reason"]}
              >
                {moves.data.map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.createdAt)}</td>
                    <td>
                      <strong>{m.productName}</strong>
                      <small>Batch #{m.batchId}</small>
                    </td>
                    <td>
                      <Badge tone={m.quantity > 0 ? "green" : "purple"}>
                        {m.kind}
                      </Badge>
                    </td>
                    <td className="amount">
                      {m.quantity > 0 ? "+" : ""}
                      {qty(m.quantity)}
                    </td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </Table>
              <div className="pagination">
                <button
                  className="btn small"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  className="btn small"
                  disabled={moves.data.length < 100}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <Empty
              title="No stock movements"
              text="Your stock activity will appear here."
            />
          ))}
      </div>
      <p className="page-note">
        Stock batches show the latest 500 records. Expired stock stays on hand
        for auditing and is excluded from available checkout stock.
      </p>
      {adjust && (
        <Modal
          title={`Adjust batch #${adjust.id}`}
          onClose={() => setAdjust(null)}
        >
          <p className="modal-description">
            {adjust.productName} · {qty(adjust.quantity)} {adjust.unit} on hand.
            Enter a positive quantity to add stock or a negative quantity to
            remove it.
          </p>
          <DataForm
            fields={[
              {
                name: "quantity",
                label: "Quantity change",
                type: "number",
                required: true,
                min: -99999999,
                max: 99999999,
                step: adjust.unit === "piece" ? "1" : "0.001",
              },
              { name: "reason", label: "Reason", required: true },
            ]}
            onSubmit={(v) => action.mutate(v)}
            pending={action.isPending}
          />
        </Modal>
      )}
    </>
  );
}
export function ReceivingPage() {
  const [search, setSearch] = useState(""),
    [reset, setReset] = useState(0);
  const q = useData<{ items: Product[] }>(
    `/products?search=${encodeURIComponent(search)}&pageSize=200`,
  );
  const receive = useAction(
    (v: Record<string, string>) =>
      api.post("/inventory/receive", {
        productId: Number(v.productId),
        quantity: Number(v.quantity),
        unitCost: Number(v.unitCost),
        expiresOn: v.expiresOn || null,
        reference: v.reference,
      }),
    "Delivery received. Stock is ready.",
    () => setReset((r) => r + 1),
  );
  return (
    <>
      <PageTitle
        eyebrow="FILL THE SHELVES"
        title="Receive stock"
        description="A fresh delivery, a clear record, and one less thing to remember."
      />
      <div className="form-page-grid">
        <section className="panel padded">
          <h2>Delivery details</h2>
          <p className="section-description">
            Use the same supplier reference for items in one delivery.
          </p>
          <label className="search-field spaced">
            <Search size={18} />
            <input
              aria-label="Find product to receive"
              placeholder="Find a product by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <QueryState query={q} />
          {q.data && (
            <DataForm
              key={reset}
              fields={[
                {
                  name: "productId",
                  label: "Product",
                  type: "select",
                  required: true,
                  options: q.data.items.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (per ${p.unit})`,
                  })),
                },
                {
                  name: "reference",
                  label: "Delivery / supplier reference",
                  required: true,
                },
                {
                  name: "quantity",
                  label: "Quantity received",
                  type: "number",
                  required: true,
                  min: 0.001,
                  max: 99999999,
                  step: "0.001",
                },
                numberField("unitCost", "Cost per product unit (PHP)"),
                {
                  name: "expiresOn",
                  label: "Expiration date",
                  type: "date",
                  hint: "Optional. Units and costs must match the product’s unit.",
                },
              ]}
              onSubmit={(v) => receive.mutate(v)}
              pending={receive.isPending}
              submit="Receive into inventory"
            />
          )}
        </section>
        <aside className="info-card">
          <Truck size={30} />
          <h3>A clear trail, every time.</h3>
          <p>
            Each received item creates a new inventory batch. Checkout uses the
            batches that expire first.
          </p>
          <p>
            For weighted goods, enter the quantity in the product’s configured
            unit: grams or kilograms. A product sold by piece requires whole
            numbers.
          </p>
          <Link className="text-link" to="/inventory">
            View inventory <Plus size={15} />
          </Link>
        </aside>
      </div>
    </>
  );
}
