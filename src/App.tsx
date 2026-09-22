import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "./auth/AuthProvider";
import {
  change,
  createSampleOrders,
  localDate,
  money,
  periodOrders,
  summarize,
} from "./lib/sales";
import type { Order, Period } from "./lib/sales";
import { exportSales } from "./lib/export";

type Page = "Overview" | "Sales" | "Products" | "Customers" | "Settings";
const navigation: { name: Page; icon: LucideIcon }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Sales", icon: ShoppingBag },
  { name: "Products", icon: Package },
  { name: "Customers", icon: Users },
];
const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <BarChart3 size={23} strokeWidth={2.5} />
      </span>
      <span>
        AGS<span className="brand-light"> Insights</span>
        <small>BUSINESS, IN FOCUS.</small>
      </span>
    </div>
  );
}

function MicrosoftMark() {
  return (
    <span className="microsoft-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Login() {
  const { login, enterDemo, configured, demoEnabled, loading, error } =
    useAuth();
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="eyebrow">
            <span className="live-dot" /> A LITTLE CLARITY. A LOT OF
            POSSIBILITY.
          </span>
          <h1>
            Your business.
            <br />A clearer picture.
          </h1>
          <p>
            Bring your numbers into focus. Discover what’s working, spot new
            opportunities, and make your next move with confidence.
          </p>
          <div className="preview-card">
            <div className="preview-header">
              <span>Revenue at a glance</span>
              <TrendingUp size={19} />
            </div>
            <strong>
              €48,290
              <span>
                +18.6% <ArrowUpRight size={14} />
              </span>
            </strong>
            <div className="preview-bars" aria-hidden="true">
              {[31, 42, 37, 58, 49, 67, 59, 78, 71, 87, 79, 100].map(
                (height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
            <div className="preview-footer">
              <span>Good decisions start with good insights.</span>
              <span>Illustrative data</span>
            </div>
          </div>
        </div>
        <span className="login-copyright">
          A workspace for your next chapter.
        </span>
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <span className="welcome-icon">
            <Sparkles size={24} />
          </span>
          <span className="eyebrow">WELCOME TO AGS INSIGHTS</span>
          <h2>Let’s see the big picture.</h2>
          <p>
            Sign in with your Microsoft account to access your business
            workspace.
          </p>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <button
            className="microsoft-button"
            onClick={() => void login()}
            disabled={!configured || loading}
          >
            <MicrosoftMark />
            {loading ? "Connecting…" : "Continue with Microsoft"}
            <ArrowRight size={18} />
          </button>
          {!configured && (
            <div className="setup-note">
              <ShieldCheck size={18} />
              <span>
                Microsoft sign-in is waiting for your organization’s app
                configuration. See the setup guide in the README.
              </span>
            </div>
          )}
          {demoEnabled && (
            <>
              <div className="divider">
                <span>or take a look around</span>
              </div>
              <button
                className="demo-button"
                onClick={enterDemo}
                disabled={loading}
              >
                Explore the demo <ArrowRight size={17} />
              </button>
              <p className="demo-caption">
                No account needed. Sample data only.
              </p>
            </>
          )}
          <div className="login-security">
            <ShieldCheck size={17} />
            <span>Secure sign-in, powered by Microsoft.</span>
          </div>
        </div>
        <span className="login-bottom">
          AGS Insights <span>·</span> Built for better decisions
        </span>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  previous,
  current,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  previous: number;
  current: number;
  icon: LucideIcon;
  color: string;
}) {
  const delta = change(current, previous);
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-bottom">
        <span
          className={`trend ${delta !== null && delta < 0 ? "negative" : ""}`}
        >
          {delta !== null && delta < 0 ? (
            <ArrowDownLeft size={14} />
          ) : (
            <ArrowUpRight size={14} />
          )}
          {delta === null ? "New" : `${Math.abs(delta).toFixed(1)}%`}
        </span>
        <span>vs. previous period</span>
      </div>
    </article>
  );
}

function OrdersTable({
  orders,
  compact = false,
  onViewAll,
}: {
  orders: Order[];
  compact?: boolean;
  onViewAll?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(0);
  const filtered = orders.filter(
    (order) =>
      `${order.id} ${order.customer} ${order.product}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" || status === order.status),
  );
  const pageSize = compact ? 5 : 10;
  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section className="panel orders-panel">
      <div className="panel-heading">
        <div>
          <h2>{compact ? "Recent orders" : "All orders"}</h2>
          <p>
            {compact
              ? "The latest activity across your business."
              : `${filtered.length} orders in the selected period`}
          </p>
        </div>
        {compact && (
          <button className="text-button" onClick={onViewAll}>
            View all orders <ArrowRight size={15} />
          </button>
        )}
      </div>
      {!compact && (
        <div className="table-tools">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search orders"
              placeholder="Search orders, customers, products…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Filter order status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            {["All statuses", "Completed", "Processing", "Refunded"].map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Date</th>
              <th>Status</th>
              <th className="amount-cell">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id}>
                <td className="order-id">#{order.id.slice(4)}</td>
                <td>
                  <div className="customer-cell">
                    <span className="avatar">{initials(order.customer)}</span>
                    <span>
                      {order.customer}
                      <small>{order.email}</small>
                    </span>
                  </div>
                </td>
                <td>{order.product}</td>
                <td className="muted nowrap">
                  {new Date(`${order.date}T12:00:00`).toLocaleDateString(
                    "en-GB",
                    { month: "short", day: "numeric" },
                  )}
                </td>
                <td>
                  <span
                    className={`status status-${order.status.toLowerCase()}`}
                  >
                    <i />
                    {order.status}
                  </span>
                </td>
                <td className="amount-cell">{money(order.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="empty-state">
            <Search size={24} />
            <h3>No orders found</h3>
            <p>Try another search or status filter.</p>
          </div>
        )}
      </div>
      {!compact && (
        <div className="table-pagination">
          <span>
            {filtered.length ? currentPage * pageSize + 1 : 0}–
            {Math.min((currentPage + 1) * pageSize, filtered.length)} of{" "}
            {filtered.length} orders
          </span>
          <div>
            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <button
              disabled={currentPage === maxPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const { user, demo, logout, configured, error } = useAuth();
  const [page, setPage] = useState<Page>("Overview");
  const [period, setPeriod] = useState<Period>(30);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [now] = useState(() => new Date());
  const [allOrders] = useState(() => createSampleOrders(now));
  const orders = useMemo(
    () => periodOrders(allOrders, period, now),
    [allOrders, period, now],
  );
  const stats = summarize(orders);
  const previous = summarize(periodOrders(allOrders, period, now, true));
  const chart = Array.from({ length: period }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - period + index + 1);
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - period);
    return {
      label: date.toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      }),
      revenue: summarize(
        orders.filter((order) => order.date === localDate(date)),
      ).revenue,
      previous: summarize(
        allOrders.filter((order) => order.date === localDate(previousDate)),
      ).revenue,
    };
  });
  const productStats = [...new Set(orders.map((order) => order.product))]
    .map((product) => {
      const matching = orders.filter((order) => order.product === product);
      return {
        name: product,
        category: matching[0].category,
        ...summarize(matching),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const customerStats = [...new Set(orders.map((order) => order.email))]
    .map((email) => {
      const matching = orders.filter((order) => order.email === email);
      return { name: matching[0].customer, email, ...summarize(matching) };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const channels = ["Online store", "Retail", "Partners"].map((channel) => ({
    name: channel,
    value: summarize(orders.filter((order) => order.channel === channel))
      .revenue,
  }));
  const topCategory = ["Electronics", "Accessories", "Home & living"]
    .map((name) => ({
      name,
      value: summarize(orders.filter((order) => order.category === name))
        .revenue,
    }))
    .sort((a, b) => b.value - a.value)[0];
  const start = new Date(now);
  start.setDate(start.getDate() - period + 1);
  const dateLabel = `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  function navigate(next: Page) {
    setPage(next);
    setMenuOpen(false);
    setNotice("");
  }
  async function exportOrders() {
    try {
      setNotice(await exportSales(orders, period));
    } catch {
      setNotice(
        "Export was canceled or could not be completed. Please try again.",
      );
    }
  }

  return (
    <div className="app-layout">
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <Brand />
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <span>
            AGS Workspace<small>Business analytics</small>
          </span>
          <span className="workspace-tag">PRO</span>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => navigate(name)}
              aria-current={page === name ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{name}</span>
              {page === name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={19} />
            </span>
            <h3>Numbers tell a story.</h3>
            <p>Find yours, one insight at a time.</p>
            <button
              onClick={() => {
                navigate("Overview");
                setNotice(
                  "Start with the date filter to compare your sales with the previous period.",
                );
              }}
            >
              Explore your insights <ArrowRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} />
            Settings
          </button>
          <button
            className="nav-item"
            onClick={() =>
              setNotice(
                "Need a hand? Revenue includes completed orders only. Choose a period to update every chart and table, or export your orders as CSV.",
              )
            }
          >
            <CircleHelp size={19} />
            Help & getting started
          </button>
          <div className="sidebar-user">
            <span className="avatar user-avatar">{initials(user!.name)}</span>
            <span>
              {user!.name}
              <small>{demo ? "Demo workspace" : "Microsoft account"}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="sample-badge">
              <span />
              Sample data
            </span>
            <span className="topbar-divider" />
            <span className="avatar user-avatar" title={user!.name}>
              {initials(user!.name)}
            </span>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR BUSINESS AT A GLANCE</span>
              <h1>
                {page === "Overview" ? "Overview" : page}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === "Overview"
                  ? `Welcome back, ${user!.name.split(" ")[0]}. Here’s how your business is doing.`
                  : page === "Sales"
                    ? "Every order, all in one place."
                    : page === "Products"
                      ? "Get to know your best performers."
                      : page === "Customers"
                        ? "A closer look at the people behind your sales."
                        : "Your workspace, connected."}
              </p>
            </div>
            {page !== "Settings" && (
              <div className="page-actions">
                <label className="period-select">
                  <CalendarDays size={17} />
                  <select
                    aria-label="Date range"
                    value={period}
                    onChange={(event) =>
                      setPeriod(Number(event.target.value) as Period)
                    }
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
                <button className="primary-button" onClick={exportOrders}>
                  <ArrowDownToLine size={16} />
                  Export report
                </button>
              </div>
            )}
          </div>
          {(notice || error) && (
            <div className={error ? "error-message" : "notice"} role="status">
              <span>{error || notice}</span>
              {notice && (
                <button
                  className="icon-button"
                  aria-label="Dismiss message"
                  onClick={() => setNotice("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          {page !== "Settings" && (
            <>
              <div className="report-context">
                <span>
                  <span className="live-dot" />
                  Performance summary
                </span>
                <span>{dateLabel}</span>
              </div>
              <div className="metrics-grid">
                <Metric
                  label="Total revenue"
                  value={money(stats.revenue)}
                  current={stats.revenue}
                  previous={previous.revenue}
                  icon={CreditCard}
                  color="purple"
                />
                <Metric
                  label="Total orders"
                  value={stats.orders.toLocaleString()}
                  current={stats.orders}
                  previous={previous.orders}
                  icon={ShoppingBag}
                  color="blue"
                />
                <Metric
                  label="Customers"
                  value={stats.customers.toLocaleString()}
                  current={stats.customers}
                  previous={previous.customers}
                  icon={Users}
                  color="orange"
                />
                <Metric
                  label="Average order value"
                  value={money(stats.average)}
                  current={stats.average}
                  previous={previous.average}
                  icon={TrendingUp}
                  color="green"
                />
              </div>
            </>
          )}
          {page === "Overview" && (
            <>
              <div className="charts-grid">
                <section className="panel revenue-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Revenue overview</h2>
                      <p>A little perspective on your performance.</p>
                    </div>
                    <span className="small-tag">EUR</span>
                  </div>
                  <div className="chart-summary">
                    <strong>{money(stats.revenue)}</strong>
                    <div className="chart-legend">
                      <span>
                        <i />
                        This period
                      </span>
                      <span>
                        <i />
                        Previous period
                      </span>
                    </div>
                  </div>
                  <div
                    className="revenue-chart"
                    role="img"
                    aria-label={`Daily completed sales revenue over the last ${period} days compared with the previous period`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chart}
                        margin={{ top: 12, right: 10, left: -18, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="revenueFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#6676ef"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="100%"
                              stopColor="#6676ef"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="#edf0f5"
                          strokeDasharray="4 4"
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={45}
                          tick={{ fill: "#9299aa", fontSize: 11 }}
                          tickMargin={12}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#9299aa", fontSize: 11 }}
                          tickFormatter={(value) => money(Number(value), true)}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            money(Number(value)),
                            name === "revenue"
                              ? "This period"
                              : "Previous period",
                          ]}
                          contentStyle={{
                            border: "1px solid #e9edf5",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="previous"
                          stroke="#bec7dd"
                          strokeDasharray="5 5"
                          fill="transparent"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#6575ed"
                          fill="url(#revenueFill)"
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footnote">
                    <span className="live-dot" />
                    Completed orders · Compared with the preceding {period} days
                  </div>
                </section>
                <section className="panel channels-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Sales by channel</h2>
                      <p>Where your revenue comes from.</p>
                    </div>
                  </div>
                  <div className="donut-wrap">
                    <div
                      className="donut"
                      style={{
                        background: `conic-gradient(#6475eb 0 ${(channels[0].value / (stats.revenue || 1)) * 100}%, #a4b2f9 0 ${((channels[0].value + channels[1].value) / (stats.revenue || 1)) * 100}%, #e1e6fc 0 100%)`,
                      }}
                      role="img"
                      aria-label={channels
                        .map(
                          (channel) =>
                            `${channel.name}: ${money(channel.value)}`,
                        )
                        .join(", ")}
                    >
                      <div>
                        <span>Total revenue</span>
                        <strong>{money(stats.revenue, true)}</strong>
                        <span>across 3 channels</span>
                      </div>
                    </div>
                  </div>
                  <div className="channel-legend">
                    {channels.map((channel, index) => (
                      <div key={channel.name}>
                        <span>
                          <i className={`channel-dot dot-${index}`} />
                          {channel.name}
                        </span>
                        <strong>{money(channel.value, true)}</strong>
                        <small>
                          {Math.round(
                            (channel.value / (stats.revenue || 1)) * 100,
                          )}
                          %
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="insight-strip">
                <span className="insight-icon">
                  <Sparkles size={20} />
                </span>
                <div>
                  <strong>A small insight, a bigger opportunity.</strong>
                  <p>
                    {topCategory.name} accounts for{" "}
                    {Math.round(
                      (topCategory.value / (stats.revenue || 1)) * 100,
                    )}
                    % of completed sales revenue this period. Take a closer look
                    at your top products.
                  </p>
                </div>
                <button onClick={() => navigate("Products")}>
                  Explore products <ArrowRight size={16} />
                </button>
              </div>
              <OrdersTable
                orders={orders}
                compact
                onViewAll={() => navigate("Sales")}
              />
            </>
          )}
          {page === "Sales" && <OrdersTable orders={orders} />}
          {page === "Products" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Product performance</h2>
                  <p>Ranked by completed sales revenue.</p>
                </div>
                <Package size={20} />
              </div>
              <div className="product-grid">
                {productStats.map((product, index) => (
                  <article className="product-card" key={product.name}>
                    <div
                      className={`product-illustration product-color-${index % 3}`}
                    >
                      <Package size={35} strokeWidth={1.3} />
                      <span>0{index + 1}</span>
                    </div>
                    <span className="eyebrow">{product.category}</span>
                    <h3>{product.name}</h3>
                    <div>
                      <strong>{money(product.revenue)}</strong>
                      <span>{product.orders} orders</span>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${(product.revenue / (productStats[0].revenue || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {page === "Customers" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Your customers</h2>
                  <p>Ranked by completed sales revenue in this period.</p>
                </div>
                <Users size={20} />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Orders</th>
                      <th className="amount-cell">Total spent</th>
                      <th className="amount-cell">Average order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerStats.map((customer) => (
                      <tr key={customer.email}>
                        <td>
                          <div className="customer-cell">
                            <span className="avatar">
                              {initials(customer.name)}
                            </span>
                            <span>
                              {customer.name}
                              <small>{customer.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>{customer.orders}</td>
                        <td className="amount-cell">
                          {money(customer.revenue)}
                        </td>
                        <td className="amount-cell">
                          {money(customer.average)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "Settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <ShieldCheck size={27} />
                <h2>Your account</h2>
                <p>
                  You’re using {demo ? "a demo account" : "Microsoft sign-in"}.
                </p>
                <dl>
                  <dt>Name</dt>
                  <dd>{user!.name}</dd>
                  <dt>Email</dt>
                  <dd>{user!.email}</dd>
                  <dt>Microsoft configuration</dt>
                  <dd>{configured ? "Configured" : "Not configured"}</dd>
                </dl>
                <button
                  className="secondary-button"
                  onClick={() => void logout()}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </section>
              <section className="panel settings-panel">
                <BarChart3 size={27} />
                <h2>Workspace data</h2>
                <p>
                  This starter workspace uses sample sales data. Connect your
                  sales API to show your organization’s real performance.
                </p>
                <div className="settings-check">
                  <Check size={17} />
                  Currency: EUR
                </div>
                <div className="settings-check">
                  <Check size={17} />
                  Revenue: completed orders only
                </div>
                <div className="settings-check">
                  <Check size={17} />
                  180 days of sample activity
                </div>
                <div className="settings-check">
                  <Check size={17} />
                  Exports: CSV format
                </div>
              </section>
            </div>
          )}
          <footer className="dashboard-footer">
            <span>© {now.getFullYear()} AGS Insights</span>
            <span>
              Made for a clearer perspective.
              <span className="footer-dot">·</span>Sample data workspace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <span className="spinner" />
        <p>Opening your workspace…</p>
      </div>
    );
  return user ? <Dashboard /> : <Login />;
}
