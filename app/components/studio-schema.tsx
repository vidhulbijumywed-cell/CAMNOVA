import data from "@/data/studios.json";
import { absolute } from "@/lib/public-site";
import { JsonLd } from "./public-site";
export default function StudioSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": data.studios.map((s) => ({
          "@type": "LocalBusiness",
          "@id": absolute(`/studios#studio-${s.id}`),
          name: s.name,
          url: absolute(`/studios#studio-${s.id}`),
          telephone: `+${data.whatsapp}`,
          description: `${s.name}: ${s.facilities.join(", ")}. Podcast packages include editing.`,
          areaServed: "Kochi, Kerala",
          ...(s.address ? { address: s.address } : {}),
          ...(s.mapsUrl ? { hasMap: s.mapsUrl } : {}),
        })),
      }}
    />
  );
}
