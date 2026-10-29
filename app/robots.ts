import type { MetadataRoute } from "next";
import { absolute } from "@/lib/public-site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absolute("/sitemap.xml"),
  };
}
