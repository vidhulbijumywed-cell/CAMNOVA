"use client";
import { useState } from "react";
import Link from "next/link";
import type { SiteContent } from "@/lib/public-site";
import "../../seo.css";
const blank = {
  id: "",
  kind: "GUIDE",
  slug: "",
  title: "",
  description: "",
  body: "",
  published: false,
  operational: false,
  verified: false,
  equipmentId: "",
  category: "",
  service: "STUDIO",
  seoTitle: "",
  seoDescription: "",
  details: [],
  faqs: [],
  photos: [],
  rate: null,
  unit: "hour",
  address: "",
  phone: "",
  hours: "",
  mapsUrl: "",
  instagram: "",
  aliases: [],
} as SiteContent;
export default function Editor({
  initial,
  inventory,
  categories,
}: {
  initial: SiteContent[];
  inventory: { id: string; name: string; category: string }[];
  categories: { code: string; slug: string; name: string }[];
}) {
  const [list, setList] = useState(initial),
    [record, setRecord] = useState<SiteContent>(blank),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const field = (key: keyof SiteContent, value: unknown) =>
    setRecord((r) => ({ ...r, [key]: value }));
  return (
    <main className="seo-editor">
      <Link href="/workspace">← Staff workspace</Link>
      <h1>Public website content</h1>
      <p>
        Only published records appear on the website. Equipment defaults to real
        inventory data until an override is saved. Studio and podcast spaces
        must remain drafts until verified and operational.
      </p>
      <select
        aria-label="Select website page"
        value={list.some((r) => r.id === record.id) ? record.id : ""}
        onChange={(e) =>
          setRecord(list.find((r) => r.id === e.target.value) || blank)
        }
      >
        <option value="">New draft</option>
        {list.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title} — {r.published ? "Published" : "Draft"}
          </option>
        ))}
      </select>
      <button onClick={() => setRecord({ ...blank, id: crypto.randomUUID() })}>
        New draft
      </button>
      <button
        onClick={() =>
          setRecord(
            list.find((r) => r.id === "business") || {
              ...blank,
              id: "business",
              kind: "BUSINESS",
              slug: "business",
              title: "CAMNOVA Rentals",
            },
          )
        }
      >
        Business contact profile
      </button>
      <form
        key={record.id}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const data = new FormData(e.currentTarget);
            const payload = {
              ...record,
              details: JSON.parse(String(data.get("details"))),
              faqs: JSON.parse(String(data.get("faqs"))),
              photos: String(data.get("photos"))
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            };
            const r = await fetch("/api/site-content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const result = await r.json();
            if (!r.ok) throw Error(result.error);
            const updated = await (await fetch("/api/site-content")).json();
            setList(updated);
            setRecord(updated.find((v: SiteContent) => v.id === record.id));
            setMessage("Website content saved.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Unable to save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Page type
          <select
            value={record.kind}
            onChange={(e) => field("kind", e.target.value)}
          >
            {["BUSINESS", "CATEGORY", "EQUIPMENT", "STUDIO", "GUIDE"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Stable content ID
          <input
            required
            value={record.id}
            onChange={(e) => field("id", e.target.value)}
          />
        </label>
        {record.kind === "EQUIPMENT" && (
          <label>
            Inventory item
            <select
              required
              value={record.equipmentId}
              onChange={(e) => {
                const item = inventory.find((i) => i.id === e.target.value);
                setRecord((r) => ({
                  ...r,
                  equipmentId: e.target.value,
                  title: item?.name || r.title,
                }));
              }}
            >
              <option value="">Select equipment</option>
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {record.kind === "CATEGORY" && (
          <label>
            Category
            <select
              required
              value={record.category}
              onChange={(e) => {
                const c = categories.find((c) => c.code === e.target.value)!;
                setRecord((r) => ({
                  ...r,
                  category: c.code,
                  slug: c.slug,
                  title: `${c.name} rental`,
                }));
              }}
            >
              <option value="">Choose category</option>
              {categories.map((c) => (
                <option value={c.code} key={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {record.kind === "STUDIO" && (
          <>
            <label>
              Service
              <select
                value={record.service}
                onChange={(e) => field("service", e.target.value)}
              >
                <option value="STUDIO">Studio floor</option>
                <option value="PODCAST">Podcast studio</option>
              </select>
            </label>
            <label>
              Rental rate (₹)
              <input
                type="number"
                min="0"
                step=".01"
                value={record.rate === null ? "" : record.rate / 100}
                onChange={(e) =>
                  field(
                    "rate",
                    e.target.value === ""
                      ? null
                      : Math.round(Number(e.target.value) * 100),
                  )
                }
              />
            </label>
            <label>
              Billing period
              <select
                value={record.unit}
                onChange={(e) => field("unit", e.target.value)}
              >
                <option value="hour">Hour</option>
                <option value="day">Day</option>
              </select>
            </label>
          </>
        )}
        {(
          [
            "slug",
            "title",
            "description",
            "body",
            "seoTitle",
            "seoDescription",
          ] as const
        ).map((key) => (
          <label key={key}>
            {
              {
                slug: "URL slug",
                title: "Page title",
                description: "Introduction",
                body: "Page content / inclusions / terms",
                seoTitle: "SEO title override",
                seoDescription: "SEO description override",
              }[key]
            }
            {["body", "description"].includes(key) ? (
              <textarea
                value={record[key]}
                onChange={(e) => field(key, e.target.value)}
              />
            ) : (
              <input
                required={["slug", "title"].includes(key)}
                value={record[key]}
                onChange={(e) => field(key, e.target.value)}
              />
            )}
          </label>
        ))}
        {record.kind === "BUSINESS" &&
          (["address", "phone", "hours", "mapsUrl", "instagram"] as const).map(
            (key) => (
              <label key={key}>
                {key}
                <input
                  value={record[key]}
                  onChange={(e) => field(key, e.target.value)}
                />
              </label>
            ),
          )}
        <label>
          Verified specifications / facilities (JSON list: label and value)
          <textarea
            name="details"
            defaultValue={JSON.stringify(record.details, null, 2)}
          />
        </label>
        <p>
          For studios include dimensions, ceiling height, capacity, power,
          facilities, sound treatment, minimum duration, pickup/access and
          additional charges. For podcasts include seating, microphones/cameras,
          operator, editing and file-delivery terms. Never claim soundproofing
          without verification.
        </p>
        <label>
          FAQs (JSON list: question and answer)
          <textarea
            name="faqs"
            defaultValue={JSON.stringify(record.faqs, null, 2)}
          />
        </label>
        <label>
          Studio photo HTTPS URLs — one per line
          <textarea name="photos" defaultValue={record.photos.join("\n")} />
        </label>
        <p>
          Equipment uses the real inventory photo; upload or replace it in
          Inventory.
        </p>
        <label>
          <input
            type="checkbox"
            checked={record.verified}
            onChange={(e) => field("verified", e.target.checked)}
          />
          Details verified
        </label>
        <label>
          <input
            type="checkbox"
            checked={record.operational}
            onChange={(e) => field("operational", e.target.checked)}
          />
          Service operational
        </label>
        <label>
          <input
            type="checkbox"
            checked={record.published}
            onChange={(e) => field("published", e.target.checked)}
          />
          Publish page
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save website content"}
        </button>
        <p role="status">{message}</p>
      </form>
    </main>
  );
}
