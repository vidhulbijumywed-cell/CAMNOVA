import Link from "next/link";
import { publicInventory, publicCategories } from "@/lib/public-site";
import { settings } from "@/lib/service";
import { EquipmentCards } from "./equipment";
import "../seo.css";
export default async function CatalogueLinks({ page = 1 }: { page?: number }) {
  const [items, cats, s] = await Promise.all([
    publicInventory(),
    publicCategories(),
    settings(),
  ]);
  const pages = Math.max(1, Math.ceil(items.length / 24));
  return (
    <section
      className="seo-site"
      style={{ padding: "35px 5%" }}
      aria-label="Equipment rental directory"
    >
      <h2>Rental equipment</h2>
      <p>
        Browse current model details and rental rates. Use the date picker above
        to check availability.
      </p>
      <nav className="seo-pagination" aria-label="Equipment categories">
        {cats.map((c) => (
          <Link key={c.slug} href={`/${c.slug}`}>
            {c.plural}
          </Link>
        ))}
      </nav>
      <EquipmentCards
        items={items.slice((page - 1) * 24, page * 24)}
        unit={
          s.rentalPolicy === "24H" ? "started 24-hour period" : "calendar day"
        }
      />
      {pages > 1 && (
        <nav className="seo-pagination" aria-label="Catalogue pages">
          {Array.from({ length: pages }, (_, i) => (
            <Link
              key={i}
              aria-current={page === i + 1 ? "page" : undefined}
              href={i ? `/rentals?page=${i + 1}` : "/rentals"}
            >
              Page {i + 1}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
