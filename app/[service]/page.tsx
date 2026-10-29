import { notFound } from "next/navigation";
import Link from "next/link";
import {
  publicCategories,
  publicInventory,
  publicStudios,
  records,
  meta,
  absolute,
} from "@/lib/public-site";
import {
  PublicShell,
  Crumbs,
  Questions,
  ContactDetails,
  JsonLd,
} from "@/app/components/public-site";
import { EquipmentCards } from "@/app/components/equipment";
import { settings } from "@/lib/service";
export const dynamic = "force-dynamic";
async function resolve(slug: string) {
  const [cats, studios] = await Promise.all([
    publicCategories(),
    publicStudios(),
  ]);
  const category = cats.find((c) => c.slug === slug);
  const type =
    slug === "studio-rental-kochi"
      ? "STUDIO"
      : slug === "podcast-studio-kochi"
        ? "PODCAST"
        : null;
  const floors = studios.filter((s) => s.service === type);
  if (!category && !floors.length) notFound();
  return { category, floors, type };
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const slug = (await params).service;
  const { category, type } = await resolve(slug);
  return meta(
    category?.page?.seoTitle ||
      `${category?.name || (type === "PODCAST" ? "Podcast studio" : "Studio")} rental in Kochi | CAMNOVA`,
    category?.page?.seoDescription ||
      category?.intro ||
      "Explore verified CAMNOVA studio facilities and rental details in Kochi.",
    `/${slug}`,
  );
}
export default async function ServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const slug = (await params).service;
  const { category, floors, type } = await resolve(slug);
  const [items, s, content] = await Promise.all([
    publicInventory(),
    settings(),
    records(),
  ]);
  const name = category
    ? `${category.name} rental in Kochi`
    : `${type === "PODCAST" ? "Podcast studio" : "Studio"} rental in Kochi`;
  const intro =
    category?.page?.description ||
    category?.intro ||
    "Explore our verified studio options. Confirm availability and shoot requirements with our team.";
  const unit =
    s.rentalPolicy === "24H" ? "started 24-hour period" : "calendar day";
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name, path: `/${slug}` },
        ]}
      />
      <h1>{name}</h1>
      <p>{intro}</p>
      {category && (
        <>
          <EquipmentCards
            items={items.filter((e) => e.category === category.code)}
            unit={unit}
          />
          <h2>Choosing your setup</h2>
          <p>{category.page?.body || category.help}</p>
        </>
      )}
      {floors.map((f) => (
        <article className="seo-card" key={f.id}>
          <h2>
            <Link href={`/studios/${f.slug}`}>{f.title}</Link>
          </h2>
          <p>{f.description}</p>
        </article>
      ))}
      <section>
        <h2>How renting works</h2>
        <p>
          Browse equipment, choose dates and send your request. Our
          representative checks the setup and pricing with you, then confirms
          your booking.
        </p>
        <Link className="seo-action" href="/rentals">
          Check dates and request a rental
        </Link>
      </section>
      <Questions
        faqs={
          category?.page?.faqs.length
            ? category.page.faqs
            : [
                {
                  question: "Is sending a request a confirmed booking?",
                  answer:
                    "No. Our team reviews the request and confirms the booking after checking availability and pricing.",
                },
                {
                  question: "Where can I collect the equipment?",
                  answer:
                    "Contact our representative to confirm the pickup location and timing in Kochi before travelling.",
                },
              ]
        }
      />
      <ContactDetails />
      <section>
        <h2>Related rental categories</h2>
        {(await publicCategories())
          .filter((c) => c.slug !== slug)
          .map((c) => (
            <p key={c.slug}>
              <Link href={`/${c.slug}`}>{c.plural} in Kochi</Link>
            </p>
          ))}
        {content
          .filter((p) => p.kind === "GUIDE" && p.published)
          .slice(0, 4)
          .map((g) => (
            <p key={g.id}>
              <Link href={`/guides/${g.slug}`}>{g.title}</Link>
            </p>
          ))}
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name,
          description: intro,
          areaServed: "Kochi, Kerala",
          url: absolute(`/${slug}`),
          provider: { "@id": absolute("/#business") },
        }}
      />
    </PublicShell>
  );
}
