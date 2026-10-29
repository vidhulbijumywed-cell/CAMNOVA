import type { ReactNode } from "react";
import { Camera } from "lucide-react";
import { money } from "@/lib/domain";
export const rentalCategoryLabels: Record<string, string> = {
  CAMERA: "Cameras",
  LENS: "Lenses",
  LIGHT: "Lights",
  GIMBAL: "Gimbals",
  MIC: "Audio",
  BATTERY: "Batteries",
  CARD: "Cards",
  OTHER: "Accessories",
};
type RentalItem = {
  id: string;
  name: string;
  category: string;
  rate: number | null;
  photo: string | null;
};
export default function RentalCard({
  item,
  href,
  availability = "Check dates for availability",
  unavailable = false,
  actions,
  warning,
  billingDescription = "day",
}: {
  item: RentalItem;
  href?: string;
  availability?: ReactNode;
  unavailable?: boolean;
  actions: ReactNode;
  warning?: ReactNode;
  billingDescription?: string;
}) {
  return (
    <article className="portal-product">
      <div className="portal-product-image">
        {item.photo ? (
          <img
            src={item.photo}
            alt={item.name}
            width="320"
            height="190"
            loading="lazy"
          />
        ) : (
          <Camera size={72} strokeWidth={1} aria-hidden="true" />
        )}
        <span>{rentalCategoryLabels[item.category] || item.category}</span>
      </div>
      <h3>{href ? <a href={href}>{item.name}</a> : item.name}</h3>
      <p className={unavailable ? "portal-unavailable" : ""}>{availability}</p>
      <div className="portal-product-bottom">
        <strong>
          {item.rate === null ? "Rate on request" : money(item.rate)}
          {item.rate !== null && (
            <small title={billingDescription}> / day</small>
          )}
        </strong>
        {actions}
      </div>
      {warning}
    </article>
  );
}
