import { useState } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SalesReport } from "../types";
import { money, qty, today } from "../format";
import { Empty, PageTitle, QueryState, Table, useData } from "../ui";

type InventoryReport = {
  valuation: number;
  expiredValuation: number;
  products: {
    id: number;
    name: string;
    unit: string;
    stock: number;
    value: number;
  }[];
};
export function ReportsPage() {
  const [from, setFrom] = useState(today()),
    [to, setTo] = useState(today());
  const q = useData<SalesReport>(`/reports/sales?from=${from}&to=${to}`),
    inventory = useData<InventoryReport>("/reports/inventory"),
    d = q.data;
  function preset(days: number) {
    const end = today();
    const dt = new Date(end + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() - days + 1);
    setFrom(dt.toISOString().slice(0, 10));
    setTo(end);
  }
  return (
    <>
      <PageTitle
        eyebrow="THE BIGGER PICTURE"
        title="Business reports"
        description="Know what’s selling, what’s on the shelves, and where you stand."
      >
        <a
          className="btn"
          href={`/api/reports/export/sales?from=${from}&to=${to}`}
        >
          <Download size={16} />
          Export sales
        </a>
      </PageTitle>
      <div className="panel toolbar report-toolbar">
        <div className="category-chips">
          <button onClick={() => preset(1)}>Today</button>
          <button onClick={() => preset(7)}>Last 7 days</button>
          <button
            onClick={() => {
              setFrom(today().slice(0, 7) + "-01");
              setTo(today());
            }}
          >
            This month
          </button>
        </div>
        <div className="date-range">
          <label>
            From
            <input
              type="date"
              aria-label="Report from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              aria-label="Report to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>
      <QueryState query={q} />
      {d && (
        <>
          <div className="stats-grid report-stats">
            {[
              ["Net sales", d.revenue],
              ["Gross profit estimate", d.grossProfit],
              ["Cost of goods sold", d.costOfGoods],
              ["Refunds", d.refunds],
            ].map(([label, value]) => (
              <article className="stat-card" key={String(label)}>
                <span>{label}</span>
                <strong>{money(Number(value))}</strong>
              </article>
            ))}
          </div>
          <div className="info-strip">
            Sales are recorded when a sale completes, including credit sales.
            Repayments are collections. Gross profit is sales less batch costs;
            expenses and net profit are not tracked.
          </div>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Sales by day</h2>
                <p>Refunds are recognized on their refund date</p>
              </div>
            </div>
            <div className="report-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.daily}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar
                    isAnimationActive={false}
                    dataKey="sales"
                    name="Net sales"
                    fill="#8150df"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel spaced">
            <div className="panel-head">
              <div>
                <h2>Product performance</h2>
                <p>
                  Order discounts are allocated proportionally to item revenue
                </p>
              </div>
            </div>
            {d.products.length ? (
              <Table
                headers={[
                  "Product",
                  "Quantity",
                  "Revenue",
                  "Gross profit estimate",
                ]}
              >
                {d.products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{qty(p.quantity)}</td>
                    <td className="amount">{money(p.revenue)}</td>
                    <td className="amount">{money(p.grossProfit)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty
                title="Nothing to report yet"
                text="Product performance appears after completed sales."
              />
            )}
          </section>
          <div className="report-collections">
            <span>
              Cash applied to sales: <strong>{money(d.cashSales)}</strong>
            </span>
            <span>
              Credit repayments: <strong>{money(d.repayments)}</strong>
            </span>
            <span>
              Cash refunds: <strong>{money(d.refundCash)}</strong>
            </span>
          </div>
        </>
      )}
      <section className="panel spaced">
        <div className="panel-head">
          <div>
            <h2>Inventory valuation</h2>
            <p>Current stock at actual batch cost · Includes expired stock</p>
          </div>
          <a className="btn small" href="/api/reports/export/inventory">
            <Download size={15} />
            Export
          </a>
        </div>
        <QueryState query={inventory} />
        {inventory.data && (
          <>
            <div className="inventory-value">
              <strong>{money(inventory.data.valuation)}</strong>
              <span>
                Expired stock value: {money(inventory.data.expiredValuation)}
              </span>
            </div>
            <Table headers={["Product", "On hand", "Value at cost"]}>
              {inventory.data.products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    {qty(p.stock)} {p.unit}
                  </td>
                  <td>{money(p.value)}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </section>
      <a className="btn spaced" href="/api/reports/export/credit">
        <Download size={16} />
        Export outstanding credit
      </a>
    </>
  );
}
