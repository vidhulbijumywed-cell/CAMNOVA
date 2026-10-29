import { notFound } from "next/navigation";
import Link from "next/link";
import { publicGuides, meta } from "@/lib/public-site";
import { PublicShell } from "@/app/components/public-site";
export const dynamic = "force-dynamic";
export const metadata = meta(
  "Rental planning guides | CAMNOVA",
  "Practical guides to planning your camera, equipment and studio rentals with CAMNOVA.",
  "/guides",
);
export default async function Guides() {
  const guides = await publicGuides();
  if (!guides.length) notFound();
  return (
    <PublicShell>
      <h1>Rental planning guides</h1>
      {guides.map((g) => (
        <article key={g.id}>
          <h2>
            <Link href={`/guides/${g.slug}`}>{g.title}</Link>
          </h2>
          <p>{g.description}</p>
        </article>
      ))}
    </PublicShell>
  );
}
