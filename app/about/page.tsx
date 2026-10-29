import Link from "next/link";
import { meta } from "@/lib/public-site";
import { PublicShell, Crumbs } from "@/app/components/public-site";
export const dynamic = "force-dynamic";
export const metadata = meta(
  "About CAMNOVA Rentals | The Complete Creator Space, Kochi",
  "Meet CAMNOVA Rentals / Camnova Private Limited, serving creators in Kochi, Kerala with camera and equipment rentals.",
  "/about",
);
export default function About() {
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ]}
      />
      <h1>CAMNOVA — The Complete Creator Space</h1>
      <p>
        CAMNOVA Rentals / Camnova Private Limited serves photographers,
        filmmakers and content creators in Kochi, Kerala.
      </p>
      <p>
        Explore our current camera, lens and production equipment inventory,
        choose your dates, and send a rental request. Our team confirms
        availability, pricing and pickup arrangements with you.
      </p>
      <p>
        From personal projects to commercial productions, our aim is to help
        creators find a setup that fits their next shoot.
      </p>
      <Link className="seo-action" href="/rentals">
        Explore rental equipment
      </Link>
    </PublicShell>
  );
}
