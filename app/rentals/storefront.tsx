"use client";
import { useEffect, useState, useRef } from "react";
import { signOut } from "next-auth/react";
import {
  Camera,
  ArrowRight,
  Package,
  Minus,
  Plus,
  LoaderCircle,
} from "lucide-react";
import { money, bookingNumber } from "@/lib/domain";
import type { customerCatalogue } from "@/lib/customer-portal";
type Catalogue = Awaited<ReturnType<typeof customerCatalogue>>;
type RequestRow = {
  id: number;
  status: string;
  pickupAt: string | null;
  returnAt: string | null;
  total: number | null;
  items: { quantity: number; equipment: { name: string } }[];
};
type Account = {
  phone: string;
  name: string;
  email: string;
  requests: RequestRow[];
};
const labels: Record<string, string> = {
  CAMERA: "Cameras",
  LENS: "Lenses",
  LIGHT: "Lights",
  GIMBAL: "Gimbals",
  MIC: "Audio",
  BATTERY: "Batteries",
  CARD: "Cards",
  OTHER: "Accessories",
};
const instant = (value: string) => `${value}:00+05:30`;
const displayDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "To be confirmed";
export default function CustomerStorefront({
  initial,
}: {
  initial: Catalogue;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const statuses = useRef<Record<number, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => {
    if (cartOpen) drawer.current?.showModal();
    else drawer.current?.close();
  }, [cartOpen]);
  const [catalogue, setCatalogue] = useState(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [checked, setChecked] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const current = checked?.from === from && checked?.to === to;
  const selected = catalogue.items.filter((e) => cart[e.id] > 0);
  const total = selected.reduce(
    (sum, e) => sum + (e.rate ?? 0) * cart[e.id] * (catalogue.days ?? 1),
    0,
  );
  async function refreshAccount() {
    const response = await fetch("/api/customer/me");
    if (response.ok) {
      const next: Account = await response.json();
      for (const request of next.requests) {
        if (
          statuses.current[request.id] &&
          statuses.current[request.id] !== request.status
        )
          setNotice(
            `Booking ${bookingNumber(request.id)} updated: ${request.status === "BOOKED" ? "Confirmed by our team" : request.status.replaceAll("_", " ")}.`,
          );
      }
      statuses.current = Object.fromEntries(
        next.requests.map((r) => [r.id, r.status]),
      );
      setAccount(next);
      setPhone((current) => current || next.phone);
    } else if (response.status === 401) setAccount(null);
  }
  useEffect(() => {
    setRequestKey(crypto.randomUUID());
    const date = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      }) + "T10:00";
    setFrom(date(1));
    setTo(date(2));
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("camnova-customer-cart") ?? "null",
      );
      if (saved) {
        setFrom(saved.from);
        setTo(saved.to);
        setCart(saved.cart);
      }
    } catch {
      sessionStorage.removeItem("camnova-customer-cart");
    }
    refreshAccount().catch(() =>
      setError("Unable to load your account. Refresh to try again."),
    );
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        refreshAccount().catch(() => {});
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function checkDates() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/customer/catalogue?${new URLSearchParams({ from: instant(from), to: instant(to) })}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCatalogue(result);
      setChecked({ from, to });
    } catch (e) {
      setChecked(null);
      setError(e instanceof Error ? e.message : "Unable to check availability");
    } finally {
      setBusy(false);
    }
  }
  function changeQuantity(id: string, quantity: number) {
    setCart({ ...cart, [id]: Math.max(0, quantity) });
    setRequestKey(crypto.randomUUID());
    const name = catalogue.items.find((e) => e.id === id)?.name ?? "Product";
    setNotice(
      quantity > (cart[id] ?? 0)
        ? `${name} added to your cart.`
        : `${name} quantity updated.`,
    );
  }
  return (
    <div className="portal" aria-busy={busy}>
      {busy && (
        <div className="app-loading" role="status">
          <LoaderCircle className="loading-spin" size={22} /> Please wait…
        </div>
      )}
      <header className="portal-header">
        <a href="/rentals">
          <img src="/storefront/wordmark-white.png" alt="CAMNOVA Rentals" />
        </a>
        <button className="portal-outline" onClick={() => setCartOpen(true)}>
          Cart ({Object.values(cart).reduce((n, q) => n + q, 0)})
        </button>
        <nav>
          <a href="#catalogue">Catalogue</a>
          {account && <a href="#my-requests">My requests</a>}
          <a href="/login">Staff login</a>
        </nav>
        {account ? (
          <button
            className="portal-outline"
            onClick={() => signOut({ callbackUrl: "/rentals" })}
          >
            Sign out
          </button>
        ) : (
          <a className="portal-button" href="/customer/login">
            Customer sign in
          </a>
        )}
      </header>
      <section className="portal-hero">
        <div>
          <span className="portal-eyebrow">CAMNOVA RENTALS</span>
          <h1>
            Your vision.
            <br />
            Our gear.
          </h1>
          <p>
            Pick your dates, find the right equipment and send a rental request.
            Our team takes care of the confirmation.
          </p>
          <a className="portal-button" href="#catalogue">
            Find your equipment <ArrowRight size={18} />
          </a>
        </div>
        <div className="portal-art" aria-hidden="true">
          <img
            className="portal-art-camera"
            src="/storefront/cam.webp"
            alt=""
          />
          <img className="portal-art-lens" src="/storefront/g50.webp" alt="" />
          <img
            className="portal-art-gimbal"
            src="/storefront/rs5.webp"
            alt=""
          />
        </div>
      </section>
      <main className="portal-content">
        <form
          className="portal-dates"
          onSubmit={(event) => {
            event.preventDefault();
            checkDates();
          }}
        >
          <div>
            <span className="portal-eyebrow">PLAN YOUR SHOOT</span>
            <h2>When do you need it?</h2>
            <small>All times are in India Standard Time.</small>
          </div>
          <label>
            Pickup (IST)
            <input
              type="datetime-local"
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setRequestKey(crypto.randomUUID());
              }}
            />
          </label>
          <label>
            Return (IST)
            <input
              type="datetime-local"
              required
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setRequestKey(crypto.randomUUID());
              }}
            />
          </label>
          <button className="portal-button" disabled={busy}>
            {busy && <LoaderCircle className="loading-spin" size={18} />}
            {busy ? "Checking…" : "Check availability"}
          </button>
        </form>
        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}
        <section id="catalogue" className="portal-catalogue">
          <div className="portal-section-title">
            <div>
              <span className="portal-eyebrow">READY FOR YOUR NEXT STORY</span>
              <h2>The catalogue</h2>
              <p>
                {current
                  ? `${catalogue.days} rental day(s). Availability is checked again when you send your request.`
                  : "Choose your dates and check availability before adding equipment."}
              </p>
            </div>
            <label className="portal-search">
              Search equipment
              <input
                type="search"
                placeholder="Camera, lens, light…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="portal-filters">
            {["All", ...new Set(catalogue.items.map((e) => e.category))].map(
              (c) => (
                <button
                  key={c}
                  className={category === c ? "selected" : ""}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {labels[c] ?? c}
                </button>
              ),
            )}
          </div>
          <div className="portal-grid">
            {catalogue.items
              .filter(
                (e) =>
                  (category === "All" || e.category === category) &&
                  e.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((e) => (
                <article className="portal-product" key={e.id}>
                  <div className="portal-product-image">
                    {e.photo ? (
                      <img src={e.photo} alt={e.name} loading="lazy" />
                    ) : (
                      <Camera size={72} strokeWidth={1} />
                    )}
                    <span>{labels[e.category] ?? e.category}</span>
                  </div>
                  <h3>{e.name}</h3>
                  <p
                    className={
                      current && !e.available ? "portal-unavailable" : ""
                    }
                  >
                    {current
                      ? e.available
                        ? `${e.available} available for your dates`
                        : "Unavailable for these dates"
                      : "Check dates for availability"}
                  </p>
                  <div className="portal-product-bottom">
                    <strong>
                      {e.rate === null ? "Rate on request" : money(e.rate)}
                      {e.rate !== null && <small> / day</small>}
                    </strong>
                    {cart[e.id] ? (
                      <div className="portal-stepper">
                        <button
                          aria-label={`Remove one ${e.name}`}
                          onClick={() => changeQuantity(e.id, cart[e.id] - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{cart[e.id]}</span>
                        <button
                          aria-label={`Add one ${e.name}`}
                          disabled={
                            !current || busy || cart[e.id] >= (e.available ?? 0)
                          }
                          onClick={() => changeQuantity(e.id, cart[e.id] + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="portal-add"
                        aria-label={`Add ${e.name}`}
                        disabled={!current || busy || !e.available}
                        onClick={() => changeQuantity(e.id, 1)}
                      >
                        Add
                      </button>
                    )}
                  </div>
                  {current && (cart[e.id] ?? 0) > (e.available ?? 0) && (
                    <p className="portal-error">
                      Reduce quantity for these dates.
                    </p>
                  )}
                </article>
              ))}
          </div>
          {!catalogue.items.some(
            (e) =>
              (category === "All" || e.category === category) &&
              e.name.toLowerCase().includes(query.toLowerCase()),
          ) && <p>No equipment matches your search.</p>}
        </section>
        <dialog
          ref={drawer}
          className="portal-checkout"
          onCancel={() => setCartOpen(false)}
          onClose={() => setCartOpen(false)}
          aria-label="Your rental request"
        >
          <button className="portal-outline" onClick={() => setCartOpen(false)}>
            Close · keep browsing
          </button>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          {!selected.length && (
            <p>Your cart is empty. Browse the catalogue to choose equipment.</p>
          )}
          {selected.length > 0 && (
            <section className="portal-request">
              <h2>Your rental request</h2>
              <p>
                Requests are not reservations. Gear is reserved only after our
                team confirms your booking.
              </p>
              <ul>
                {selected.map((e) => (
                  <li key={e.id}>
                    {e.name} × {cart[e.id]}
                  </li>
                ))}
              </ul>
              {current && (
                <p>
                  <strong>Estimated rental: {money(total)}</strong>
                  {selected.some((e) => e.rate === null) &&
                    " plus items requiring a quote"}
                  . Final pricing is confirmed by our team.
                </p>
              )}
              {account ? (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!current || busy) return;
                    setBusy(true);
                    setError("");
                    try {
                      const response = await fetch("/api/customer/requests", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          from: instant(from),
                          to: instant(to),
                          requestKey,
                          notes,
                          phone,
                          items: selected.map((e) => ({
                            equipmentId: e.id,
                            quantity: cart[e.id],
                          })),
                        }),
                      });
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error);
                      setNotice(
                        `Booking request sent (${bookingNumber(result.id)}). Our representative will contact you soon to complete your booking.`,
                      );
                      setCart({});
                      setNotes("");
                      setRequestKey(crypto.randomUUID());
                      sessionStorage.removeItem("camnova-customer-cart");
                      await refreshAccount();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Unable to send request",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Phone or WhatsApp
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={25}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Number our representative can reach"
                    />
                  </label>
                  <label>
                    What are you shooting? (optional)
                    <textarea
                      maxLength={1000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button
                    className="portal-button"
                    disabled={
                      !current ||
                      busy ||
                      selected.some((e) => cart[e.id] > (e.available ?? 0))
                    }
                  >
                    {busy && (
                      <LoaderCircle className="loading-spin" size={18} />
                    )}
                    {busy ? "Sending…" : "Send rental request"}
                  </button>
                </form>
              ) : (
                <a
                  className="portal-button"
                  href="/customer/login"
                  onClick={() =>
                    sessionStorage.setItem(
                      "camnova-customer-cart",
                      JSON.stringify({ from, to, cart }),
                    )
                  }
                >
                  Sign in to send your request
                </a>
              )}
              {!current && (
                <button
                  className="portal-button"
                  disabled={busy}
                  onClick={checkDates}
                >
                  Check availability for your dates
                </button>
              )}
            </section>
          )}
        </dialog>
        {selected.length > 0 && (
          <div className="portal-cart-bar">
            <strong>
              {Object.values(cart).reduce((n, q) => n + q, 0)} items ·{" "}
              {money(total)} estimated
            </strong>
            <button className="portal-button" onClick={() => setCartOpen(true)}>
              Review cart & request <ArrowRight size={18} />
            </button>
          </div>
        )}
        {notice && !cartOpen && (
          <div className="portal-toast" role="status">
            {notice}
            <button aria-label="Dismiss update" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {account && (
          <section id="my-requests" className="portal-my-requests">
            <span className="portal-eyebrow">WELCOME, {account.name}</span>
            <h2>My rental requests</h2>
            {account.requests.length === 0 ? (
              <p>Your rental requests will appear here.</p>
            ) : (
              account.requests.map((request) => (
                <article key={request.id}>
                  <div>
                    <strong>{bookingNumber(request.id)}</strong>
                    <span className="portal-status">
                      {request.status === "DRAFT"
                        ? "Awaiting confirmation"
                        : request.status === "DELETED"
                          ? "Removed by team"
                          : request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p>
                    {request.items
                      .map((i) => `${i.equipment.name} × ${i.quantity}`)
                      .join(" · ")}
                  </p>
                  <small>
                    {displayDate(request.pickupAt)} →{" "}
                    {displayDate(request.returnAt)} IST
                  </small>
                  <p>
                    {request.total === null
                      ? "Quote to be confirmed"
                      : `${request.status === "DRAFT" ? "Estimate" : "Rental total"}: ${money(request.total)}`}
                  </p>
                </article>
              ))
            )}
          </section>
        )}
      </main>
      <footer className="portal-footer">
        <img src="/storefront/wordmark-white.png" alt="CAMNOVA Rentals" />
        <p>Bring your vision. We’ll help you find the gear.</p>
        <small>
          Availability may change until your booking is confirmed. No online
          payment or identity-document upload is required.
        </small>
      </footer>
    </div>
  );
}
