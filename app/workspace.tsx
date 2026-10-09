"use client";
import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { signOut } from "next-auth/react";
import {
  LoaderCircle,
  Aperture,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  FileUp,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  Wrench,
  Truck,
  BarChart3,
  Bell,
  ShieldCheck,
  Clock,
  MessageCircle,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { bookingNumber, money, defaultSettings } from "@/lib/domain";
import type { snapshot } from "@/lib/service";
import ProductPhotoEditor, { productPhotoUrl } from "./product-photo";
type Json<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
type Data = Json<Awaited<ReturnType<typeof snapshot>>>;
type Booking = Data["bookings"][number];
type Equipment = Data["inventory"][number];
type Preview = {
  hash: string;
  alreadyImported: boolean;
  bookings: {
    row: number;
    customer: string;
    equipment: string;
    total: number | null;
    warnings: string[];
    errors: string[];
  }[];
  inventory: { name: string; warnings: string[]; errors: string[] }[];
};
const navigation = [
  ["Dashboard", LayoutDashboard],
  ["Bookings", Camera],
  ["Calendar", CalendarDays],
  ["Inventory", Package],
  ["Customers", Users],
  ["Collections", Wallet],
  ["Vendors", Truck],
  ["Reports", BarChart3],
  ["Settings", Settings],
] as const;
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  BOOKED: "Booked",
  PICKED_UP: "Picked up",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};
const date = (v: string | null | undefined, withTime = false) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: withTime ? "numeric" : undefined,
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "Not recorded";
const localInput = (v?: string | null) =>
  v ? new Date(+new Date(v) + 19800000).toISOString().slice(0, 16) : "";
const iso = (v: FormDataEntryValue | null) =>
  v ? new Date(`${v}:00+05:30`).toISOString() : null;
const rupees = (v: number | null | undefined) =>
  v == null ? "" : String(v / 100);
const paise = (v: FormDataEntryValue | null) =>
  v === "" || v === null ? null : Math.round(Number(v) * 100);
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase().replace(/\s/g, "-")}`}>
      {statusLabels[value] ?? value}
    </span>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <label>
      <span id={id}>{label}</span>
      {isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            { "aria-labelledby": id },
          )
        : children}
    </label>
  );
}
function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Aperture size={36} />
      <h3>{title}</h3>
      <p>Your workspace will grow as you add records.</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),select,textarea",
          ) ?? [],
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <header>
          <div>
            <span className="eyebrow">CAMNOVA WORKSPACE</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export default function Workspace({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial),
    [view, setView] = useState("Dashboard"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [month, setMonth] = useState(initial.month),
    [dialog, setDialog] = useState<{ kind: string; record?: unknown } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<number[]>([]),
    [mapping, setMapping] = useState<Record<string, number>>({
      date: 2,
      customer: 3,
      phone: 4,
      equipment: 5,
      total: 6,
      paid: 7,
      mode: 8,
      status: 11,
      outsourced: 12,
      cost: 13,
      referral: 15,
      notes: 16,
    });
  const owner = data.actor.role === "ADMIN";
  const close = () => {
    setDialog(null);
    setError("");
    setPreview(null);
    setFile(null);
  };
  const seenRequests = useRef(
    new Set(
      data.bookings
        .filter((b) => b.status === "DRAFT" && b.customerAccountId)
        .map((b) => b.id),
    ),
  );
  const [newRequests, setNewRequests] = useState<number[]>([]);
  async function reload(m = month) {
    const r = await fetch(`/api/snapshot?month=${m}`);
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    const fresh: Booking[] = result.bookings;
    const newIds = fresh
      .filter(
        (b) =>
          b.status === "DRAFT" &&
          b.customerAccountId &&
          !seenRequests.current.has(b.id),
      )
      .map((b) => b.id);
    if (newIds.length)
      setNewRequests((previous) => [...new Set([...previous, ...newIds])]);
    fresh.forEach((b) => seenRequests.current.add(b.id));
    setData(result);
  }
  async function submit(path: string, body: unknown, keep = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/${path.replace(/^\/api\//, "")}`, {
        method: "POST",
        headers:
          body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" },
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await reload();
      if (keep && path === "assets") {
        const r = await fetch(`/api/snapshot?month=${month}`);
        const fresh: Data = await r.json();
        setData(fresh);
        setDialog((current) =>
          current?.kind === "assets"
            ? {
                kind: "assets",
                record: fresh.inventory.find(
                  (eq) => eq.id === (current.record as Equipment).id,
                ),
              }
            : current,
        );
      }
      if (!keep) close();
      setNotice("Saved successfully");
      setTimeout(() => setNotice(""), 3500);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const open = (kind: string, record?: unknown) => {
    setError("");
    setDialog({ kind, record });
  };
  const move = (v: string) => {
    setView(v);
    setQuery("");
    setFilter("All");
    setMobile(false);
  };
  const b = dialog?.record as Booking | undefined;
  const m = data.metrics;
  const matches = (text: string) =>
    text.toLowerCase().includes(query.toLowerCase());
  const bookingMatches = (b: Booking) =>
    matches(
      `${bookingNumber(b.id)} ${b.customer?.name} ${b.equipmentText} ${b.items.map((i) => i.equipment.name).join(" ")} ${b.customer?.phones.join(" ")}`,
    ) &&
    (filter === "All" || b.status === filter || b.paymentStatus === filter);
  const pendingRequests = data.bookings.filter(
    (b) => b.status === "DRAFT" && !b.historical,
  );
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) reload().catch(() => {});
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [month]);
  const outstanding = data.bookings
    .filter(
      (b) =>
        b.status !== "CANCELLED" &&
        b.status !== "DRAFT" &&
        ["Pending", "Partial"].includes(b.paymentStatus),
    )
    .sort((a, b) => +new Date(a.bookingDate) - +new Date(b.bookingDate));
  const currentMonthBookings = data.bookings.filter(
    (b) => b.bookingDate.slice(0, 7) === month && b.status !== "DRAFT",
  );
  const upcoming = data.bookings
    .filter((b) => ["BOOKED", "PICKED_UP"].includes(b.status) && !b.historical)
    .sort((a, b) => +new Date(a.pickupAt!) - +new Date(b.pickupAt!));
  function exports(kind: string) {
    return (
      <div className="export-menu">
        <a
          className="button"
          href={`/api/export/${kind}?format=xlsx${kind === "reports" ? `&month=${month}` : ""}`}
        >
          <Download size={15} />
          Excel
        </a>
        <a
          className="button"
          href={`/api/export/${kind}?format=csv${kind === "reports" ? `&month=${month}` : ""}`}
        >
          CSV
        </a>
      </div>
    );
  }
  function bookingTable(rows: Booking[], compact = false) {
    return rows.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Booking / customer</th>
              <th>Equipment</th>
              <th>Rental date</th>
              <th>Amount</th>
              <th>Payment</th>
              {!compact && <th>Order status</th>}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>
                  <button
                    className="text-link"
                    onClick={() => open("detail", b)}
                  >
                    {bookingNumber(b.id)}
                  </button>
                  <strong>{b.customer?.name ?? "Customer needed"}</strong>
                  <small>
                    {b.sourceRef
                      ? `Imported ${b.sourceRef}`
                      : b.referral || "Direct booking"}
                  </small>
                </td>
                <td>
                  <div className="gear-name">
                    {b.equipmentText ||
                      b.items
                        .map((i) => `${i.equipment.name} × ${i.quantity}`)
                        .join(", ") ||
                      "Equipment not added"}
                  </div>
                  {b.warnings.length > 0 && (
                    <small className="warning-text">
                      <AlertCircle size={12} />
                      Needs review
                    </small>
                  )}
                </td>
                <td>
                  {date(b.pickupAt || b.bookingDate)}
                  <small>
                    {b.returnAt
                      ? `to ${date(b.returnAt)}`
                      : b.historical
                        ? "Historical booking"
                        : "Rental dates needed"}
                  </small>
                </td>
                <td className="numeric">
                  <strong>{money(b.total)}</strong>
                  <small>
                    {b.balance! > 0
                      ? `${money(b.balance)} due`
                      : "No balance due"}
                  </small>
                </td>
                <td>
                  <Badge value={b.paymentStatus} />
                </td>
                {!compact && (
                  <td>
                    <Badge value={b.status} />
                  </td>
                )}
                <td>
                  {b.status === "DRAFT" && !b.historical && (
                    <button
                      className="primary"
                      onClick={() => open("confirm", b)}
                    >
                      Review & confirm
                    </button>
                  )}
                  {owner && !compact && (
                    <button
                      className="button danger"
                      onClick={() => open("delete", b)}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`View ${bookingNumber(b.id)}`}
                    onClick={() => open("detail", b)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No bookings found"
        action={
          <button className="primary" onClick={() => open("booking")}>
            Create booking
          </button>
        }
      />
    );
  }
  function tools(extra?: ReactNode) {
    return (
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            aria-label={`Search ${view.toLowerCase()}`}
            placeholder={`Search ${view.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {extra}
      </div>
    );
  }
  function whatsApp(
    book: Booking,
    type: keyof typeof defaultSettings.templates,
  ) {
    const phone = book.customer?.phones[0]?.replace(/\D/g, "");
    if (!phone || ![10, 12].includes(phone.length)) {
      setError("Review the customer phone number before opening WhatsApp.");
      return;
    }
    const vars: Record<string, string> = {
      customer: book.customer?.name ?? "",
      booking: bookingNumber(book.id),
      total: money(book.total),
      balance: money(book.balance),
      pickup: date(book.pickupAt, true),
      return: date(book.returnAt, true),
    };
    const message = data.settings.templates[type].replace(
      /\{(\w+)\}/g,
      (_, key) => vars[key] ?? "",
    );
    window.open(
      `https://wa.me/${phone.length === 10 ? "91" : ""}${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  return (
    <div className="workspace">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <img src="/logo.png" alt="CAMNOVA Rentals" />
        </div>
        <div className="workspace-label">RENTAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              aria-label={label}
              className={view === label ? "active" : ""}
              onClick={() => move(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Bookings" && pendingRequests.length > 0 && (
                <em aria-label={`${pendingRequests.length} pending requests`}>
                  {pendingRequests.length}
                </em>
              )}
              {label === "Collections" && outstanding.length > 0 && (
                <em>{outstanding.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <Aperture size={23} />
            <h4>Keep creativity moving.</h4>
            <p>Your gear. Their next great story.</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={16} />
            Sign out
          </button>
          <div className="profile">
            <span className="avatar">{data.actor.name[0]}</span>
            <div>
              <strong>{data.actor.name}</strong>
              <small>{owner ? "Workspace owner" : "Rental staff"}</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <span className="live-dot" />
            <span className="desktop-only">All systems in focus</span>
            <button
              className="icon-button"
              onClick={() => move("Collections")}
              aria-label="View pending collections"
            >
              <Bell size={18} />
            </button>
            <span className="avatar small">{data.actor.name[0]}</span>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">CAMNOVA RENTALS</span>
              <h1>
                {view === "Dashboard" ? "Your business, in focus." : view}
              </h1>
              <p>
                {
                  (
                    {
                      Dashboard:
                        "A clear view of your bookings, gear and cash flow.",
                      Bookings: "From first enquiry to the final return.",
                      Calendar:
                        "Every pickup, return and reservation in one place.",
                      Inventory: "The tools behind their next great story.",
                      Customers: "Good relationships make great productions.",
                      Collections: "Keep track of what’s coming your way.",
                      Vendors: "A wider kit. A stronger network.",
                      Reports: "Understand the numbers behind the frame.",
                      Settings: "Make this workspace yours.",
                    } as Record<string, string>
                  )[view]
                }
              </p>
            </div>
            <div className="heading-actions">
              {["Dashboard", "Reports", "Calendar"].includes(view) && (
                <label className="month-picker">
                  <CalendarDays size={16} />
                  <input
                    aria-label="Report month"
                    type="month"
                    value={month}
                    onChange={async (e) => {
                      setMonth(e.target.value);
                      try {
                        await reload(e.target.value);
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  />
                </label>
              )}
              {["Dashboard", "Bookings", "Calendar"].includes(view) && (
                <button className="primary" onClick={() => open("booking")}>
                  <Plus size={17} />
                  New booking
                </button>
              )}
            </div>
          </div>
          {busy && (
            <div className="app-loading" role="status">
              <LoaderCircle className="loading-spin" size={22} /> Saving
              changes…
            </div>
          )}
          {newRequests.length > 0 && (
            <div className="request-notification" role="status">
              <Bell size={20} />
              <strong>
                {newRequests.length} new booking request
                {newRequests.length > 1 ? "s" : ""}
              </strong>
              <button
                className="primary"
                onClick={() => {
                  move("Bookings");
                  setFilter("DRAFT");
                  setNewRequests([]);
                }}
              >
                View requests
              </button>
              <button
                aria-label="Dismiss booking notification"
                onClick={() => setNewRequests([])}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
          {error && !dialog && (
            <div role="alert" className="error banner">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {view === "Dashboard" && (
            <>
              <section className="stats-grid">
                <Stat
                  label="Booked revenue"
                  value={money(m.revenue)}
                  icon={<IndianRupee size={18} />}
                  foot={`${m.bookings} bookings this month`}
                  featured
                />
                <Stat
                  label="Payments collected"
                  value={money(m.collected)}
                  icon={<ArrowDownLeft size={18} />}
                  foot={`${Math.round(m.collectionRate * 100)}% of booked revenue`}
                />
                <Stat
                  label="Outstanding balance"
                  value={money(m.outstanding)}
                  icon={<Wallet size={18} />}
                  foot={`${m.unpaid} bookings awaiting payment`}
                />
                <Stat
                  label="After outsourcing"
                  value={money(m.afterOutsourcing)}
                  icon={<BarChart3 size={18} />}
                  foot={`${money(m.outsourceCost)} in agreed vendor costs`}
                />
              </section>
              <section className="dashboard-middle">
                <div className="panel revenue-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">THE BIG PICTURE</span>
                      <h3>Revenue by weekday</h3>
                    </div>
                    <span className="legend">
                      <i />
                      Booked revenue
                    </span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...m.weekday.slice(1), m.weekday[0]]}
                        margin={{ left: -10, right: 10, top: 12, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#737373" }}
                        />
                        <YAxis
                          tickFormatter={(v) => `₹${v / 100000}k`}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#737373" }}
                        />
                        <Tooltip
                          formatter={(v) => money(Number(v))}
                          cursor={{ fill: "#f5f5f5" }}
                        />
                        <Bar
                          dataKey="revenue"
                          isAnimationActive={false}
                          fill="#ed1a3a"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footer">
                    <span>
                      Average booking <strong>{money(m.average)}</strong>
                    </span>
                    <button
                      className="text-link"
                      onClick={() => move("Reports")}
                    >
                      Explore reports
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="panel schedule-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">ON YOUR RADAR</span>
                      <h3>Upcoming rentals</h3>
                    </div>
                    <CalendarDays size={20} />
                  </div>
                  {upcoming.slice(0, 3).map((b) => (
                    <button
                      className="schedule-row"
                      key={b.id}
                      onClick={() => open("detail", b)}
                    >
                      <span className="date-tile">
                        {new Date(b.pickupAt!).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          month: "short",
                        })}
                        <strong>
                          {new Date(b.pickupAt!).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                          })}
                        </strong>
                      </span>
                      <span>
                        <strong>{b.customer?.name}</strong>
                        <small>
                          {bookingNumber(b.id)} · {b.items.length} equipment
                          types
                        </small>
                        <Badge value={b.status} />
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!upcoming.length && (
                    <p className="empty-small">
                      No upcoming rentals. A little room for the next big idea.
                    </p>
                  )}
                  <button
                    className="schedule-link"
                    onClick={() => move("Calendar")}
                  >
                    Open rental calendar
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
              <section className="quick-strip">
                <div>
                  <span className="quick-icon">
                    <Package size={20} />
                  </span>
                  <div>
                    <strong>
                      {data.inventory.reduce((n, e) => n + e.assets.length, 0)}{" "}
                      pieces of possibility
                    </strong>
                    <small>
                      {data.inventory.length} equipment models in your inventory
                    </small>
                  </div>
                </div>
                <button className="text-link" onClick={() => move("Inventory")}>
                  Manage inventory
                  <ArrowRight size={16} />
                </button>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">RECENT ACTIVITY</span>
                    <h3>Latest bookings</h3>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => move("Bookings")}
                  >
                    View all bookings
                    <ArrowRight size={15} />
                  </button>
                </div>
                {bookingTable(data.bookings.slice(0, 5), true)}
              </section>
              <p className="footnote">
                Booking-date view · Asia/Kolkata · Rental payments exclude
                refundable deposits. Demo records are fictional.
              </p>
            </>
          )}
          {view === "Bookings" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>
                    Booking log{" "}
                    <span className="count">{data.bookings.length}</span>
                  </h3>
                  <p>
                    Stable references. Clear status. Every rental accounted for.
                  </p>
                </div>
                <div className="heading-actions">
                  {owner && (
                    <button className="button" onClick={() => open("import")}>
                      <FileUp size={15} />
                      Import workbook
                    </button>
                  )}
                  {exports("bookings")}
                </div>
              </div>
              {tools(
                <select
                  aria-label="Filter bookings"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  <option>Pending</option>
                  <option>Partial</option>
                  <option>Paid</option>
                </select>,
              )}
              <div className="detail-actions">
                <button
                  className={filter === "DRAFT" ? "primary" : "button"}
                  onClick={() => {
                    setFilter("DRAFT");
                    setQuery("");
                  }}
                >
                  Booking requests ({pendingRequests.length})
                </button>
                <button
                  className={filter === "All" ? "primary" : "button"}
                  onClick={() => setFilter("All")}
                >
                  All bookings
                </button>
                <small>
                  Staff can confirm requests directly. Payment can be collected
                  later.
                </small>
              </div>
              {bookingTable(data.bookings.filter(bookingMatches))}
            </section>
          )}
          {view === "Collections" && (
            <>
              <section className="stats-grid three">
                <Stat
                  label="Total outstanding"
                  value={money(
                    outstanding.reduce((n, b) => n + (b.balance ?? 0), 0),
                  )}
                  icon={<Wallet size={18} />}
                  foot="Across all booking months"
                  featured
                />
                <Stat
                  label="Awaiting collection"
                  value={String(outstanding.length)}
                  icon={<Users size={18} />}
                  foot="Pending and partially paid bookings"
                />
                <Stat
                  label="Overdue payments"
                  value={String(
                    outstanding.filter(
                      (b) => b.dueAt && new Date(b.dueAt) < new Date(),
                    ).length,
                  )}
                  icon={<Clock size={18} />}
                  foot="Based on payment due date"
                />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Who still owes you</h3>
                  {exports("collections")}
                </div>
                {tools()}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer / booking</th>
                        <th>Outstanding</th>
                        <th>Age / due date</th>
                        <th>Follow-up</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.filter(bookingMatches).map((b) => (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.customer?.name}</strong>
                            <button
                              className="text-link"
                              onClick={() => open("detail", b)}
                            >
                              {bookingNumber(b.id)}
                            </button>
                            <small>
                              {b.customer?.rawPhone ||
                                b.customer?.phones.join(", ") ||
                                "Phone not added"}
                            </small>
                          </td>
                          <td>
                            <strong>{money(b.balance)}</strong>
                            <Badge value={b.paymentStatus} />
                          </td>
                          <td>
                            {Math.max(
                              0,
                              Math.floor(
                                (Date.now() - +new Date(b.bookingDate)) /
                                  86400000,
                              ),
                            )}{" "}
                            days since booking
                            <small>Due: {date(b.dueAt)}</small>
                            {b.dueAt && new Date(b.dueAt) < new Date() && (
                              <Badge value="Overdue" />
                            )}
                          </td>
                          <td>
                            {b.followupNote || "No follow-up yet"}
                            <small>{date(b.followupAt, true)}</small>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="button"
                                onClick={() => open("payment", b)}
                              >
                                <Plus size={14} />
                                Payment
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Message ${b.customer?.name}`}
                                onClick={() => whatsApp(b, "collection")}
                              >
                                <MessageCircle size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Follow up ${bookingNumber(b.id)}`}
                                onClick={() => open("followup", b)}
                              >
                                <Clock size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!outstanding.length && (
                  <Empty title="All caught up. No outstanding payments." />
                )}
              </section>
            </>
          )}
          {view === "Inventory" && (
            <>
              <section className="stats-grid three">
                <Stat
                  label="Equipment models"
                  value={String(data.inventory.length)}
                  icon={<Camera size={18} />}
                  foot={`${data.inventory.reduce((n, e) => n + e.assets.length, 0)} individual units`}
                  featured
                />
                <Stat
                  label="Inventory investment"
                  value={money(m.investment)}
                  icon={<IndianRupee size={18} />}
                  foot="Sum of recorded asset purchase costs"
                />
                <Stat
                  label="Rates to complete"
                  value={String(m.unpriced)}
                  icon={<AlertCircle size={18} />}
                  foot="Unset rates are never treated as free"
                />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Your equipment</h3>
                  <div className="heading-actions">
                    {exports("inventory")}
                    {owner && (
                      <button
                        className="primary"
                        onClick={() => open("inventory")}
                      >
                        <Plus size={16} />
                        Add equipment
                      </button>
                    )}
                  </div>
                </div>
                {tools(
                  <select
                    value={filter}
                    aria-label="Equipment category"
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option>All</option>
                    {Array.from(
                      new Set(data.inventory.map((e) => e.category)),
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>,
                )}
                <div className="inventory-grid">
                  {data.inventory
                    .filter(
                      (e) =>
                        matches(e.name) &&
                        (filter === "All" || filter === e.category),
                    )
                    .map((e) => {
                      const reserved = data.bookings
                        .filter(
                          (b) =>
                            ["BOOKED", "PICKED_UP"].includes(b.status) &&
                            !b.historical &&
                            b.pickupAt &&
                            b.returnAt &&
                            new Date(b.pickupAt) <= new Date() &&
                            (new Date(b.returnAt) > new Date() ||
                              b.status === "PICKED_UP"),
                        )
                        .flatMap((b) => b.items)
                        .filter((i) => i.equipmentId === e.id)
                        .reduce((n, i) => n + i.quantity - i.returned, 0);
                      return (
                        <button
                          className="equipment-card"
                          key={e.id}
                          onClick={() => open("assets", e)}
                        >
                          <div className="equipment-visual">
                            {e.photo ? (
                              <img
                                src={productPhotoUrl(e.id, e.photo.updatedAt)}
                                alt={e.name}
                                loading="lazy"
                              />
                            ) : (
                              <EquipmentIcon category={e.category} />
                            )}
                            <span className="category-label">{e.category}</span>
                          </div>
                          <div className="equipment-body">
                            <h3>{e.name}</h3>
                            <div className="equipment-rate">
                              {e.rate === null ? (
                                <span className="warning-text">
                                  Rate not set
                                </span>
                              ) : (
                                <>
                                  <strong>{money(e.rate)}</strong>
                                  <small>/ day</small>
                                </>
                              )}
                            </div>
                            <div className="equipment-footer">
                              <span>
                                {Math.max(
                                  0,
                                  e.assets.filter(
                                    (a) => a.status === "AVAILABLE",
                                  ).length - reserved,
                                )}{" "}
                                available now / {e.assets.length}
                              </span>
                              <ArrowUpRight size={16} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </section>
            </>
          )}
          {view === "Customers" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  Customer directory{" "}
                  <span className="count">{data.customers.length}</span>
                </h3>
                <button className="primary" onClick={() => open("customer")}>
                  <Plus size={16} />
                  Add customer
                </button>
              </div>
              {tools()}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Bookings</th>
                      <th>Outstanding</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers
                      .filter((c) =>
                        matches(
                          `${c.name} ${c.phones.join(" ")} ${c.rawPhone}`,
                        ),
                      )
                      .map((c) => {
                        const bs = data.bookings.filter(
                          (b) => b.customerId === c.id,
                        );
                        return (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.name}</strong>
                              <small>
                                {c.referral || "No referral recorded"}
                              </small>
                            </td>
                            <td>
                              {c.phones.join(", ") ||
                                c.rawPhone ||
                                "Phone not added"}
                              <small>{c.email}</small>
                            </td>
                            <td>
                              {bs.length}
                              <small>
                                {bs.map((b) => bookingNumber(b.id)).join(", ")}
                              </small>
                            </td>
                            <td>
                              {money(
                                bs
                                  .filter((b) => b.status !== "CANCELLED")
                                  .reduce(
                                    (n, b) => n + Math.max(0, b.balance ?? 0),
                                    0,
                                  ),
                              )}
                            </td>
                            <td>
                              <button
                                className="button"
                                onClick={() => open("customer", c)}
                              >
                                Edit / notes
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {view === "Vendors" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Outsourcing partners</h3>
                {owner && (
                  <button className="primary" onClick={() => open("vendor")}>
                    <Plus size={16} />
                    Add vendor
                  </button>
                )}
              </div>
              {tools()}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Contact / notes</th>
                      <th>Agreed costs</th>
                      <th>Paid to vendor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors
                      .filter((v) => matches(v.name))
                      .map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.name}</strong>
                            <small>
                              {v.outsourced.length} outsourced lines
                            </small>
                          </td>
                          <td>
                            {v.phone || "Contact not added"}
                            <small>{v.notes}</small>
                          </td>
                          <td>
                            {money(
                              v.outsourced.reduce((n, o) => n + o.cost, 0),
                            )}
                          </td>
                          <td>
                            {money(
                              v.outsourced
                                .flatMap((o) => o.payments)
                                .reduce((n, p) => n + p.amount, 0),
                            )}
                          </td>
                          <td>
                            {owner && (
                              <button
                                className="button"
                                onClick={() => open("vendor", v)}
                              >
                                Edit vendor
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-heading">
                <p>
                  Record vendor payments from the corresponding booking’s
                  outsourced items.
                </p>
              </div>
            </section>
          )}
          {view === "Calendar" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Rental calendar</h3>
                  <p>Pickups and expected returns · {month}</p>
                </div>
                <span className="legend">
                  <i />
                  Active reservations
                </span>
              </div>
              <div className="calendar-grid">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={`d${i}`} className="calendar-day-label">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                  </div>
                ))}
                {Array.from(
                  { length: new Date(`${month}-01`).getDay() },
                  (_, i) => (
                    <div key={`blank${i}`} className="calendar-cell blank" />
                  ),
                )}
                {Array.from(
                  {
                    length: new Date(
                      Number(month.slice(0, 4)),
                      Number(month.slice(5)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => {
                    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
                    const records = data.bookings.filter(
                      (b) =>
                        !b.historical &&
                        b.status !== "CANCELLED" &&
                        b.status !== "DRAFT" &&
                        [b.pickupAt, b.returnAt].some(
                          (d) =>
                            d &&
                            new Date(+new Date(d) + 19800000)
                              .toISOString()
                              .slice(0, 10) === day,
                        ),
                    );
                    return (
                      <div key={day} className="calendar-cell">
                        <strong>{i + 1}</strong>
                        {records.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => open("detail", b)}
                            className="calendar-event"
                          >
                            <small>
                              {new Date(+new Date(b.pickupAt!) + 19800000)
                                .toISOString()
                                .slice(0, 10) === day
                                ? "↑ Pickup"
                                : "↓ Return"}
                            </small>
                            {b.customer?.name}
                            <small>{bookingNumber(b.id)}</small>
                          </button>
                        ))}
                      </div>
                    );
                  },
                )}
              </div>
              <div className="panel-heading">
                <p>
                  Availability is checked across the full rental interval when
                  confirming or extending. Historical imports require review
                  before reservation.
                </p>
              </div>
              <div className="reservation-list">
                {data.bookings
                  .filter(
                    (b) =>
                      !b.historical &&
                      ["BOOKED", "PICKED_UP"].includes(b.status),
                  )
                  .map((b) => (
                    <button
                      className="schedule-row"
                      key={b.id}
                      onClick={() => open("detail", b)}
                    >
                      <Camera size={20} />
                      <span>
                        <strong>
                          {bookingNumber(b.id)} · {b.customer?.name}
                        </strong>
                        <small>
                          {date(b.pickupAt, true)} → {date(b.returnAt, true)}
                        </small>
                        <small>
                          {b.items
                            .map(
                              (i) =>
                                `${i.equipment.name} × ${i.quantity - i.returned}`,
                            )
                            .join(", ")}
                        </small>
                      </span>
                      <Badge value={b.status} />
                    </button>
                  ))}
              </div>
            </section>
          )}
          {view === "Reports" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">BOOKING-DATE VIEW</span>
                    <h3>Monthly performance</h3>
                  </div>
                  {exports("reports")}
                </div>
                <div className="report-grid">
                  {Object.entries({
                    Bookings: m.bookings,
                    "Cancelled bookings": m.cancelled,
                    "Booked revenue": money(m.revenue),
                    "Collected against bookings": money(m.collected),
                    "Outstanding balance": money(m.outstanding),
                    "Collection rate": `${(m.collectionRate * 100).toFixed(1)}%`,
                    "Unpaid bookings": m.unpaid,
                    "Missing amounts": m.missingAmount,
                    "Records needing attention (all months)": m.attention,
                    "Agreed outsourcing costs": money(m.outsourceCost),
                    "Revenue after outsourcing": money(m.afterOutsourcing),
                    "Average priced booking": money(m.average),
                    "Inventory investment": money(m.investment),
                    "Priced daily capacity": money(m.maxDaily),
                    "Priced monthly capacity": money(m.maxMonthly),
                    "Revenue-capacity ratio":
                      m.capacityRatio === null
                        ? "Unavailable"
                        : `${(m.capacityRatio * 100).toFixed(1)}%`,
                    "Illustrative gross payback":
                      m.payback === null
                        ? "Unavailable"
                        : `${m.payback.toFixed(1)} months`,
                  }).map(([key, value]) => (
                    <div key={key}>
                      <small>{key}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <p className="footnote padded">
                  {m.unpriced} unpriced models excluded from rental capacity.
                  Revenue after outsourcing excludes other business expenses.
                  Capacity assumes all non-retired priced units rent every day;
                  this is an illustrative ratio.
                </p>
              </section>
              <div className="dashboard-middle">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Payment modes</h3>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Mode</th>
                          <th>Ledger entries</th>
                          <th>Net amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.modes.map((p) => (
                          <tr key={p.mode}>
                            <td>{p.mode}</td>
                            <td>{p.count}</td>
                            <td>{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">PAYMENT-DATE VIEW</span>
                      <h3>Cash flow</h3>
                    </div>
                  </div>
                  <div className="report-grid">
                    <div>
                      <small>Rental inflows</small>
                      <strong>{money(m.cashIn)}</strong>
                    </div>
                    <div>
                      <small>Rental refunds</small>
                      <strong>{money(m.cashRefunds)}</strong>
                    </div>
                    <div>
                      <small>Actual vendor payments</small>
                      <strong>{money(m.vendorPaid)}</strong>
                    </div>
                    <div>
                      <small>Deposit movement</small>
                      <strong>{money(m.depositMovement)}</strong>
                    </div>
                  </div>
                  <p className="footnote padded">
                    {m.unknownPaymentDates} historical ledger entries have
                    unknown dates and are excluded from cash-flow periods.
                  </p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Actual equipment utilization</h3>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>Occupied unit-days</th>
                        <th>Nominal unit-days</th>
                        <th>Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.utilization
                        .filter((e) => e.occupiedUnitDays > 0)
                        .map((e) => (
                          <tr key={e.name}>
                            <td>{e.name}</td>
                            <td>{e.occupiedUnitDays.toFixed(1)}</td>
                            <td>{e.capacityUnitDays}</td>
                            <td>
                              {e.capacityUnitDays
                                ? `${((e.occupiedUnitDays / e.capacityUnitDays) * 100).toFixed(1)}%`
                                : "Unavailable"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="footnote padded">
                  Recorded pickups to actual returns, including partial returns.
                  Historical free-text imports are excluded. Nominal capacity
                  does not reconstruct past maintenance or asset acquisition
                  dates.
                </p>
              </section>
            </>
          )}
          {view === "Settings" &&
            (owner ? (
              <>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Business preferences</h3>
                      <p>Rates, rental rules, branding and document details.</p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => open("settings")}
                    >
                      Edit settings
                    </button>
                  </div>
                  <div className="report-grid">
                    <div>
                      <small>Business</small>
                      <strong>{data.settings.businessName}</strong>
                    </div>
                    <div>
                      <small>Rental-day calculation</small>
                      <strong>
                        {data.settings.rentalPolicy === "24H"
                          ? "Started 24-hour periods"
                          : "Inclusive calendar days"}
                      </strong>
                    </div>
                    <div>
                      <small>Turnaround buffer</small>
                      <strong>{data.settings.turnaroundMinutes} minutes</strong>
                    </div>
                    <div>
                      <small>Payment mode required from</small>
                      <strong>{data.settings.paymentModeRequiredFrom}</strong>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Team access</h3>
                    <button className="button" onClick={() => open("user")}>
                      <Plus size={15} />
                      Add team member
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Access</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{u.role}</td>
                            <td>{u.active ? "Active" : "Disabled"}</td>
                            <td>
                              <button
                                className="button"
                                onClick={() => open("user", u)}
                              >
                                Edit access
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Import history</h3>
                    <button className="button" onClick={() => open("import")}>
                      <FileUp size={15} />
                      Import workbook
                    </button>
                  </div>
                  {data.imports.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>File</th>
                            <th>Imported</th>
                            <th>Outcome</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.imports.map((i) => (
                            <tr key={i.id}>
                              <td>{i.name}</td>
                              <td>{date(i.createdAt, true)}</td>
                              <td>
                                {i.rolledBackAt
                                  ? "Rolled back"
                                  : JSON.stringify(i.summary)}
                              </td>
                              <td>
                                {!i.rolledBackAt && (
                                  <button
                                    className="button"
                                    onClick={() => open("rollback", i)}
                                  >
                                    Review rollback
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="padded muted">No imports yet.</p>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Recent audit trail</h3>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Action</th>
                          <th>Record</th>
                          <th>Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.audits.map((a) => (
                          <tr key={a.id}>
                            <td>{date(a.createdAt, true)}</td>
                            <td>{a.action}</td>
                            <td>
                              {a.entity} {a.entityId}
                            </td>
                            <td>
                              {data.users.find((u) => u.id === a.actor)?.name ??
                                a.actor}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <Empty title="Business settings are managed by the workspace owner." />
            ))}
          <footer className="app-footer">
            <span>CAMNOVA RENTALS</span>
            <span>Made for creators. Built for clarity.</span>
            <span>Asia/Kolkata · INR</span>
          </footer>
        </main>
      </div>
      {dialog && (
        <Modal
          title={
            dialog.kind === "detail" && b
              ? `${bookingNumber(b.id)} · ${b.customer?.name ?? "Draft"}`
              : ((
                  {
                    booking: b ? "Edit booking" : "New booking",
                    payment: "Record a payment",
                    import: "Import your workbook",
                    customer: "Customer details",
                    inventory: "Equipment details",
                    assets: "Equipment & assets",
                    vendor: "Vendor details",
                    settings: "Workspace preferences",
                    user: "Team access",
                    followup: "Collection follow-up",
                    pickup: "Pickup checklist",
                    return: "Return checklist",
                    extend: "Extend rental",
                    confirm: "Confirm booking",
                    delete: "Delete booking",
                    cancel: "Cancel booking",
                    rollback: "Rollback import",
                    "vendor-payment": "Vendor payment",
                  } as Record<string, string>
                )[dialog.kind] ?? dialog.kind)
          }
          onClose={close}
        >
          {error && (
            <p role="alert" className="error banner">
              {error}
            </p>
          )}
          {dialog.kind === "confirm" && b && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                submit(`bookings/${b.id}/action`, {
                  action: "CONFIRM",
                  version: b.version,
                  ...(b.total === null
                    ? { total: Math.round(Number(fields.get("total")) * 100) }
                    : {}),
                });
              }}
            >
              <h3>
                {b.customer?.name ?? "Customer details needed"} ·{" "}
                {bookingNumber(b.id)}
              </h3>
              <p>
                {date(b.pickupAt, true)} → {date(b.returnAt, true)}
              </p>
              {b.items.map((i) => (
                <p key={i.id}>
                  {i.equipment.name} × {i.quantity}
                </p>
              ))}
              {b.total === null ? (
                <label>
                  Agreed rental total (₹)
                  <input
                    name="total"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
              ) : (
                <h3>Rental total: {money(b.total)}</h3>
              )}
              <p>
                You can confirm this booking yourself. No owner approval or
                payment is required. Confirmation reserves the equipment.
              </p>
              <div className="detail-actions">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !b.customerId ||
                    !b.pickupAt ||
                    !b.returnAt ||
                    !b.items.length
                  }
                >
                  {busy && <LoaderCircle className="loading-spin" size={16} />}
                  {busy ? "Confirming…" : "Confirm booking"}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => open("booking", b)}
                >
                  Change details
                </button>
              </div>
            </form>
          )}
          {dialog.kind === "delete" && b && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                submit(`bookings/${b.id}/action`, {
                  action: "DELETE",
                  version: b.version,
                  notes: String(fields.get("notes") || "Mistaken booking"),
                  removePayments: fields.get("removePayments") === "on",
                });
              }}
            >
              <h3>
                {bookingNumber(b.id)} · {b.customer?.name}
              </h3>
              <p>
                This removes the booking from active records and releases
                reserved gear. The audit history is kept.
              </p>
              {b.payments.some(
                (p) =>
                  !p.reversesId &&
                  !b.payments.some((x) => x.reversesId === p.id),
              ) && (
                <label>
                  <input type="checkbox" name="removePayments" required /> Also
                  remove this booking’s payment entries as mistakes. This does
                  not send a refund.
                </label>
              )}
              <label>
                Reason (optional)
                <input
                  name="notes"
                  placeholder="Mistaken booking"
                  maxLength={5000}
                />
              </label>
              <div className="detail-actions">
                <button className="button danger" disabled={busy}>
                  {busy ? "Deleting…" : "Delete booking"}
                </button>
                <button type="button" className="button" onClick={close}>
                  Keep booking
                </button>
              </div>
            </form>
          )}
          {dialog.kind === "booking" && (
            <BookingForm
              data={data}
              booking={b}
              busy={busy}
              submit={(v) => submit(`bookings${b ? `/${b.id}` : ""}`, v)}
              onCustomer={() => open("customer")}
            />
          )}
          {dialog.kind === "detail" && b && (
            <>
              <div className="detail-status">
                <Badge value={b.status} />
                <Badge value={b.paymentStatus} />
                {b.historical && <Badge value="Historical" />}
                <span>{date(b.bookingDate, true)}</span>
              </div>
              <div className="stats-grid three compact">
                <Stat
                  label="Agreed total"
                  value={money(b.total)}
                  foot="Rental amount"
                />
                <Stat
                  label="Rental paid"
                  value={money(b.paid)}
                  foot={`${money(b.deposit)} deposit held`}
                />
                <Stat
                  label="Balance due"
                  value={money(b.balance)}
                  foot="Net of payments and refunds"
                />
              </div>
              {b.warnings.length > 0 && (
                <div className="warning-panel">
                  <h4>Review this record</h4>
                  {b.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}
              <div className="detail-grid">
                <div>
                  <small>Customer contact</small>
                  <strong>
                    {b.customer?.rawPhone ||
                      b.customer?.phones.join(", ") ||
                      "Not recorded"}
                  </strong>
                </div>
                <div>
                  <small>Pickup / expected return</small>
                  <strong>
                    {date(b.pickupAt, true)} → {date(b.returnAt, true)}
                  </strong>
                </div>
                <div>
                  <small>Referral</small>
                  <strong>{b.referral || "Not recorded"}</strong>
                </div>
                <div>
                  <small>Notes</small>
                  <strong>{b.notes || "No notes"}</strong>
                </div>
              </div>
              <h3 className="section-title">Equipment & pricing</h3>
              {b.equipmentText && <p>{b.equipmentText}</p>}
              {b.items.map((i) => (
                <div className="detail-row" key={i.id}>
                  <div>
                    <strong>
                      {i.equipment.name} × {i.quantity}
                    </strong>
                    <small>
                      {i.days} day(s) at {money(i.rate)} · {i.returned} returned
                    </small>
                  </div>
                  <strong>{money(i.rate * i.days * i.quantity)}</strong>
                </div>
              ))}
              <p className="footnote">
                Discount: {money(b.discount)} ·{" "}
                {b.negotiated
                  ? "Negotiated total override"
                  : "Calculated pricing"}
              </p>
              <h3 className="section-title">Payment ledger</h3>
              {b.payments.map((p) => (
                <div className="detail-row" key={p.id}>
                  <div>
                    <strong>
                      {money(p.amount)} · {p.mode} · {p.kind}
                    </strong>
                    <small>
                      {date(p.paidAt, true)} · {p.reference || p.notes}
                    </small>
                  </div>
                  <div className="row-actions">
                    <a
                      className="button"
                      href={`/api/documents/${b.id}?kind=receipt&payment=${p.id}`}
                    >
                      Receipt
                    </a>
                    {owner &&
                      !b.payments.some((x) => x.reversesId === p.id) &&
                      !p.reversesId && (
                        <button
                          className="button"
                          onClick={() =>
                            open("payment", { ...b, correctId: p.id })
                          }
                        >
                          Correct
                        </button>
                      )}
                  </div>
                </div>
              ))}
              {!b.payments.length && (
                <p className="muted">No payments recorded yet.</p>
              )}
              {owner &&
                b.payments
                  .filter(
                    (p) =>
                      !p.reversesId &&
                      !b.payments.some((x) => x.reversesId === p.id),
                  )
                  .map((p) => (
                    <button
                      key={p.id}
                      className="button danger"
                      onClick={() => {
                        const notes = window.prompt(
                          `Delete payment ${money(p.amount)}? Enter a correction reason. This preserves the audit history.`,
                        );
                        if (notes?.trim())
                          submit(`/api/bookings/${b.id}/action`, {
                            action: "DELETE_PAYMENT",
                            paymentId: p.id,
                            version: b.version,
                            notes,
                          });
                      }}
                    >
                      Delete payment {money(p.amount)}
                    </button>
                  ))}
              <h3 className="section-title">Outsourced equipment</h3>
              {b.outsourced.map((o) => (
                <div className="detail-row" key={o.id}>
                  <div>
                    <strong>
                      {o.description} ·{" "}
                      {o.vendor?.name ?? "Vendor not recorded"}
                    </strong>
                    <small>
                      Agreed {money(o.cost)} · Paid{" "}
                      {money(o.payments.reduce((n, p) => n + p.amount, 0))}
                    </small>
                  </div>
                  {owner && (
                    <button
                      className="button"
                      onClick={() => open("vendor-payment", o)}
                    >
                      Record vendor payment
                    </button>
                  )}
                </div>
              ))}
              <h3 className="section-title">Handover history</h3>
              <pre className="checklist-history">
                {JSON.stringify(b.checklist, null, 2)}
              </pre>
              <div className="detail-actions">
                {b.status === "DRAFT" && (
                  <button
                    className="primary"
                    onClick={() => open("confirm", b)}
                  >
                    Review & confirm booking
                  </button>
                )}
                {owner && (
                  <button
                    className="button danger"
                    onClick={() => open("delete", b)}
                  >
                    Delete booking
                  </button>
                )}
                {(owner || b.status === "DRAFT") && (
                  <button className="button" onClick={() => open("booking", b)}>
                    Edit booking
                  </button>
                )}
                <button className="primary" onClick={() => open("payment", b)}>
                  Record payment / deposit
                </button>
                {b.status === "BOOKED" && !b.historical && (
                  <button className="button" onClick={() => open("pickup", b)}>
                    Check out gear
                  </button>
                )}
                {b.status === "PICKED_UP" && !b.historical && (
                  <button className="button" onClick={() => open("return", b)}>
                    Check in gear
                  </button>
                )}
                {["BOOKED", "PICKED_UP"].includes(b.status) &&
                  !b.historical && (
                    <button
                      className="button"
                      onClick={() => open("extend", b)}
                    >
                      Extend rental
                    </button>
                  )}
                {owner &&
                  !["PICKED_UP", "RETURNED", "CANCELLED"].includes(
                    b.status,
                  ) && (
                    <button
                      className="button danger"
                      onClick={() => open("cancel", b)}
                    >
                      Cancel booking
                    </button>
                  )}
                <button className="button" onClick={() => open("followup", b)}>
                  Follow-up
                </button>
              </div>
              <div className="detail-actions">
                {["summary", "quotation", "invoice"].map((kind) => (
                  <a
                    className="button"
                    key={kind}
                    href={`/api/documents/${b.id}?kind=${kind}`}
                  >
                    <FileText size={14} />
                    {kind[0].toUpperCase() + kind.slice(1)}
                  </a>
                ))}
                {(
                  ["confirmation", "pickup", "return", "collection"] as const
                ).map((type) => (
                  <button
                    className="button"
                    key={type}
                    onClick={() => whatsApp(b, type)}
                  >
                    <MessageCircle size={14} />
                    {type} message
                  </button>
                ))}
              </div>
            </>
          )}
          {dialog.kind === "payment" && b && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                submit(`bookings/${b.id}/payment`, {
                  amount: paise(f.get("amount")),
                  kind: f.get("kind"),
                  mode: f.get("mode"),
                  paidAt: iso(f.get("paidAt")),
                  reference: f.get("reference"),
                  notes: f.get("notes"),
                  refund: f.get("refund") === "on",
                  reviewedCredit: f.get("reviewedCredit") === "on",
                  correctId: (b as Booking & { correctId?: string }).correctId,
                });
              }}
            >
              <div className="warning-panel">
                Balance due: {money(b.balance)} · Deposit held:{" "}
                {money(b.deposit)}. Deposits are kept separate from rental
                revenue.
              </div>
              <div className="form-grid">
                <Field label="Amount (₹)">
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Payment type">
                  <select name="kind">
                    <option value="RENTAL">Rental payment</option>
                    <option value="DEPOSIT">Refundable security deposit</option>
                  </select>
                </Field>
                <Field label="Payment mode">
                  <select name="mode">
                    <option>UPI</option>
                    <option>Bank</option>
                    <option>Cash</option>
                  </select>
                </Field>
                <Field label="Payment date (IST)">
                  <input
                    name="paidAt"
                    type="datetime-local"
                    defaultValue={localInput(new Date().toISOString())}
                    required
                  />
                </Field>
                <Field label="Reference">
                  <input name="reference" />
                </Field>
                <Field label="Notes / correction reason">
                  <input name="notes" />
                </Field>
              </div>
              {owner && (
                <div className="checkbox-group">
                  <label>
                    <input name="refund" type="checkbox" />
                    Record as a refund
                  </label>
                  <label>
                    <input name="reviewedCredit" type="checkbox" />I reviewed
                    this overpayment / credit (reason required)
                  </label>
                </div>
              )}
              <FormFooter busy={busy} />
            </form>
          )}
          {["customer", "vendor", "inventory", "user"].includes(
            dialog.kind,
          ) && (
            <EntityForm
              kind={dialog.kind}
              record={dialog.record}
              busy={busy}
              submit={(v) =>
                submit(
                  (
                    {
                      customer: "customers",
                      vendor: "vendors",
                      inventory: "inventory",
                      user: "users",
                    } as Record<string, string>
                  )[dialog.kind],
                  v,
                )
              }
            />
          )}
          {dialog.kind === "assets" && (
            <>
              {(dialog.record as Equipment).photo && (
                <img
                  className="product-photo-preview"
                  src={productPhotoUrl(
                    (dialog.record as Equipment).id,
                    (dialog.record as Equipment).photo!.updatedAt,
                  )}
                  alt={(dialog.record as Equipment).name}
                />
              )}
              <div className="detail-actions">
                {owner && (
                  <button
                    className="primary"
                    onClick={() => open("inventory", dialog.record)}
                  >
                    Edit model / add units
                  </button>
                )}
              </div>
              {(dialog.record as Equipment).assets.map((a) => (
                <form
                  className="asset-form"
                  key={a.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    submit(
                      "assets",
                      {
                        id: a.id,
                        status: f.get("status"),
                        serial: String(f.get("serial") || "") || null,
                        condition: f.get("condition"),
                        accessories: f.get("accessories"),
                        notes: f.get("notes"),
                        purchaseDate: iso(f.get("purchaseDate")),
                        purchaseCost: paise(f.get("purchaseCost")),
                      },
                      true,
                    );
                  }}
                >
                  <h4>Asset {a.id.slice(-8).toUpperCase()}</h4>
                  <div className="form-grid">
                    <Field label="Status">
                      <select
                        disabled={!owner}
                        name="status"
                        defaultValue={a.status}
                      >
                        <option value="AVAILABLE">In rental fleet</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="RETIRED">Retired</option>
                      </select>
                    </Field>
                    <Field label="Serial (optional)">
                      <input
                        disabled={!owner}
                        name="serial"
                        defaultValue={a.serial ?? ""}
                      />
                    </Field>
                    <Field label="Condition">
                      <input
                        disabled={!owner}
                        name="condition"
                        defaultValue={a.condition}
                      />
                    </Field>
                    <Field label="Accessories">
                      <input
                        disabled={!owner}
                        name="accessories"
                        defaultValue={a.accessories}
                      />
                    </Field>
                    <Field label="Purchase date (optional)">
                      <input
                        disabled={!owner}
                        type="datetime-local"
                        name="purchaseDate"
                        defaultValue={localInput(a.purchaseDate)}
                      />
                    </Field>
                    <Field label="Purchase cost (₹)">
                      <input
                        disabled={!owner}
                        name="purchaseCost"
                        type="number"
                        min="0"
                        step=".01"
                        defaultValue={rupees(a.purchaseCost)}
                      />
                    </Field>
                    <Field label="Notes">
                      <input
                        disabled={!owner}
                        name="notes"
                        defaultValue={a.notes}
                      />
                    </Field>
                  </div>
                  {owner && (
                    <button className="button" disabled={busy}>
                      Save asset
                    </button>
                  )}
                </form>
              ))}
            </>
          )}
          {["pickup", "return", "followup", "extend", "cancel"].includes(
            dialog.kind,
          ) &&
            b && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  submit(`bookings/${b.id}/action`, {
                    action: (
                      {
                        pickup: "PICKUP",
                        return: "RETURN",
                        followup: "FOLLOWUP",
                        extend: "EXTEND",
                        cancel: "CANCEL",
                      } as Record<string, string>
                    )[dialog.kind],
                    notes: f.get("notes") ?? "",
                    accessories: f.get("accessories") ?? "",
                    condition: f.get("condition") ?? "",
                    missing: f.get("missing") ?? "",
                    returnAt: iso(f.get("returnAt")),
                    followupAt: iso(f.get("followupAt")),
                    items: b.items.map((i) => ({
                      id: i.id,
                      quantity: Number(f.get(i.id) ?? 0),
                    })),
                  });
                }}
              >
                {dialog.kind === "cancel" && (
                  <p className="warning-panel">
                    This will release reservations and exclude the booking from
                    booked revenue. Payments remain in the ledger; refunds must
                    be recorded separately.
                  </p>
                )}
                {["pickup", "return"].includes(dialog.kind) && (
                  <>
                    <Field label="Equipment condition">
                      <textarea
                        name="condition"
                        required
                        placeholder="Inspected condition and any damage…"
                      />
                    </Field>
                    <Field label="Accessories checklist">
                      <textarea
                        name="accessories"
                        placeholder="Batteries, cards, caps, chargers, cases…"
                      />
                    </Field>
                    <Field label="Missing items / damage">
                      <textarea name="missing" />
                      {/* Separate from condition so missing items are easy to review. */}
                    </Field>
                    {dialog.kind === "return" &&
                      b.items.map((i) => (
                        <Field
                          key={i.id}
                          label={`${i.equipment.name} — ${i.quantity - i.returned} outstanding`}
                        >
                          <input
                            name={i.id}
                            type="number"
                            min="0"
                            max={i.quantity - i.returned}
                            defaultValue={i.quantity - i.returned}
                          />
                        </Field>
                      ))}
                  </>
                )}
                {dialog.kind === "followup" && (
                  <Field label="Next follow-up (IST)">
                    <input
                      name="followupAt"
                      type="datetime-local"
                      defaultValue={localInput(b.followupAt)}
                    />
                  </Field>
                )}
                {dialog.kind === "extend" && (
                  <>
                    <p className="warning-panel">
                      Availability will be checked again. The agreed booking
                      total stays unchanged; discuss any extra charge
                      explicitly.
                    </p>
                    <Field label="New expected return (IST)">
                      <input
                        name="returnAt"
                        type="datetime-local"
                        required
                        defaultValue={localInput(b.returnAt)}
                      />
                    </Field>
                  </>
                )}
                <Field label="Notes">
                  <textarea
                    name="notes"
                    defaultValue={
                      dialog.kind === "followup" ? b.followupNote : ""
                    }
                  />
                </Field>
                <FormFooter busy={busy} />
              </form>
            )}
          {dialog.kind === "vendor-payment" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                submit("vendor-payments", {
                  outsourceId: (dialog.record as { id: string }).id,
                  amount: paise(f.get("amount")),
                  paidAt: iso(f.get("paidAt")),
                  mode: f.get("mode"),
                  notes: f.get("notes"),
                });
              }}
            >
              <Field label="Amount (₹)">
                <input
                  name="amount"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                />
              </Field>
              <Field label="Payment date (IST)">
                <input
                  name="paidAt"
                  type="datetime-local"
                  defaultValue={localInput(new Date().toISOString())}
                  required
                />
              </Field>
              <Field label="Mode">
                <select name="mode">
                  <option>UPI</option>
                  <option>Bank</option>
                  <option>Cash</option>
                </select>
              </Field>
              <Field label="Notes">
                <input name="notes" />
              </Field>
              <FormFooter busy={busy} />
            </form>
          )}
          {dialog.kind === "settings" && (
            <SettingsForm
              settings={data.settings}
              busy={busy}
              submit={(v) => submit("settings", v)}
            />
          )}
          {dialog.kind === "rollback" && (
            <>
              <p className="warning-panel">
                Rollback deletes records created by this import only if they
                have no later changes or dependencies. The import fingerprint
                remains to prevent accidental re-import.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  submit("import/rollback", {
                    id: (dialog.record as { id: string }).id,
                  })
                }
              >
                Confirm rollback
              </button>
            </>
          )}
          {dialog.kind === "import" && (
            <>
              <div className="import-drop">
                <FileUp size={32} />
                <h3>Bring your tracker into focus</h3>
                <p>Bookings and Rate Card · XLSX · up to 10 MB</p>
                <input
                  aria-label="Choose workbook"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              </div>
              <details>
                <summary>Booking column mapping (Excel column numbers)</summary>
                <div className="form-grid">
                  {Object.entries(mapping).map(([key, value]) => (
                    <Field label={key} key={key}>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={value}
                        onChange={(e) =>
                          setMapping({
                            ...mapping,
                            [key]: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </details>
              <button
                className="button"
                disabled={!file || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const f = new FormData();
                    f.set("file", file!);
                    f.set("mapping", JSON.stringify(mapping));
                    const r = await fetch("/api/import/preview", {
                      method: "POST",
                      body: f,
                    });
                    const p = await r.json();
                    if (!r.ok) throw new Error(p.error);
                    setPreview(p);
                    setSelected(
                      p.bookings
                        .filter(
                          (b: Preview["bookings"][number]) =>
                            !b.errors.length &&
                            !b.warnings.some(
                              (w) =>
                                w.includes("duplicate") ||
                                w.includes("multi-day"),
                            ),
                        )
                        .map((b: Preview["bookings"][number]) => b.row),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Search size={15} />
                Preview import
              </button>
              {preview && (
                <>
                  <h3 className="section-title">
                    {preview.bookings.length} bookings ·{" "}
                    {preview.inventory.length} inventory entries
                  </h3>
                  {preview.alreadyImported && (
                    <p className="error">
                      This file has already been imported.
                    </p>
                  )}
                  <p className="footnote">
                    Review each warning. Similar or duplicate bookings start
                    deselected. Existing inventory is skipped. Import does not
                    create historical reservations.
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Include</th>
                          <th>Source row</th>
                          <th>Customer / equipment</th>
                          <th>Total</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.bookings.map((b) => (
                          <tr key={b.row}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Import source row ${b.row}`}
                                disabled={b.errors.length > 0}
                                checked={selected.includes(b.row)}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? [...selected, b.row]
                                      : selected.filter((r) => r !== b.row),
                                  )
                                }
                              />
                            </td>
                            <td>{b.row}</td>
                            <td>
                              {b.customer}
                              <small>{b.equipment}</small>
                            </td>
                            <td>{money(b.total)}</td>
                            <td>
                              {b.errors.map((e, i) => (
                                <small className="error" key={i}>
                                  {e}
                                </small>
                              ))}
                              {b.warnings.map((w, i) => (
                                <small key={i}>{w}</small>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details>
                    <summary>Inventory validation</summary>
                    {preview.inventory.map((e) => (
                      <p key={e.name}>
                        <strong>{e.name}</strong> ·{" "}
                        {[...e.errors, ...e.warnings].join("; ") || "Ready"}
                      </p>
                    ))}
                  </details>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      preview.alreadyImported ||
                      preview.inventory.some((e) => e.errors.length > 0)
                    }
                    onClick={() => {
                      const f = new FormData();
                      f.set("file", file!);
                      f.set("mapping", JSON.stringify(mapping));
                      f.set("rows", JSON.stringify(selected));
                      submit("import/commit", f);
                    }}
                  >
                    Import {selected.length} selected bookings
                  </button>
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  foot,
  featured = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  foot: string;
  featured?: boolean;
}) {
  return (
    <article className={`stat ${featured ? "featured" : ""}`}>
      <div>
        <span>{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <h2>{value}</h2>
      <small>{foot}</small>
    </article>
  );
}
function EquipmentIcon({ category }: { category: string }) {
  const Icon =
    category === "CAMERA"
      ? Camera
      : category === "LENS"
        ? Aperture
        : category === "GIMBAL"
          ? SlidersHorizontal
          : category === "LIGHT"
            ? CircleHelp
            : Package;
  return <Icon size={60} strokeWidth={1} />;
}
function FormFooter({ busy }: { busy: boolean }) {
  return (
    <div className="form-footer">
      <span>
        <ShieldCheck size={14} />
        Changes are recorded in your audit trail
      </span>
      <button className="primary" disabled={busy}>
        {busy && <LoaderCircle className="loading-spin" size={16} />}
        {busy ? "Saving…" : "Save changes"}
        <Check size={15} />
      </button>
    </div>
  );
}
function EntityForm({
  kind,
  record,
  busy,
  submit,
}: {
  kind: string;
  record?: unknown;
  busy: boolean;
  submit: (v: unknown) => unknown;
}) {
  const r = (record ?? {}) as Record<string, unknown>;
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const existingPhoto = r.photo as { updatedAt: string } | null | undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || preparingPhoto) return;
        const f = new FormData(e.currentTarget);
        const body: Record<string, unknown> = { id: r.id, name: f.get("name") };
        if (kind === "customer")
          Object.assign(body, {
            phones: String(f.get("phones") ?? "")
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean),
            rawPhone: f.get("rawPhone"),
            email: f.get("email"),
            notes: f.get("notes"),
            referral: f.get("referral"),
          });
        if (kind === "vendor")
          Object.assign(body, { phone: f.get("phone"), notes: f.get("notes") });
        if (kind === "inventory")
          Object.assign(body, {
            category: f.get("category"),
            quantity: Number(f.get("quantity")),
            rate: paise(f.get("rate")),
            purchaseCost: paise(f.get("purchaseCost")) ?? 0,
            notes: f.get("notes"),
            ...(photo !== undefined ? { photo } : {}),
          });
        if (kind === "user")
          Object.assign(body, {
            email: f.get("email"),
            role: f.get("role"),
            active: f.get("active") === "on",
            ...(f.get("password") ? { password: f.get("password") } : {}),
          });
        submit(body);
      }}
    >
      <div className="form-grid">
        <Field label="Name">
          <input name="name" required defaultValue={String(r.name ?? "")} />
        </Field>
        {kind === "customer" && (
          <>
            <Field label="Phone numbers (comma separated)">
              <input
                name="phones"
                defaultValue={((r.phones as string[]) ?? []).join(", ")}
              />
            </Field>
            <Field label="Original phone text">
              <input name="rawPhone" defaultValue={String(r.rawPhone ?? "")} />
            </Field>
            <Field label="Email (optional)">
              <input
                name="email"
                type="email"
                defaultValue={String(r.email ?? "")}
              />
            </Field>
            <Field label="Referral source">
              <input name="referral" defaultValue={String(r.referral ?? "")} />
            </Field>
          </>
        )}
        {kind === "vendor" && (
          <Field label="Contact phone">
            <input name="phone" defaultValue={String(r.phone ?? "")} />
          </Field>
        )}
        {kind === "inventory" && (
          <>
            <Field label="Category">
              <select
                name="category"
                defaultValue={String(r.category ?? "CAMERA")}
              >
                {[
                  "CAMERA",
                  "LENS",
                  "LIGHT",
                  "GIMBAL",
                  "MIC",
                  "BATTERY",
                  "CARD",
                  "OTHER",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Total units (retire individually to reduce)">
              <input
                name="quantity"
                type="number"
                min={(r.assets as unknown[])?.length ?? 0}
                max="500"
                required
                defaultValue={(r.assets as unknown[])?.length ?? 1}
              />
            </Field>
            <Field label="Daily rate (₹, blank = not set)">
              <input
                name="rate"
                type="number"
                min="0"
                step=".01"
                defaultValue={rupees(r.rate as number | null)}
              />
            </Field>
            <Field label="Purchase cost per unit (₹)">
              <input
                name="purchaseCost"
                type="number"
                min="0"
                step=".01"
                required
                defaultValue={rupees((r.purchaseCost as number) ?? 0)}
              />
            </Field>
            <ProductPhotoEditor
              existingUrl={
                existingPhoto
                  ? productPhotoUrl(String(r.id), existingPhoto.updatedAt)
                  : undefined
              }
              disabled={busy}
              onChange={setPhoto}
              onPreparing={setPreparingPhoto}
            />
          </>
        )}
        {kind === "user" && (
          <>
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                defaultValue={String(r.email ?? "")}
              />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue={String(r.role ?? "STAFF")}>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Owner / admin</option>
              </select>
            </Field>
            <Field label="Password (12+ characters; blank keeps existing)">
              <input
                name="password"
                type="password"
                minLength={12}
                required={!r.id}
                autoComplete="new-password"
              />
            </Field>
            <label className="checkbox-group">
              <input
                name="active"
                type="checkbox"
                defaultChecked={r.active !== false}
              />
              Active account
            </label>
          </>
        )}
        {kind !== "user" && (
          <Field label="Notes">
            <textarea name="notes" defaultValue={String(r.notes ?? "")} />
          </Field>
        )}
      </div>
      <FormFooter busy={busy || preparingPhoto} />
    </form>
  );
}
function BookingForm({
  data,
  booking,
  busy,
  submit,
  onCustomer,
}: {
  data: Data;
  booking?: Booking;
  busy: boolean;
  submit: (v: unknown) => unknown;
  onCustomer: () => void;
}) {
  const [lines, setLines] = useState(
    (booking?.items ?? []).map((i) => ({
      equipmentId: i.equipmentId,
      quantity: i.quantity,
      rate: i.rate,
    })),
  );
  const [outsourced, setOutsourced] = useState(
    (booking?.outsourced ?? []).map((o) => ({
      vendorId: o.vendorId ?? "",
      description: o.description,
      cost: o.cost,
    })),
  );
  const [negotiated, setNegotiated] = useState(booking?.negotiated ?? false),
    [discount, setDiscount] = useState(booking?.discount ?? 0),
    [pickup, setPickup] = useState(localInput(booking?.pickupAt)),
    [ret, setRet] = useState(localInput(booking?.returnAt));
  let days = 1;
  if (pickup && ret) {
    const start = +new Date(`${pickup}:00+05:30`),
      end = +new Date(`${ret}:00+05:30`);
    days =
      data.settings.rentalPolicy === "CALENDAR"
        ? Math.max(
            1,
            Math.round(
              (+new Date(ret.slice(0, 10)) - +new Date(pickup.slice(0, 10))) /
                86400000,
            ) + 1,
          )
        : Math.max(1, Math.ceil((end - start) / 86400000));
  }
  const total =
    lines.reduce((n, i) => n + i.quantity * i.rate * days, 0) +
    outsourced.reduce((n, o) => n + o.cost, 0) -
    discount;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          customerId: f.get("customerId") || null,
          bookingDate: iso(f.get("bookingDate")),
          pickupAt: iso(f.get("pickupAt")),
          returnAt: iso(f.get("returnAt")),
          dueAt: iso(f.get("dueAt")),
          status: f.get("status"),
          notes: f.get("notes"),
          referral: f.get("referral"),
          equipmentText: f.get("equipmentText"),
          negotiated,
          total: negotiated ? paise(f.get("total")) : null,
          discount,
          items: lines,
          outsourced,
          version: booking?.version,
        });
      }}
    >
      <div className="form-grid">
        <Field label="Customer">
          <select name="customerId" defaultValue={booking?.customerId ?? ""}>
            <option value="">Select customer (drafts may be incomplete)</option>
            {data.customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="inline-field">
          <button className="text-link" type="button" onClick={onCustomer}>
            <Plus size={14} />
            Add customer first
          </button>
        </div>
        <Field label="Booking date (IST)">
          <input
            name="bookingDate"
            type="datetime-local"
            defaultValue={localInput(
              booking?.bookingDate ?? new Date().toISOString(),
            )}
          />
        </Field>
        <Field label="Order status">
          <select name="status" defaultValue={booking?.status ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="BOOKED">Booked / confirmed</option>
            <option value="PICKED_UP">Picked up</option>
            {booking?.historical && (
              <option value="RETURNED">Returned (historical)</option>
            )}
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>
        <Field label="Pickup (IST)">
          <input
            name="pickupAt"
            type="datetime-local"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </Field>
        <Field label="Expected return (IST)">
          <input
            name="returnAt"
            type="datetime-local"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
          />
        </Field>
        <Field label="Payment due date (IST)">
          <input
            name="dueAt"
            type="datetime-local"
            defaultValue={localInput(booking?.dueAt)}
          />
        </Field>
        <Field label="Referred by">
          <input name="referral" defaultValue={booking?.referral ?? ""} />
        </Field>
      </div>
      <h3 className="section-title">
        Equipment <span className="count">{days} rental day(s)</span>
      </h3>
      {lines.map((i, index) => (
        <div className="line-item" key={index}>
          <select
            aria-label={`Equipment ${index + 1}`}
            value={i.equipmentId}
            onChange={(e) => {
              const eq = data.inventory.find((x) => x.id === e.target.value)!;
              setLines(
                lines.map((l, j) =>
                  j === index
                    ? { ...l, equipmentId: eq.id, rate: eq.rate ?? 0 }
                    : l,
                ),
              );
            }}
          >
            {data.inventory
              .filter((e) => e.rate !== null || e.id === i.equipmentId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
          <input
            aria-label={`Quantity ${index + 1}`}
            type="number"
            min="1"
            max="500"
            value={i.quantity}
            onChange={(e) =>
              setLines(
                lines.map((l, j) =>
                  j === index ? { ...l, quantity: Number(e.target.value) } : l,
                ),
              )
            }
          />
          <label>
            ₹ / day
            <input
              aria-label={`Rate ${index + 1}`}
              type="number"
              min="0"
              step=".01"
              value={rupees(i.rate)}
              onChange={(e) =>
                setLines(
                  lines.map((l, j) =>
                    j === index
                      ? { ...l, rate: Math.round(Number(e.target.value) * 100) }
                      : l,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove equipment ${index + 1}`}
            onClick={() => setLines(lines.filter((_, j) => j !== index))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        className="button"
        type="button"
        onClick={() => {
          const first = data.inventory.find(
            (e) =>
              e.rate !== null && !lines.some((l) => l.equipmentId === e.id),
          );
          if (first)
            setLines([
              ...lines,
              { equipmentId: first.id, quantity: 1, rate: first.rate! },
            ]);
        }}
      >
        <Plus size={15} />
        Add equipment
      </button>
      <h3 className="section-title">Outsourced equipment</h3>
      {outsourced.map((o, index) => (
        <div key={index} className="outsource-line">
          <select
            aria-label={`Vendor ${index + 1}`}
            value={o.vendorId}
            onChange={(e) =>
              setOutsourced(
                outsourced.map((x, j) =>
                  j === index ? { ...x, vendorId: e.target.value } : x,
                ),
              )
            }
          >
            <option value="">Vendor not recorded</option>
            {data.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input
            aria-label={`Outsourced item ${index + 1}`}
            placeholder="Item description"
            value={o.description}
            onChange={(e) =>
              setOutsourced(
                outsourced.map((x, j) =>
                  j === index ? { ...x, description: e.target.value } : x,
                ),
              )
            }
            required
          />
          <input
            aria-label={`Vendor cost ${index + 1}`}
            type="number"
            min="0"
            step=".01"
            value={rupees(o.cost)}
            onChange={(e) =>
              setOutsourced(
                outsourced.map((x, j) =>
                  j === index
                    ? { ...x, cost: Math.round(Number(e.target.value) * 100) }
                    : x,
                ),
              )
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Remove outsourced item"
            onClick={() =>
              setOutsourced(outsourced.filter((_, j) => j !== index))
            }
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        className="button"
        type="button"
        onClick={() =>
          setOutsourced([
            ...outsourced,
            { vendorId: "", description: "", cost: 0 },
          ])
        }
      >
        <Plus size={15} />
        Add outsourced item
      </button>
      <div className="pricing-summary">
        <Field label="Discount (₹)">
          <input
            type="number"
            min="0"
            step=".01"
            value={rupees(discount)}
            onChange={(e) =>
              setDiscount(Math.round(Number(e.target.value) * 100))
            }
          />
        </Field>
        <div>
          <small>Calculated total</small>
          <strong>{money(total)}</strong>
          <small>Rental lines + outsourcing − discount</small>
        </div>
      </div>
      <label className="checkbox-group">
        <input
          type="checkbox"
          checked={negotiated}
          onChange={(e) => setNegotiated(e.target.checked)}
        />
        Use an explicitly negotiated total
      </label>
      {negotiated && (
        <Field label="Negotiated total (₹)">
          <input
            name="total"
            type="number"
            min="0"
            step=".01"
            defaultValue={rupees(booking?.total)}
          />
        </Field>
      )}
      <Field label="Original equipment description (historical / notes)">
        <input
          name="equipmentText"
          defaultValue={booking?.equipmentText ?? ""}
        />
      </Field>
      <Field label="Booking notes">
        <textarea name="notes" defaultValue={booking?.notes ?? ""} />
      </Field>
      <p className="footnote">
        Rental days:{" "}
        {data.settings.rentalPolicy === "24H"
          ? "each started 24-hour period, minimum one day"
          : "inclusive calendar days in IST"}
        . No automatic late fees or extra tax.
      </p>
      <FormFooter busy={busy} />
    </form>
  );
}
function SettingsForm({
  settings,
  busy,
  submit,
}: {
  settings: Data["settings"];
  busy: boolean;
  submit: (v: unknown) => unknown;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          body: Record<string, unknown> = { ...settings };
        for (const k of [
          "businessName",
          "address",
          "phone",
          "email",
          "gst",
          "invoicePrefix",
          "rentalPolicy",
          "paymentModeRequiredFrom",
          "terms",
          "paymentInstructions",
        ])
          body[k] = f.get(k);
        body.turnaroundMinutes = Number(f.get("turnaroundMinutes"));
        body.taxPercent = Number(f.get("taxPercent"));
        body.templates = Object.fromEntries(
          Object.keys(settings.templates).map((k) => [
            k,
            f.get(`template-${k}`),
          ]),
        );
        submit(body);
      }}
    >
      <div className="form-grid">
        {(
          [
            "businessName",
            "address",
            "phone",
            "email",
            "gst",
            "invoicePrefix",
            "paymentModeRequiredFrom",
          ] as const
        ).map((k) => (
          <Field key={k} label={k.replace(/([A-Z])/g, " $1")}>
            <input
              name={k}
              defaultValue={settings[k]}
              required={[
                "businessName",
                "invoicePrefix",
                "paymentModeRequiredFrom",
              ].includes(k)}
              type={
                k === "paymentModeRequiredFrom"
                  ? "date"
                  : k === "email"
                    ? "email"
                    : "text"
              }
            />
          </Field>
        ))}
        <Field label="Rental policy">
          <select name="rentalPolicy" defaultValue={settings.rentalPolicy}>
            <option value="24H">Started 24-hour periods</option>
            <option value="CALENDAR">Inclusive calendar days (IST)</option>
          </select>
        </Field>
        <Field label="Turnaround buffer (minutes)">
          <input
            name="turnaroundMinutes"
            type="number"
            min="0"
            max="10080"
            defaultValue={settings.turnaroundMinutes}
          />
        </Field>
        <Field label="Optional tax rate (%) — informational on documents">
          <input
            name="taxPercent"
            type="number"
            min="0"
            max="100"
            step=".01"
            defaultValue={settings.taxPercent}
          />
        </Field>
      </div>
      <Field label="Rental terms (no terms are assumed)">
        <textarea name="terms" defaultValue={settings.terms} />
      </Field>
      <Field label="Payment instructions">
        <textarea
          name="paymentInstructions"
          defaultValue={settings.paymentInstructions}
        />
      </Field>
      <h3 className="section-title">WhatsApp templates</h3>
      <p className="footnote">
        Variables:{" "}
        {"{customer}, {booking}, {total}, {balance}, {pickup}, {return}"}.
        Messages open only after a staff action.
      </p>
      {(
        Object.keys(settings.templates) as (keyof typeof settings.templates)[]
      ).map((k) => (
        <Field key={k} label={k}>
          <textarea
            name={`template-${k}`}
            defaultValue={settings.templates[k]}
          />
        </Field>
      ))}
      <FormFooter busy={busy} />
    </form>
  );
}
