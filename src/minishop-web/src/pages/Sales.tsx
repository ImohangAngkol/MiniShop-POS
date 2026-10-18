import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import { useUser } from "../App";
import { api } from "../api";
import { dateTime, money, qty, today } from "../format";
import type { Sale, StoreSettings } from "../types";
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

export function SalesPage() {
  const [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [refund, setRefund] = useState<Sale | null>(null);
  const owner = useUser().roles.includes("Owner");
  const q = useData<{ total: number; items: Sale[] }>(
    `/sales?from=${from}&to=${to}&search=${encodeURIComponent(search)}&page=${page}`,
  );
  const action = useAction(
    (v: Record<string, string>) => api.post(`/sales/${refund!.id}/refund`, v),
    "Full sale reversed. Check the cash refund on the receipt.",
    () => setRefund(null),
  );
  return (
    <>
      <PageTitle
        eyebrow="EVERY SALE TELLS A STORY"
        title="Sales history"
        description={
          owner
            ? "A clear record of what went through your counter."
            : "A record of the sales completed with your cashier account."
        }
      />
      <div className="panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search receipt reference"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search receipt reference…"
            />
          </label>
          <div className="date-range">
            <label>
              From
              <input
                aria-label="Sales from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              To
              <input
                aria-label="Sales to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        </div>
        <QueryState query={q} />
        {q.data &&
          (q.data.items.length ? (
            <Table
              headers={[
                "Receipt / date",
                "Customer",
                "Cashier",
                "Total",
                "Payment",
                "Status",
                "Actions",
              ]}
            >
              {q.data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.reference}</strong>
                    <small>{dateTime(s.createdAt)}</small>
                  </td>
                  <td>{s.customerName ?? "Walk-in"}</td>
                  <td>{s.cashierName}</td>
                  <td className="amount">{money(s.total)}</td>
                  <td>
                    <Badge tone={s.credit > 0 ? "orange" : "purple"}>
                      {s.credit > 0 ? "With utang" : "Cash"}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={s.status === "Completed" ? "green" : "orange"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn small" to={`/sales/${s.id}/receipt`}>
                        <ReceiptText size={14} />
                        Receipt
                      </Link>
                      {owner && s.status === "Completed" && (
                        <button
                          className="icon-btn"
                          aria-label={`Refund ${s.reference}`}
                          onClick={() => setRefund(s)}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="No transactions in this period"
              text="Choose different dates or complete your first sale."
            />
          ))}
        {q.data && (
          <div className="pagination">
            <span>{q.data.total} transactions</span>
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
      {refund && (
        <Modal title="Reverse this sale" onClose={() => setRefund(null)}>
          <div className="pending-notice">
            {refund.reference} · {money(refund.total)}. This fully reverses the
            sale and restores each item to its original batch. Inspect returned
            goods before reselling. Remaining credit is reversed; cash already
            paid becomes a cash refund.
          </div>
          <DataForm
            fields={[
              { name: "reason", label: "Refund reason", required: true },
            ]}
            onSubmit={(v) => action.mutate(v)}
            pending={action.isPending}
            submit="Confirm full refund"
          />
        </Modal>
      )}
    </>
  );
}
export function ReceiptPage() {
  const { id } = useParams();
  const [previewWidth, setPreviewWidth] = useState<58 | 80 | null>(null);
  const q = useData<Sale>(`/sales/${id}`),
    store = useData<StoreSettings>("/settings");
  const s = q.data,
    t = store.data;
  if (!s || !t) return <QueryState query={!s ? q : store} />;
  const width = previewWidth ?? t.thermalWidthMm;
  return (
    <>
      <div className="no-print">
        <PageTitle
          eyebrow="ANOTHER CUSTOMER SERVED"
          title="Your receipt is ready"
          description="Download a copy or print a sales slip at the counter."
        >
          <Link className="btn" to="/pos">
            <ArrowLeft size={16} />
            Next sale
          </Link>
          <label className="field">
            Receipt preview width
            <select
              aria-label="Receipt preview width"
              value={width}
              onChange={(e) =>
                setPreviewWidth(Number(e.target.value) as 58 | 80)
              }
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
            </select>
          </label>
          <a className="btn" href={`/api/sales/${id}/pdf?paperWidth=${width}`}>
            <Download size={16} />
            Download PDF
          </a>
          <button className="btn primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print receipt
          </button>
        </PageTitle>
      </div>
      <div className="receipt-stage">
        <article
          className={`thermal-receipt width-${width}`}
          aria-label="Sales receipt"
        >
          <header>
            <div className="receipt-brand">{t.storeName}</div>
            {t.address && <p>{t.address}</p>}
            {t.contact && <p>{t.contact}</p>}
            <strong>SALES SLIP</strong>
            <small>Not an official invoice</small>
          </header>
          <div className="receipt-meta">
            <p>{s.reference}</p>
            <p>{dateTime(s.createdAt)} PHT</p>
            <p>Cashier: {s.cashierName}</p>
            <p>Customer: {s.customerName ?? "Walk-in"}</p>
          </div>
          <div className="receipt-items">
            {s.items.map((i) => (
              <div key={i.productId}>
                <strong>{i.name}</strong>
                <p>
                  <span>
                    {qty(i.quantity)} {i.unit} × {money(i.unitPrice)}
                  </span>
                  <span>{money(i.lineTotal)}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="receipt-totals">
            <p>
              <span>Subtotal</span>
              <span>{money(s.subtotal)}</span>
            </p>
            <p>
              <span>Discount</span>
              <span>{money(s.discount)}</span>
            </p>
            <p className="receipt-grand">
              <strong>TOTAL</strong>
              <strong>{money(s.total)}</strong>
            </p>
            <p>
              <span>Cash received</span>
              <span>{money(s.cashReceived)}</span>
            </p>
            <p>
              <span>Change</span>
              <span>{money(s.change)}</span>
            </p>
            <p>
              <span>Credit at sale</span>
              <span>{money(s.credit)}</span>
            </p>
          </div>
          {s.status === "Refunded" && (
            <div className="receipt-refund">
              <strong>REFUNDED</strong>
              <p>Cash refund: {money(s.refundCash)}</p>
              <p>{s.refundReason}</p>
            </div>
          )}
          <footer>
            <p>{t.receiptFooter}</p>
            <small>Please retain this sales slip for your records.</small>
          </footer>
        </article>
      </div>
      <p className="page-note no-print">
        Select {width} mm paper, 100% scale, and no browser headers or footers.
        Preview before printing. Credit shown is the amount at sale; check the
        customer ledger for the current balance.
      </p>
    </>
  );
}
