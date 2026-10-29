import type { MetadataRoute } from "next";
import {
  absolute,
  publicInventory,
  publicCategories,
  publicStudios,
  publicGuides,
  records,
} from "@/lib/public-site";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [items, cats, studios, guides, content] = await Promise.all([
    publicInventory(),
    publicCategories(),
    publicStudios(),
    publicGuides(),
    records(),
  ]);
  const b = content.find(
    (r) => r.kind === "BUSINESS" && r.published && r.verified,
  );
  return [
    ...["/", "/rentals", "/about", "/contact", "/studios"].map((path) => ({
      url: absolute(path),
      ...(b?.updatedAt ? { lastModified: b.updatedAt } : {}),
    })),
    ...Array.from(
      { length: Math.max(0, Math.ceil(items.length / 24) - 1) },
      (_, i) => ({ url: absolute(`/rentals?page=${i + 2}`) }),
    ),
    ...cats.map((c) => ({
      url: absolute(`/${c.slug}`),
      ...(c.page?.updatedAt ? { lastModified: c.page.updatedAt } : {}),
    })),
    ...items.map((e) => ({
      url: absolute(`/rentals/${e.slug}`),
      lastModified:
        e.page?.updatedAt && new Date(e.page.updatedAt) > e.updatedAt
          ? e.page.updatedAt
          : e.updatedAt,
    })),
    ...studios.map((s) => ({
      url: absolute(`/studios/${s.slug}`),
      lastModified: s.updatedAt,
    })),
    ...["STUDIO", "PODCAST"]
      .filter((type) => studios.some((s) => s.service === type))
      .map((type) => ({
        url: absolute(
          type === "STUDIO" ? "/studio-rental-kochi" : "/podcast-studio-kochi",
        ),
      })),
    ...(guides.length ? [{ url: absolute("/guides") }] : []),
    ...guides.map((g) => ({
      url: absolute(`/guides/${g.slug}`),
      lastModified: g.updatedAt,
    })),
  ];
}
