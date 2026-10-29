import Link from "next/link";
import { publicInventory } from "@/lib/public-site";
import { money } from "@/lib/domain";
export function EquipmentCards({
  items,
  unit,
}: {
  items: Awaited<ReturnType<typeof publicInventory>>;
  unit: string;
}) {
  return (
    <div className="seo-grid">
      {items.map((e) => (
        <article className="seo-card" key={e.id}>
          {e.photo && (
            <img
              src={e.photo}
              alt={e.name}
              width="320"
              height="210"
              loading="lazy"
            />
          )}
          <h3>
            <Link href={`/rentals/${e.slug}`}>{e.name}</Link>
          </h3>
          <p>
            {e.rate === null
              ? "Ask for a rental quote"
              : `${money(e.rate)} / ${unit}`}
          </p>
          <Link href={`/rentals/${e.slug}`}>Details and availability</Link>
        </article>
      ))}
    </div>
  );
}
