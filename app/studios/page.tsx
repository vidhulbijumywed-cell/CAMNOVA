import { meta } from "@/lib/public-site";
import { PublicShell, Crumbs } from "../components/public-site";
import StudiosSection from "../components/studios";
import StudioSchema from "../components/studio-schema";
export const metadata = meta(
  "Studio bookings & podcast packages | CAMNOVA",
  "Explore CAMNOVA's Thammanam and Vennala studios. Shooting floors, podcast rooms, makeup rooms, pantry and in-house rental gear. Request your preferred date.",
  "/studios",
);
export default function StudiosPage() {
  return (
    <PublicShell>
      <Crumbs
        parts={[
          { name: "Home", path: "/" },
          { name: "Studios", path: "/studios" },
        ]}
      />
      <h1>Studio bookings</h1>
      <p>
        Come rent and shoot. Choose a floor, share your preferred date and let
        our team help plan your session.
      </p>
      <StudioSchema />
      <StudiosSection gearHref="/rentals#catalogue" priority />
    </PublicShell>
  );
}
