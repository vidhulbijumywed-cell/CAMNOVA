import Link from "next/link";
import type { publicInventory } from "@/lib/public-site";
import RentalCard from "./rental-card";
import "../customer-portal.css";
import "../catalogue-cards.css";
export function EquipmentCards({
  items,
  unit,
}: {
  items: Awaited<ReturnType<typeof publicInventory>>;
  unit: string;
}) {
  return (
    <>
      <p className="catalogue-billing">
        Rental billing: per {unit}. Check dates before sending your request.
      </p>
      <div className="portal portal-grid catalogue-cards">
        {items.map((e) => (
          <RentalCard
            key={e.id}
            item={e}
            href={`/rentals/${e.slug}`}
            billingDescription={unit}
            actions={
              <Link
                className="portal-add"
                aria-label={`Add ${e.name}`}
                href={`/rentals?item=${encodeURIComponent(e.id)}`}
              >
                Add
              </Link>
            }
          />
        ))}
      </div>
    </>
  );
}
