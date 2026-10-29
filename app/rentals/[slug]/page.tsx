import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  publicInventory,
  equipmentSlug,
  publicCategories,
  meta,
  absolute,
} from "@/lib/public-site";
import { settings } from "@/lib/service";
import { money } from "@/lib/domain";
import {
  PublicShell,
  Crumbs,
  Questions,
  ContactDetails,
  JsonLd,
} from "@/app/components/public-site";
import { EquipmentCards } from "@/app/components/equipment";
export const dynamic = "force-dynamic";
async function find(slug: string) {
  const items = await publicInventory();
  const e = items.find(
    (e) =>
      e.slug === slug ||
      equipmentSlug(e) === slug ||
      e.page?.aliases.includes(slug),
  );
  if (!e) notFound();
  if (e.slug !== slug) permanentRedirect(`/rentals/${e.slug}`);
  return { e, items };
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { e } = await find((await params).slug);
  return meta(
    e.page?.seoTitle || `${e.name} rental | CAMNOVA`,
    e.page?.seoDescription ||
      e.page?.description ||
      `Rent ${e.name} from CAMNOVA Rentals in Kochi, Kerala. Check rental rates, choose your dates and send a booking request.`,
    `/rentals/${e.slug}`,
  );
}
export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { e, items } = await find((await params).slug);
  const [s, categories] = await Promise.all([settings(), publicCategories()]);
  const c = categories.find((c) => c.code === e.category);
  const unit =
    s.rentalPolicy === "24H" ? "started 24-hour period" : "calendar day";
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: "Equipment", path: "/rentals" },
          ...(c ? [{ name: c.plural, path: `/${c.slug}` }] : []),
          { name: e.name, path: `/rentals/${e.slug}` },
        ]}
      />
      <h1>{e.name} rental</h1>
      {e.photo && (
        <img
          className="seo-image"
          src={e.photo}
          alt={e.name}
          width="520"
          height="340"
          fetchPriority="high"
        />
      )}
      <p>
        {e.page?.description ||
          `Plan your next shoot with ${e.name} from CAMNOVA Rentals in Kochi.`}
      </p>
      <h2>Rental pricing</h2>
      <p>
        {e.rate === null
          ? "Contact our team for a rental quote."
          : `${money(e.rate)} per ${unit}. Final pricing and any additional charges are confirmed by our team.`}
      </p>
      <Link
        className="seo-action"
        href={`/rentals?item=${encodeURIComponent(e.id)}`}
      >
        Check availability and request this item
      </Link>
      <p>
        Choose dates in the rental store for current availability. Sending a
        request does not reserve gear; our team confirms the booking.
      </p>
      {e.page?.body && (
        <section>
          <h2>Equipment details and rental information</h2>
          <p>{e.page.body}</p>
        </section>
      )}
      {e.page?.details.length ? (
        <dl>
          {e.page.details.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>
          Ask our team to confirm specifications, compatible accessories,
          included items and deposit or identification requirements before
          booking.
        </p>
      )}
      <Questions faqs={e.page?.faqs || []} />
      <ContactDetails />
      <h2>Related equipment</h2>
      <EquipmentCards
        items={items
          .filter((x) => x.category === e.category && x.id !== e.id)
          .slice(0, 4)}
        unit={unit}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `${e.name} rental`,
          serviceType: "Equipment rental",
          areaServed: "Kochi, Kerala",
          url: absolute(`/rentals/${e.slug}`),
          provider: { "@id": absolute("/#business") },
          ...(e.photo ? { image: absolute(e.photo) } : {}),
          ...(e.rate !== null
            ? {
                offers: {
                  "@type": "Offer",
                  businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: (e.rate / 100).toFixed(2),
                    priceCurrency: "INR",
                    unitText: unit,
                  },
                  url: absolute(`/rentals/${e.slug}`),
                },
              }
            : {}),
        }}
      />
    </PublicShell>
  );
}
