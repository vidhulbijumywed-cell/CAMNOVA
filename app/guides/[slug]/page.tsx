import { notFound, permanentRedirect } from "next/navigation";
import { publicGuides, meta } from "@/lib/public-site";
import {
  PublicShell,
  Crumbs,
  Questions,
  ContactDetails,
} from "@/app/components/public-site";
export const dynamic = "force-dynamic";
async function guide(slug: string) {
  const g = (await publicGuides()).find(
    (g) => g.slug === slug || g.aliases.includes(slug),
  );
  if (!g) notFound();
  if (g.slug !== slug) permanentRedirect(`/guides/${g.slug}`);
  return g;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const g = await guide((await params).slug);
  return meta(
    g.seoTitle || `${g.title} | CAMNOVA`,
    g.seoDescription || g.description,
    `/guides/${g.slug}`,
  );
}
export default async function Guide({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const g = await guide((await params).slug);
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: g.title, path: `/guides/${g.slug}` },
        ]}
      />
      <article>
        <h1>{g.title}</h1>
        <p>{g.description}</p>
        <p>{g.body}</p>
        <Questions faqs={g.faqs} />
      </article>
      <ContactDetails />
    </PublicShell>
  );
}
