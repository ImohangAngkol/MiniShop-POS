import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUser } from "../App";
import { money, dateTime, qty } from "../format";
import type { Dashboard } from "../types";
import { Badge, Empty, PageTitle, QueryState, Table, useData } from "../ui";

export function DashboardPage() {
  const q = useData<Dashboard>("/reports/dashboard");
  const user = useUser();
  const d = q.data;
  if (!d) return <QueryState query={q} />;
  return (
    <>
      <PageTitle
        eyebrow="YOUR SHOP AT A GLANCE"
        title={`Good to see you, ${user.displayName.split(" ")[0]}.`}
        description="Here’s what’s happening in your shop today."
      >
        <span className="date-chip">
          <CalendarDays size={17} />
          {new Date().toLocaleDateString("en-PH", {
            timeZone: "Asia/Manila",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </PageTitle>
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span>
            <Sparkles size={15} /> A FRESH DAY OF POSSIBILITIES
          </span>
          <h2>Big things happen in little shops.</h2>
          <p>Your shelves, your customers, your next sale. All in one place.</p>
          <Link className="btn" to="/pos">
            Open point of sale <ArrowRight size={17} />
          </Link>
        </div>
        <div className="shop-illustration" aria-hidden="true">
          <div className="shop-roof" />
          <div className="shop-awning">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="shop-body">
            <div className="shop-window">
              <ShoppingBag size={33} />
              <span>OPEN</span>
            </div>
            <div className="shop-door">
              <i />
            </div>
          </div>
          <div className="shop-ground" />
          <span className="spark s1">✧</span>
          <span className="spark s2">✦</span>
          <span className="plant">♧</span>
        </div>
      </section>
      <section className="stats-grid">
        <Stat
          label="Today’s sales"
          value={money(d.today.revenue)}
          foot="Sales less refunds today"
          icon={<CircleDollarSign />}
          tone="purple"
        />
        <Stat
          label="Completed transactions"
          value={String(d.today.transactions)}
          foot="Recorded today"
          icon={<ReceiptText />}
          tone="orange"
        />
        <Stat
          label="Low-stock products"
          value={`${d.lowStock.length}${d.lowStock.length === 20 ? "+" : ""}`}
          foot="Time to check your shelves"
          icon={<Package />}
          tone="blue"
        />
        <Stat
          label="Outstanding utang"
          value={money(d.outstandingCredit)}
          foot="Across customer accounts"
          icon={<CreditCard />}
          tone="rose"
        />
      </section>
      <div className="dashboard-main">
        <section className="panel sales-chart">
          <div className="panel-head">
            <div>
              <h2>Sales overview</h2>
              <p>A little progress, day by day</p>
            </div>
            <Badge>Last 7 days</Badge>
          </div>
          <div className="chart-total">
            <strong>{money(d.trend.revenue)}</strong>
            <span>net sales this week</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={d.trend.daily}
                margin={{ left: 0, right: 18, top: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8755e9" stopOpacity={0.22} />
                    <stop
                      offset="100%"
                      stopColor="#8755e9"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#eeeaf5"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    new Date(v + "T00:00:00").toLocaleDateString("en", {
                      weekday: "short",
                    })
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8a849a" }}
                  dy={10}
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8a849a" }}
                  width={45}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ece7f3",
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#8150df"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel quick-actions">
          <div className="panel-head">
            <div>
              <h2>A little head start</h2>
              <p>Your everyday shortcuts</p>
            </div>
          </div>
          <Link className="quick-action" to="/pos">
            <span className="quick-icon purple">
              <Plus />
            </span>
            <div>
              <strong>Make a sale</strong>
              <span>Ring up your next customer</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="quick-action" to="/receiving">
            <span className="quick-icon orange">
              <Truck />
            </span>
            <div>
              <strong>Receive stock</strong>
              <span>Keep your shelves ready</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="quick-action" to="/credit">
            <span className="quick-icon green">
              <ArrowDownLeft />
            </span>
            <div>
              <strong>Record a repayment</strong>
              <span>Keep utang accounts in order</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <div className="mini-note">
            <span>✦</span>
            <p>
              Good records make room for
              <br />
              <strong>better business.</strong>
            </p>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent transactions</h2>
              <p>The latest from your counter</p>
            </div>
            <Link className="text-link" to="/sales">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {d.recent.length ? (
            <Table
              headers={["Transaction", "Customer", "Amount", "Status", ""]}
            >
              {d.recent.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.reference}</strong>
                    <small>{dateTime(s.createdAt)}</small>
                  </td>
                  <td>{s.customerName ?? "Walk-in customer"}</td>
                  <td className="amount">{money(s.total)}</td>
                  <td>
                    <Badge tone={s.status === "Completed" ? "green" : "orange"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      className="icon-btn"
                      aria-label={`Receipt ${s.reference}`}
                      to={`/sales/${s.id}/receipt`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Your first sale starts here"
              text="Completed transactions will appear as you serve customers."
            />
          )}
        </section>
        <section className="panel attention-panel">
          <div className="panel-head">
            <div>
              <h2>A little attention</h2>
              <p>Keep your shelves in good shape</p>
            </div>
            <span className="attention-dot" />
          </div>
          <h3 className="subheading">
            LOW STOCK <Badge tone="orange">{d.lowStock.length}</Badge>
          </h3>
          {d.lowStock.length ? (
            d.lowStock.slice(0, 3).map((p) => (
              <div className="alert-row" key={p.id}>
                <span className="product-mini">
                  <Package size={17} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {qty(p.stock)} {p.unit} remaining
                  </span>
                </div>
                <span className="orange-text">Low</span>
              </div>
            ))
          ) : (
            <p className="quiet-note">Your stock levels are looking good.</p>
          )}
          <h3 className="subheading">
            EXPIRY WATCH <Badge tone="purple">{d.nearExpiry.length}</Badge>
          </h3>
          {d.nearExpiry.length ? (
            d.nearExpiry.slice(0, 2).map((b) => (
              <div className="alert-row" key={b.id}>
                <span className="product-mini">
                  <CalendarDays size={17} />
                </span>
                <div>
                  <strong>{b.productName}</strong>
                  <span>{b.expiresOn}</span>
                </div>
                <Badge tone={b.expired ? "red" : "orange"}>
                  {b.expired ? "Expired" : "Soon"}
                </Badge>
              </div>
            ))
          ) : (
            <p className="quiet-note">No batches expire in the next 30 days.</p>
          )}
          <Link to="/inventory" className="attention-link">
            Check inventory <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  foot,
  icon,
  tone,
}: {
  label: string;
  value: string;
  foot: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <span className="stat-foot">{foot}</span>
    </article>
  );
}
