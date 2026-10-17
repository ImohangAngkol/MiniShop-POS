import { createContext, lazy, Suspense, useContext, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";
import type { User, StoreSettings } from "./types";
import { api, get, queryClient, refreshCsrf } from "./api";
import { DataForm, QueryState, useAction, useData } from "./ui";
const DashboardPage = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.DashboardPage })),
);
const ProductsPage = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.ProductsPage })),
);
const InventoryPage = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.InventoryPage })),
);
const ReceivingPage = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.ReceivingPage })),
);
const PosPage = lazy(() =>
  import("./pages/Pos").then((m) => ({ default: m.PosPage })),
);
const CustomersPage = lazy(() =>
  import("./pages/Customers").then((m) => ({ default: m.CustomersPage })),
);
const SalesPage = lazy(() =>
  import("./pages/Sales").then((m) => ({ default: m.SalesPage })),
);
const ReceiptPage = lazy(() =>
  import("./pages/Sales").then((m) => ({ default: m.ReceiptPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.ReportsPage })),
);
const EmployeesPage = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.EmployeesPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.SettingsPage })),
);
const DevelopmentProgressPage = lazy(() =>
  import("./pages/DevelopmentProgress").then((m) => ({
    default: m.DevelopmentProgressPage,
  })),
);

const AuthContext = createContext<User | null>(null);
export const useUser = () => useContext(AuthContext)!;
export function App() {
  const session = useQuery<User | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await get<User>("/auth/me");
      } catch (e) {
        if ((e as { response?: { status: number } }).response?.status === 401)
          return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
  if (session.isPending || session.error) return <QueryState query={session} />;
  return (
    <AuthContext.Provider value={session.data ?? null}>
      <Suspense fallback={<div className="state">Opening your workspace…</div>}>
        <Routes>
          <Route
            path="/login"
            element={
              session.data ? (
                <Navigate
                  to={session.data.roles.includes("Owner") ? "/" : "/pos"}
                  replace
                />
              ) : (
                <Login />
              )
            }
          />
          <Route
            element={
              session.data ? <Shell /> : <Navigate to="/login" replace />
            }
          >
            <Route
              index
              element={
                <Owner>
                  <DashboardPage />
                </Owner>
              }
            />
            <Route path="pos" element={<PosPage />} />
            <Route
              path="products"
              element={
                <Owner>
                  <ProductsPage />
                </Owner>
              }
            />
            <Route
              path="inventory"
              element={
                <Owner>
                  <InventoryPage />
                </Owner>
              }
            />
            <Route
              path="receiving"
              element={
                <Owner>
                  <ReceivingPage />
                </Owner>
              }
            />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="credit" element={<CustomersPage credit />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/:id/receipt" element={<ReceiptPage />} />
            <Route
              path="reports"
              element={
                <Owner>
                  <ReportsPage />
                </Owner>
              }
            />
            <Route
              path="employees"
              element={
                <Owner>
                  <EmployeesPage />
                </Owner>
              }
            />
            <Route
              path="settings"
              element={
                <Owner>
                  <SettingsPage />
                </Owner>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route
              path="admin/development-progress"
              element={
                <Owner>
                  <DevelopmentProgressPage />
                </Owner>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </AuthContext.Provider>
  );
}
function Owner({ children }: { children: React.ReactNode }) {
  const user = useUser();
  return user.roles.includes("Owner") ? (
    children
  ) : (
    <Navigate to="/pos" replace />
  );
}
function Login() {
  const navigate = useNavigate();
  const login = useAction(async (v: Record<string, string>) => {
    await refreshCsrf();
    await api.post("/auth/login", v);
    await refreshCsrf();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate("/", { replace: true });
  }, "Welcome back.");
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <ShoppingBag />
          </span>
          MiniShop<span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow light">MADE FOR YOUR EVERYDAY</span>
          <h1>
            A little shop.
            <br />A lot of possibility.
          </h1>
          <p>
            From the first sale to the last stock count.
            <br />
            Keep your business moving, together.
          </p>
          <div className="story-features">
            <span>
              <ShieldCheck />
              Your data stays with your shop
            </span>
            <span>
              <ShoppingCart />
              Simple sales, clear records
            </span>
            <span>
              <Users />
              Made for the people you know
            </span>
          </div>
        </div>
        <span className="story-footer">YOUR SHOP, IN ORDER.</span>
        <div className="story-orbit one" />
        <div className="story-orbit two" />
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="login-icon">
            <ShoppingBag />
          </span>
          <span className="eyebrow">LET’S OPEN UP SHOP</span>
          <h2>Welcome back</h2>
          <p>Sign in to your MiniShop workspace.</p>
          <DataForm
            fields={[
              {
                name: "email",
                label: "Email address",
                type: "email",
                required: true,
              },
              {
                name: "password",
                label: "Password",
                type: "password",
                required: true,
              },
            ]}
            onSubmit={(v) => login.mutate(v)}
            pending={login.isPending}
            submit="Sign in to MiniShop"
          />
          <p className="login-note">
            <ShieldCheck size={16} /> Secure access for owners and cashiers.
          </p>
          <small>
            First time here? Use the owner account created during setup. Your
            generated credentials are in the local setup file.
          </small>
        </div>
      </section>
    </main>
  );
}
const navigation = [
  {
    title: "Overview",
    items: [
      ["/", "Dashboard", LayoutDashboard, true],
      ["/pos", "Point of sale", ShoppingCart, false],
    ],
  },
  {
    title: "Manage your shop",
    items: [
      ["/products", "Products", Package, true],
      ["/inventory", "Inventory", Boxes, true],
      ["/receiving", "Stock receiving", Truck, true],
      ["/customers", "Customers", Users, false],
      ["/credit", "Utang accounts", CreditCard, false],
    ],
  },
  {
    title: "Business",
    items: [
      ["/sales", "Sales history", ReceiptText, false],
      ["/reports", "Reports", BarChart3, true],
      ["/employees", "Employees", ShieldCheck, true],
      ["/admin/development-progress", "Development progress", ListChecks, true],
    ],
  },
] as const;
function Shell() {
  const user = useUser(),
    owner = user.roles.includes("Owner");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const settings = useData<StoreSettings>("/settings");
  const logout = useAction(async () => {
    await api.post("/auth/logout");
    await queryClient.cancelQueries();
    queryClient.setQueryData(["session"], null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    await refreshCsrf();
    navigate("/login");
  }, "Signed out.");
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink to={owner ? "/" : "/pos"} className="brand">
          <span className="brand-mark">
            <ShoppingBag size={22} />
          </span>
          MiniShop<span className="brand-dot">.</span>
        </NavLink>
        <button
          className="icon-btn sidebar-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="workspace">
          <span className="store-avatar">
            {(settings.data?.storeName ?? "M")[0]}
          </span>
          <div>
            <strong>{settings.data?.storeName ?? "Your shop"}</strong>
            <span>Store workspace</span>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <span>{group.title}</span>
              {group.items
                .filter((i) => !i[3] || owner)
                .map(([url, label, Icon]) => (
                  <NavLink
                    key={url}
                    end={url === "/"}
                    to={url}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                  >
                    <Icon size={19} />
                    {label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {owner && (
            <NavLink to="/settings" className="nav-item">
              <Settings size={19} />
              Settings
            </NavLink>
          )}
          <div className="sidebar-help">
            <span className="help-symbol">✦</span>
            <strong>A good day starts here.</strong>
            <p>Small steps. A growing business.</p>
            <NavLink to="/pos">
              Make a sale <ArrowUpRight size={15} />
            </NavLink>
          </div>
          <div className="profile">
            <div className="avatar">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{owner ? "Store owner" : "Cashier"}</span>
            </div>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation overlay"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span className="topbar-breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>{settings.data?.storeName ?? "MiniShop"}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <i /> Local shop workspace
            </span>
            <NavLink to="/pos" className="btn small primary">
              <Plus size={16} />
              New sale
            </NavLink>
          </div>
        </header>
        {settings.data?.demoData && (
          <div className="demo-banner">
            Development workspace · Includes clearly labeled fictional demo
            products and customer records.
          </div>
        )}
        <main className="page">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>MiniShop · A little more organized, every day.</span>
          <span>Philippine Peso · Asia/Manila</span>
        </footer>
      </div>
    </div>
  );
}
