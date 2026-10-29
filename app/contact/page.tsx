import { meta } from "@/lib/public-site";
import {
  PublicShell,
  ContactDetails,
  Crumbs,
} from "@/app/components/public-site";
export const dynamic = "force-dynamic";
export const metadata = meta(
  "Contact CAMNOVA Rentals | Kochi, Kerala",
  "Contact CAMNOVA Rentals in Kochi for camera, lens and equipment rental enquiries and pickup arrangements.",
  "/contact",
);
export default function Contact() {
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]}
      />
      <h1>Contact CAMNOVA Rentals in Kochi</h1>
      <p>
        Tell us your shoot dates and equipment requirements. Our representative
        will help complete your booking.
      </p>
      <ContactDetails />
    </PublicShell>
  );
}
