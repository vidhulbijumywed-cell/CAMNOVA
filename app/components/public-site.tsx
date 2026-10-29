import Link from "next/link";
import {
  publicCategories,
  publicGuides,
  business,
  jsonLd,
  breadcrumbs,
} from "@/lib/public-site";
import "../seo.css";
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
export function Crumbs({ parts }: { parts: { name: string; path: string }[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="seo-crumbs">
        {parts.map((p) => (
          <Link key={p.path} href={p.path}>
            {p.name}
          </Link>
        ))}
      </nav>
      <JsonLd data={breadcrumbs(parts)} />
    </>
  );
}
export async function SiteNav() {
  const [cats, guides] = await Promise.all([
    publicCategories(),
    publicGuides(),
  ]);
  return (
    <nav className="seo-nav" aria-label="Website navigation">
      <Link className="seo-brand" href="/" aria-label="CAMNOVA Rentals home">
        <img
          src="/storefront/wordmark-white.png"
          alt="CAMNOVA Rentals"
          width="180"
          height="57"
        />
      </Link>
      <Link href="/rentals">Equipment</Link>
      {cats.map((c) => (
        <Link key={c.code} href={`/${c.slug}`}>
          {c.plural}
        </Link>
      ))}
      <Link href="/studios">Studios</Link>
      {guides.length > 0 && <Link href="/guides">Guides</Link>}
      <Link href="/about">About</Link>
      <Link href="/contact">Contact</Link>
    </nav>
  );
}
export async function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="seo-site">
      <SiteNav />
      <main>{children}</main>
      <footer>
        <Link href="/rentals">Book equipment</Link> ·{" "}
        <Link href="/contact">Contact CAMNOVA</Link> ·{" "}
        <Link href="/login">Staff login</Link>
      </footer>
    </div>
  );
}
export function Questions({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  return faqs.length > 0 ? (
    <section>
      <h2>Common questions</h2>
      {faqs.map((f) => (
        <details key={f.question}>
          <summary>{f.question}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </section>
  ) : null;
}
export async function ContactDetails() {
  const b = await business();
  return (
    <section>
      <h2>Contact and pickup</h2>
      <p>CAMNOVA Rentals · Kochi, Kerala</p>
      {b?.address && <p>{b.address}</p>}
      {b?.hours && <p>Opening hours: {b.hours}</p>}
      {b?.phone && (
        <p>
          <a href={`tel:${b.phone.replace(/[^+\d]/g, "")}`}>Call {b.phone}</a> ·{" "}
          <a href={`https://wa.me/${b.phone.replace(/\D/g, "")}`}>
            WhatsApp enquiry
          </a>
        </p>
      )}
      {b?.mapsUrl && (
        <p>
          <a href={b.mapsUrl} rel="noopener noreferrer" target="_blank">
            Maps and directions
          </a>
        </p>
      )}
      {!b?.address && (
        <p>
          Confirm the pickup location and timing with our representative before
          travelling.
        </p>
      )}
      <Link href="/rentals">Browse equipment and send a rental request</Link>
    </section>
  );
}
