import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { publicStudios, meta, absolute } from "@/lib/public-site";
import {
  PublicShell,
  Crumbs,
  Questions,
  ContactDetails,
  JsonLd,
} from "@/app/components/public-site";
import { money } from "@/lib/domain";
export const dynamic = "force-dynamic";
async function studio(slug: string) {
  const s = (await publicStudios()).find(
    (s) => s.slug === slug || s.aliases.includes(slug),
  );
  if (!s) notFound();
  if (s.slug !== slug) permanentRedirect(`/studios/${s.slug}`);
  return s;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const s = await studio((await params).slug);
  return meta(
    s.seoTitle || `${s.title} | Studio rental`,
    s.seoDescription || s.description,
    `/studios/${s.slug}`,
  );
}
export default async function Studio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const s = await studio((await params).slug);
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: s.title, path: `/studios/${s.slug}` },
        ]}
      />
      <h1>{s.title}</h1>
      <p>{s.description}</p>
      <div className="seo-grid">
        {s.photos.map((p, i) => (
          <img
            className="seo-image"
            key={p}
            src={p}
            alt={`${s.title} — space view ${i + 1}`}
            width="520"
            height="340"
            loading={i ? "lazy" : "eager"}
          />
        ))}
      </div>
      <h2>Facilities and booking conditions</h2>
      <p>{s.body}</p>
      <dl>
        {s.details.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Rental rate: {money(s.rate)} per {s.unit}. Confirm available dates,
        minimum booking duration and any additional services with our team.
      </p>
      <Link className="seo-action" href="/contact">
        Enquire about this studio
      </Link>
      <Questions faqs={s.faqs} />
      <ContactDetails />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: s.title,
          description: s.description,
          url: absolute(`/studios/${s.slug}`),
          image: s.photos,
          areaServed: "Kochi, Kerala",
          provider: { "@id": absolute("/#business") },
          offers: {
            "@type": "Offer",
            businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: (s.rate! / 100).toFixed(2),
              priceCurrency: "INR",
              unitText: s.unit,
            },
          },
        }}
      />
    </PublicShell>
  );
}
