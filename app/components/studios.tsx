"use client";
import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Mic,
  Paintbrush,
  Coffee,
  Package,
  ArrowUpRight,
  X,
} from "lucide-react";
import data from "@/data/studios.json";
import "../studios.css";
type Studio = (typeof data.studios)[number];
declare global {
  interface Window {
    CAMNOVA_REQUEST_URL?: string;
  }
}
const icons = [Camera, Mic, Paintbrush, Coffee, Package];
const rooms = [
  "hero",
  "shootingFloor",
  "podcastRoom",
  "makeupRoom",
  "pantry",
] as const;
const needs = [
  "Shooting floor",
  "Podcast room",
  "Makeup room",
  "Podcast package",
];
export default function StudiosSection({
  gearHref = "#catalogue",
  priority = false,
}: {
  gearHref?: string;
  priority?: boolean;
}) {
  const [selected, setSelected] = useState<
    Record<string, (typeof rooms)[number]>
  >({});
  const [booking, setBooking] = useState<{
    studio: string;
    packageId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [whatsappLink, setWhatsappLink] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (booking) {
      setError("");
      setSuccess("");
      setWhatsappLink("");
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [booking]);
  function open(s: Studio, packageId = "") {
    setBooking({ studio: s.id, packageId });
  }
  const [today, setToday] = useState("");
  useEffect(
    () =>
      setToday(
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      ),
    [],
  );
  return (
    <section
      id="studios"
      className="studio-section"
      aria-labelledby="studio-title"
    >
      <div className="studio-heading">
        <div>
          <p className="studio-kicker">SPACES FOR YOUR NEXT IDEA</p>
          <h2 id="studio-title">Come rent and shoot</h2>
          <p>{data.intro}</p>
        </div>
        <a href="/studios" className="studio-text-link">
          Studio bookings <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="studio-grid">
        {data.studios.map((s, index) => {
          const active = selected[s.id] || "hero";
          return (
            <article className="studio-card" id={`studio-${s.id}`} key={s.id}>
              <img
                className="studio-hero-image"
                src={s.images[active]}
                alt={s.alt[active]}
                width={active === "hero" ? 1600 : 1200}
                height="900"
                loading={priority && index === 0 ? "eager" : "lazy"}
              />
              <div
                className="studio-thumbnails"
                role="group"
                aria-label={`${s.location} room gallery`}
              >
                {rooms
                  .filter((k) => k !== "hero" && k !== "pantry")
                  .map((k) => (
                    <button
                      key={k}
                      aria-label={`Show ${s.location} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`}
                      aria-pressed={active === k}
                      onClick={() => setSelected({ ...selected, [s.id]: k })}
                    >
                      <img
                        src={s.images[k]}
                        alt={s.alt[k]}
                        width="1200"
                        height="900"
                        loading="lazy"
                      />
                    </button>
                  ))}
              </div>
              <div className="studio-gallery-options">
                <button
                  aria-pressed={active === "hero"}
                  onClick={() => setSelected({ ...selected, [s.id]: "hero" })}
                >
                  Studio overview
                </button>
                <button
                  aria-pressed={active === "pantry"}
                  onClick={() => setSelected({ ...selected, [s.id]: "pantry" })}
                >
                  View pantry
                </button>
              </div>
              <div className="studio-card-copy">
                {s.placeholderImages && (
                  <p className="studio-sample-note">
                    Sample images — real studio photos coming soon
                  </p>
                )}
                <h3>{s.name}</h3>
                <ul className="studio-facilities">
                  {s.facilities.map((f, i) => {
                    const Icon = icons[i];
                    return (
                      <li key={f}>
                        <Icon size={18} aria-hidden="true" />
                        {f}
                      </li>
                    );
                  })}
                </ul>
                <p>
                  {s.address ||
                    "Full address will be shared by our team before your visit."}
                </p>
                {s.mapsUrl ? (
                  <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer">
                    Get directions <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <p className="studio-sample-note">
                    Directions link coming soon — contact our team before
                    travelling.
                  </p>
                )}
                <button className="studio-button" onClick={() => open(s)}>
                  Book this studio <ArrowUpRight size={18} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="studio-gear-band">
        <div>
          <h3>Need gear? Rent it in the studio.</h3>
          <p>Find equipment for your shoot in our rental catalogue.</p>
        </div>
        <a className="studio-button" href={gearHref}>
          Explore the gear <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="studio-packages">
        <p className="studio-kicker">RECORD. CREATE. SHARE.</p>
        <h2>Podcast packages, editing included</h2>
        <p>
          Tell us what you want to record. Our team will help confirm the
          package details.
        </p>
        <div className="studio-package-grid">
          {data.podcastPackages.map((p) => (
            <article className="studio-card" key={p.id}>
              <img
                src={p.image}
                alt={p.alt}
                width="1200"
                height="900"
                loading="lazy"
              />
              <div className="studio-card-copy">
                <h3>{p.name}</h3>
                {p.placeholder && (
                  <p className="studio-sample-note">
                    Package details to be confirmed
                  </p>
                )}
                <ul>
                  {p.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <button
                  className="studio-button"
                  onClick={() => open(data.studios[0], p.id)}
                >
                  Ask about this package <ArrowUpRight size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="studio-both">
        <h3>What both floors have</h3>
        <ul>
          {data.studios[0].facilities.slice(0, 4).map((f, i) => {
            const Icon = icons[i];
            return (
              <li key={f}>
                <Icon aria-hidden="true" />
                {f}
              </li>
            );
          })}
        </ul>
      </div>
      <dialog
        ref={dialog}
        className="studio-dialog"
        aria-labelledby="studio-request-title"
        onCancel={() => setBooking(null)}
        onClose={() => setBooking(null)}
      >
        <button
          className="studio-close"
          aria-label="Close studio request"
          onClick={() => setBooking(null)}
        >
          <X />
        </button>
        <h2 id="studio-request-title">Request a studio booking</h2>
        <p>
          Send your preferred date and requirements. Our representative will
          contact you to confirm the details. All times are in India Standard
          Time.
        </p>
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
        {whatsappLink && (
          <a
            className="studio-button"
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WhatsApp to send your request
          </a>
        )}
        <form
          key={booking ? `${booking.studio}-${booking.packageId}` : "closed"}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setError("");
            setSuccess("");
            const fields = new FormData(e.currentTarget);
            const payload = {
              studio: String(fields.get("studio")),
              need: String(fields.get("need")),
              date: String(fields.get("date")),
              time: String(fields.get("time")),
              people: Number(fields.get("people")),
              package: String(fields.get("package") || "none"),
              gear: String(fields.get("gear")),
              name: String(fields.get("name")).trim(),
              phone: String(fields.get("phone")).trim(),
              notes: String(fields.get("notes")).trim(),
            };
            if (!payload.name || payload.phone.replace(/\D/g, "").length < 8) {
              setError("Enter your name and a valid contact number.");
              return;
            }
            if (
              new Date(`${payload.date}T${payload.time}:00+05:30`).getTime() <=
              Date.now()
            ) {
              setError("Choose a future preferred date and time.");
              return;
            }
            const studio = data.studios.find((s) => s.id === payload.studio)!;
            const pkg =
              data.podcastPackages.find((p) => p.id === payload.package)
                ?.name || "none";
            if (payload.need === "Podcast package" && pkg === "none") {
              setError(
                "Select a podcast package, or choose Podcast room for a general enquiry.",
              );
              return;
            }
            const text = `Hi Camnova, I would like to book the ${studio.location} studio for ${payload.need} on ${payload.date} at ${payload.time} for ${payload.people} people. Podcast package: ${pkg}. I need gear: ${payload.gear}. Name: ${payload.name}. Phone: ${payload.phone}. Notes: ${payload.notes}`;
            const link = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(text)}`;
            setWhatsappLink(link);
            window.open(link, "_blank", "noopener,noreferrer");
            setSuccess(
              "Your WhatsApp message is ready. Tap Send in WhatsApp to submit your request. Our representative will contact you to complete the booking.",
            );
            if (window.CAMNOVA_REQUEST_URL) {
              setBusy(true);
              try {
                const endpoint = new URL(
                  window.CAMNOVA_REQUEST_URL,
                  window.location.origin,
                );
                if (
                  endpoint.protocol !== "https:" &&
                  endpoint.origin !== window.location.origin
                )
                  throw Error("The booking endpoint must use HTTPS.");
                const response = await fetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...payload,
                    studio: studio.location,
                    package: pkg,
                  }),
                });
                if (!response.ok)
                  throw Error(
                    "The additional booking endpoint could not save your request. You can still send it on WhatsApp.",
                  );
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not save the additional request. Send your message on WhatsApp.",
                );
              } finally {
                setBusy(false);
              }
            }
          }}
        >
          <label>
            Full name
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            Phone or WhatsApp
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={25}
              pattern={String.raw`[\+0-9\s\(\)\-]{8,25}`}
            />
          </label>
          <label>
            Studio
            <select name="studio" defaultValue={booking?.studio}>
              {data.studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.location}
                </option>
              ))}
            </select>
          </label>
          <label>
            What you need
            <select
              name="need"
              defaultValue={
                booking?.packageId ? "Podcast package" : "Shooting floor"
              }
            >
              {needs.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Podcast package
            <select name="package" defaultValue={booking?.packageId || "none"}>
              <option value="none">None / general enquiry</option>
              {data.podcastPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-form-row">
            <label>
              Preferred date
              <input name="date" type="date" min={today} required />
            </label>
            <label>
              Preferred time (IST)
              <input name="time" type="time" required />
            </label>
          </div>
          <label>
            Number of people
            <input name="people" type="number" min="1" step="1" required />
          </label>
          <label>
            Do you need gear from us?
            <select name="gear">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="notes" maxLength={2000} />
          </label>
          <button className="studio-button" disabled={busy}>
            {busy ? "Saving request…" : "Continue to WhatsApp"}
          </button>
        </form>
      </dialog>
    </section>
  );
}
