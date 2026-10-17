import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Barcode,
  Check,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { api, errorMessage, invalidate } from "../api";
import { useUser } from "../App";
import { cartTotals, money, qty } from "../format";
import type { Category, Customer, Product, Sale } from "../types";
import { Badge, Empty, PageTitle, QueryState, useData, useFlash } from "../ui";

type CartItem = Product & { quantity: number };
type Payload = {
  requestId: string;
  items: { productId: number; quantity: number }[];
  discount: number;
  cashReceived: number;
  customerId: number | null;
  onCredit: boolean;
};
type Intent = { payload: Payload; cart: CartItem[] };
export function PosPage() {
  const user = useUser(),
    owner = user.roles.includes("Owner"),
    flash = useFlash(),
    navigate = useNavigate();
  const storageKey = `minishop-checkout-${user.id}`;
  const [intent, setIntent] = useState<Intent | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      return null;
    }
  });
  const [cart, setCart] = useState<CartItem[]>(() => intent?.cart ?? []),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [discount, setDiscount] = useState(intent?.payload.discount ?? 0),
    [cash, setCash] = useState(intent?.payload.cashReceived ?? 0),
    [customer, setCustomer] = useState(
      String(intent?.payload.customerId ?? ""),
    ),
    [credit, setCredit] = useState(intent?.payload.onCredit ?? false),
    [busy, setBusy] = useState(false);
  const guard = useRef(false),
    searchRef = useRef<HTMLInputElement>(null);
  const products = useData<{ items: Product[]; total: number }>(
      `/products?search=${encodeURIComponent(search)}&pageSize=100${category ? "&categoryId=" + category : ""}`,
    ),
    cats = useData<Category[]>("/categories"),
    customers = useData<Customer[]>("/customers");
  const totals = cartTotals(cart, discount, cash),
    locked = !!intent || busy;
  function add(p: Product) {
    if (locked) return;
    const step = p.unit === "gram" ? 100 : 1;
    setCart((current) => {
      const exists = current.find((x) => x.id === p.id);
      const quantity = (exists?.quantity ?? 0) + step;
      if (quantity > p.availableStock) {
        flash("There is not enough available stock.", "error");
        return current;
      }
      return exists
        ? current.map((x) => (x.id === p.id ? { ...x, quantity } : x))
        : [...current, { ...p, quantity }];
    });
    setSearch("");
    searchRef.current?.focus();
  }
  function change(id: number, value: number) {
    if (locked) return;
    setCart((current) =>
      current.map((x) => (x.id === id ? { ...x, quantity: value } : x)),
    );
  }
  async function checkout() {
    if (guard.current) return;
    if (
      !intent &&
      (cart.length === 0 ||
        cart.some(
          (i) =>
            i.quantity <= 0 ||
            !Number.isFinite(i.quantity) ||
            (i.unit === "piece" && !Number.isInteger(i.quantity)),
        ) ||
        discount < 0 ||
        totals.total < 0 ||
        cash < 0 ||
        (!credit && totals.credit > 0) ||
        (credit && (!customer || totals.credit <= 0)))
    ) {
      flash("Check quantities, payment, and customer credit details.", "error");
      return;
    }
    const next = intent ?? {
      payload: {
        requestId: crypto.randomUUID(),
        items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
        discount,
        cashReceived: cash,
        customerId: customer ? Number(customer) : null,
        onCredit: credit,
      },
      cart,
    };
    // Persist before sending; an interrupted response can be retried with the identical key and payload.
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      flash(
        "Browser storage is unavailable. Enable session storage before checkout.",
        "error",
      );
      return;
    }
    guard.current = true;
    setBusy(true);
    setIntent(next);
    try {
      const sale = (await api.post<Sale>("/sales", next.payload)).data;
      sessionStorage.removeItem(storageKey);
      setIntent(null);
      setCart([]);
      await invalidate();
      flash("Sale recorded. Your receipt is ready.");
      navigate(`/sales/${sale.id}/receipt`);
    } catch (e) {
      flash(errorMessage(e), "error");
      if (
        axios.isAxiosError(e) &&
        e.response &&
        [400, 401, 403, 409, 422].includes(e.response.status)
      ) {
        sessionStorage.removeItem(storageKey);
        setIntent(null);
      }
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="AT THE COUNTER"
        title="Point of sale"
        description="A quick scan. A friendly hello. Another customer served."
      >
        <Badge tone="purple">{user.displayName}</Badge>
      </PageTitle>
      <div className="pos-grid">
        <section className="pos-catalog">
          <form
            className="search-field barcode-search"
            onSubmit={(e) => {
              e.preventDefault();
              const exact = products.data?.items.find(
                (p) =>
                  p.barcode === search ||
                  p.sku.toLowerCase() === search.toLowerCase(),
              );
              if (exact) add(exact);
              else if (products.data?.items.length === 1)
                add(products.data.items[0]);
              else flash("Choose a matching product below.", "error");
            }}
          >
            <Barcode size={23} />
            <input
              ref={searchRef}
              aria-label="Scan barcode or search products"
              placeholder="Scan barcode or search a product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              disabled={locked}
            />
            <kbd>↵</kbd>
            <button
              className="icon-btn"
              aria-label="Find scanned product"
              disabled={locked}
            >
              <Search size={18} />
            </button>
          </form>
          <div className="category-chips">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory("")}
            >
              All products
            </button>
            {cats.data?.map((c) => (
              <button
                key={c.id}
                className={category === String(c.id) ? "selected" : ""}
                onClick={() => setCategory(String(c.id))}
              >
                {c.name}
              </button>
            ))}
          </div>
          <QueryState query={products} />
          {products.data &&
            (products.data.items.length ? (
              <div className="product-grid">
                {products.data.items.map((p, i) => (
                  <button
                    className={`product-card color-${i % 4}`}
                    key={p.id}
                    onClick={() => add(p)}
                    disabled={locked || p.availableStock <= 0}
                  >
                    <div className="product-art">
                      <ShoppingBasket size={36} />
                      <span className="product-unit">per {p.unit}</span>
                    </div>
                    <div className="product-card-copy">
                      <span>{p.categoryName}</span>
                      <h3>{p.name}</h3>
                      <small>
                        {qty(p.availableStock)} {p.unit} available
                      </small>
                      <div>
                        <strong>{money(p.sellingPrice)}</strong>
                        <span className="add-circle">
                          <Plus size={17} />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="No products to show"
                text="Try another search, or ask the owner to add and receive products."
              />
            ))}
          {products.data && products.data.total > 100 && (
            <p className="page-note">
              Showing the first 100 matches. Narrow your search to find more
              products.
            </p>
          )}
        </section>
        <aside className="cart-panel panel">
          <div className="panel-head">
            <div>
              <h2>
                Current order <span className="cart-count">{cart.length}</span>
              </h2>
              <p>Walk-in or a familiar face</p>
            </div>
            <button
              className="icon-btn"
              aria-label="Clear cart"
              disabled={locked || !cart.length}
              onClick={() => {
                setCart([]);
                setDiscount(0);
                setCash(0);
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
          {intent && (
            <div className="pending-notice" role="alert">
              This checkout is awaiting confirmation. Retry it with the same
              saved request to safely recover the result. Editing is paused
              until it is resolved.
            </div>
          )}
          <div className="cart-items">
            {cart.length ? (
              cart.map((p) => (
                <div className="cart-item" key={p.id}>
                  <div className="cart-item-title">
                    <strong>{p.name}</strong>
                    <button
                      className="icon-btn"
                      disabled={locked}
                      aria-label={`Remove ${p.name}`}
                      onClick={() =>
                        setCart((c) => c.filter((x) => x.id !== p.id))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span>
                    {money(p.sellingPrice)} / {p.unit}
                  </span>
                  <div className="cart-item-bottom">
                    <div className="quantity-control">
                      <button
                        aria-label={`Decrease ${p.name}`}
                        disabled={locked || p.quantity <= 1}
                        onClick={() =>
                          change(p.id, Math.max(0.001, p.quantity - 1))
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        aria-label={`Quantity for ${p.name}`}
                        value={p.quantity}
                        step={p.unit === "piece" ? 1 : 0.001}
                        min={p.unit === "piece" ? 1 : 0.001}
                        onChange={(e) => change(p.id, Number(e.target.value))}
                        disabled={locked}
                      />
                      <button
                        disabled={locked}
                        aria-label={`Increase ${p.name}`}
                        onClick={() => change(p.id, p.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <strong>
                      {money(
                        cartTotals(
                          [
                            {
                              quantity: p.quantity,
                              sellingPrice: p.sellingPrice,
                            },
                          ],
                          0,
                          0,
                        ).total,
                      )}
                    </strong>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Your cart is ready"
                text="Scan a barcode or tap a product to begin."
              />
            )}
          </div>
          <div className="cart-checkout">
            <label className="field">
              <span>Customer</span>
              <select
                aria-label="Customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                disabled={locked}
              >
                <option value="">Walk-in customer</option>
                {customers.data
                  ?.filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            {owner && (
              <label className="cart-line">
                <span>Discount (PHP)</span>
                <input
                  aria-label="Discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  disabled={locked}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </label>
            )}
            <div className="cart-line">
              <span>Subtotal</span>
              <strong>{money(totals.subtotal)}</strong>
            </div>
            <div className="cart-total">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
            </div>
            <label className="field cash-field">
              <span>Cash received (PHP)</span>
              <input
                aria-label="Cash received"
                type="number"
                step="0.01"
                min="0"
                value={cash || ""}
                placeholder="0.00"
                disabled={locked}
                onChange={(e) => setCash(Number(e.target.value))}
              />
            </label>
            <label className="check-label credit-check">
              <input
                type="checkbox"
                checked={credit}
                onChange={(e) => setCredit(e.target.checked)}
                disabled={locked}
              />
              <CreditCard size={16} />
              Record remaining amount as utang
            </label>
            <div className="cart-line change-line">
              <span>{credit ? "Outstanding credit" : "Change"}</span>
              <strong>{money(credit ? totals.credit : totals.change)}</strong>
            </div>
            <button
              className="btn primary checkout-btn"
              disabled={busy || !cart.length}
              onClick={checkout}
            >
              <Check size={18} />
              {busy
                ? "Recording sale…"
                : intent
                  ? "Retry saved checkout"
                  : "Complete sale"}
              <span>{money(totals.total)}</span>
            </button>
            <small className="cart-note">
              Totals and stock are verified by the shop server.
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
