import { cache } from "react";
import { z } from "zod";
import type { Metadata } from "next";
import { db } from "./db";
import { Actor, admin, HttpError } from "./auth";
import { audit, locked } from "./service";
const configuredOrigin = new URL(
  process.env.PUBLIC_SITE_URL || "https://camnova.onrender.com",
);
if (
  configuredOrigin.protocol !== "https:" ||
  configuredOrigin.username ||
  configuredOrigin.password ||
  configuredOrigin.pathname !== "/" ||
  configuredOrigin.search ||
  configuredOrigin.hash
)
  throw new Error(
    "PUBLIC_SITE_URL must be one HTTPS origin without credentials, path or query",
  );
export const origin = configuredOrigin.origin;
export const absolute = (path: string) => new URL(path, origin).toString();
const safeUrl = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS URL"),
]);
export const titleText = (value: string) =>
  value
    .replace(/\s*(?:in\s+)?\bkochi\b(?:,\s*kerala)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[ ,|–—-]+$/g, "")
    .trim();
export const contentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9:_-]{1,150}$/),
  kind: z.enum(["BUSINESS", "CATEGORY", "EQUIPMENT", "STUDIO", "GUIDE"]),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(150),
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform(titleText)
    .refine(Boolean, "Enter a page title"),
  description: z.string().trim().max(1000).default(""),
  body: z.string().trim().max(12000).default(""),
  published: z.boolean().default(false),
  operational: z.boolean().default(false),
  verified: z.boolean().default(false),
  equipmentId: z.string().max(100).default(""),
  category: z.string().max(40).default(""),
  service: z.enum(["STUDIO", "PODCAST"]).default("STUDIO"),
  seoTitle: z.string().max(200).default("").transform(titleText),
  seoDescription: z.string().max(500).default(""),
  details: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(150),
        value: z.string().trim().min(1).max(2000),
      }),
    )
    .max(50)
    .default([]),
  faqs: z
    .array(
      z.object({
        question: z.string().min(1).max(300),
        answer: z.string().min(1).max(2000),
      }),
    )
    .max(30)
    .default([]),
  photos: z
    .array(
      z
        .url()
        .refine(
          (v) => v.startsWith("https://"),
          "Use a nonempty HTTPS photo URL",
        ),
    )
    .max(20)
    .default([]),
  rate: z.number().int().min(0).max(2000000000).nullable().default(null),
  unit: z.enum(["hour", "day"]).default("hour"),
  address: z.string().max(1000).default(""),
  phone: z
    .string()
    .max(30)
    .refine((v) => !v || /^\+?[\d ()-]{8,25}$/.test(v), "Enter a valid phone")
    .default(""),
  hours: z.string().max(1000).default(""),
  mapsUrl: safeUrl.default(""),
  instagram: safeUrl.default(""),
  aliases: z.array(z.string().max(150)).max(100).default([]),
});
export type SiteContent = z.infer<typeof contentSchema> & {
  updatedAt?: string;
};
export const categories = [
  {
    code: "CAMERA",
    slug: "camera-rental-kochi",
    name: "Camera",
    plural: "Cameras",
    intro:
      "Compare camera rental options for photography and filmmaking in Kochi. Choose your dates in the store to check availability.",
    help: "Choose a camera around your recording format, lens system and shoot duration. Ask our team to confirm lens and accessory compatibility before booking.",
  },
  {
    code: "LENS",
    slug: "lens-rental-kochi",
    name: "Lens",
    plural: "Lenses",
    intro:
      "Find lenses for your next shoot in Kochi. Browse actual rental rates and ask our team about the right fit for your camera.",
    help: "Consider focal length, aperture and camera mount. Compatibility varies by body and lens, so confirm your complete setup with our team.",
  },
  {
    code: "LIGHT",
    slug: "lighting-rental-kochi",
    name: "Lighting",
    plural: "Lighting",
    intro:
      "Explore photography and video lighting rentals in Kochi for your next production.",
    help: "Plan around your shooting space, available power and desired lighting style. Confirm stands, modifiers and power accessories with the team.",
  },
  {
    code: "GIMBAL",
    slug: "gimbal-rental-kochi",
    name: "Gimbal",
    plural: "Gimbals",
    intro:
      "Browse camera gimbal rentals in Kochi and check dates for your shoot.",
    help: "Check the combined weight and dimensions of your camera and lens. Ask the team to confirm balancing, payload and accessory compatibility.",
  },
  {
    code: "MIC",
    slug: "audio-rental-kochi",
    name: "Audio equipment",
    plural: "Audio",
    intro:
      "Explore microphone and recording equipment rentals in Kochi for interviews, films and content creation.",
    help: "Choose your microphone for the recording environment and number of speakers. Confirm connectors, receivers, recording devices and included accessories.",
  },
];
export const draftTemplates: SiteContent[] = [
  contentSchema.parse({
    id: "studio-floor",
    kind: "STUDIO",
    slug: "studio-floor-kochi",
    title: "Studio floor",
    published: false,
  }),
  contentSchema.parse({
    id: "podcast-studio",
    kind: "STUDIO",
    service: "PODCAST",
    slug: "podcast-studio-kochi",
    title: "Podcast studio",
    published: false,
  }),
  contentSchema.parse({
    id: "planning-guide",
    kind: "GUIDE",
    slug: "planning-your-equipment-rental",
    title: "Planning your equipment rental",
    published: true,
    description:
      "A practical checklist for choosing equipment, checking dates and sending your CAMNOVA rental request.",
    body: "Start with your shoot dates and the equipment you need. In the rental store, enter pickup and return times in India Standard Time and check availability.\n\nCompare camera and lens options, then confirm your camera mount, lens compatibility and required accessories with our representative. Do not assume that every accessory shown in a product photograph is included.\n\nSign in or create your customer account, add equipment to your cart and review the quantities. Include a phone number where our team can reach you and describe your shoot in the optional notes.\n\nSend the rental request. A request is not yet a reservation: our team checks the setup and pricing with you before confirming the booking. Follow the status in your customer account.\n\nBefore collecting equipment, confirm the pickup address, time, included items, identification or deposit requirements and return arrangements. Ask our team about these details rather than assuming a standard policy applies to every rental.",
  }),
];
export const records = cache(async (): Promise<SiteContent[]> => {
  const saved = (
    await db.setting.findMany({ where: { id: { startsWith: "public:" } } })
  ).map((r) => ({
    ...contentSchema.parse(r.value),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return [
    ...saved,
    ...draftTemplates.filter((t) => !saved.some((r) => r.id === t.id)),
  ];
});
export const business = cache(async () =>
  (await records()).find(
    (r) => r.kind === "BUSINESS" && r.published && r.verified,
  ),
);
export const equipmentSlug = (e: { id: string; name: string }) =>
  `${
    e.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "equipment"
  }-${e.id}`;
export const publicInventory = cache(async () => {
  const content = await records();
  const items = await db.equipment.findMany({
    where: { assets: { some: { status: { not: "RETIRED" } } } },
    select: {
      id: true,
      name: true,
      category: true,
      rate: true,
      updatedAt: true,
      photo: { select: { updatedAt: true } },
    },
    orderBy: { name: "asc" },
  });
  return items.flatMap((e) => {
    const page = content.find(
      (r) => r.kind === "EQUIPMENT" && r.equipmentId === e.id,
    );
    if (page && !page.published) return [];
    return [
      {
        ...e,
        page,
        slug: page?.slug || equipmentSlug(e),
        photo: e.photo
          ? `/api/customer/photos/${e.id}?v=${encodeURIComponent(e.photo.updatedAt.toISOString())}`
          : null,
      },
    ];
  });
});
export const publicCategories = cache(async () => {
  const [items, content] = await Promise.all([publicInventory(), records()]);
  return categories
    .filter(
      (c) =>
        items.some((e) => e.category === c.code) &&
        !content.some(
          (r) => r.kind === "CATEGORY" && r.category === c.code && !r.published,
        ),
    )
    .map((c) => ({
      ...c,
      page: content.find((r) => r.kind === "CATEGORY" && r.category === c.code),
    }));
});
export const publicStudios = cache(async () =>
  (await records()).filter(
    (r) => r.kind === "STUDIO" && r.published && r.verified && r.operational,
  ),
);
export const publicGuides = cache(async () =>
  (await records()).filter((r) => r.kind === "GUIDE" && r.published),
);
export function meta(
  title: string,
  description: string,
  path: string,
  noindex = false,
): Metadata {
  title = titleText(title);
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title,
      description,
      url: absolute(path),
      siteName: "CAMNOVA Rentals",
      type: "website",
      images: [
        { url: absolute("/storefront/cam.webp"), alt: "CAMNOVA rental camera" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absolute("/storefront/cam.webp")],
    },
  };
}
export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");
export function breadcrumbs(parts: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: parts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      item: absolute(p.path),
    })),
  };
}
export async function saveContent(a: Actor, input: unknown) {
  admin(a);
  const v = contentSchema.parse(input);
  if (v.kind === "BUSINESS" && v.id !== "business")
    throw new HttpError(400, "Use business as the business profile ID");
  if (v.kind === "BUSINESS" && v.published && !v.verified)
    throw new HttpError(400, "Verify business details before publication");
  if (
    v.kind === "CATEGORY" &&
    !categories.some((c) => c.code === v.category && c.slug === v.slug)
  )
    throw new HttpError(400, "Use an existing category and its canonical slug");
  if (
    v.published &&
    ["STUDIO", "GUIDE"].includes(v.kind) &&
    (!v.description || !v.body)
  )
    throw new HttpError(400, "Description and page content are required");
  if (
    v.published &&
    v.kind === "STUDIO" &&
    (!v.verified ||
      !v.operational ||
      !v.photos.length ||
      !v.details.length ||
      v.rate === null)
  )
    throw new HttpError(
      400,
      "Keep this studio as a draft until facilities, photos, rates and operational status are verified",
    );
  if (v.kind === "STUDIO" && v.published) {
    const needed =
      v.service === "PODCAST"
        ? [
            "seating",
            "microphones",
            "cameras",
            "operator",
            "editing",
            "file delivery",
            "sound treatment",
            "sound isolation",
            "minimum booking",
            "inclusions",
            "additional charges",
          ]
        : [
            "dimensions",
            "ceiling height",
            "capacity",
            "facilities",
            "power",
            "sound treatment",
            "sound isolation",
            "minimum booking",
            "inclusions",
            "additional charges",
          ];
    const missing = needed.filter(
      (label) => !v.details.some((d) => d.label.toLowerCase().includes(label)),
    );
    if (missing.length)
      throw new HttpError(
        400,
        `Keep this as a draft. Add verified details for: ${missing.join(", ")}`,
      );
  }
  return locked(async (tx) => {
    const existing = await tx.setting.findUnique({
      where: { id: `public:${v.id}` },
    });
    const old = existing
      ? contentSchema.parse(existing.value)
      : (draftTemplates.find((t) => t.id === v.id) ?? null);
    if (old && (old.kind !== v.kind || old.equipmentId !== v.equipmentId))
      throw new HttpError(400, "Content identity cannot be changed");
    if (
      v.kind === "EQUIPMENT" &&
      !(await tx.equipment.findUnique({ where: { id: v.equipmentId } }))
    )
      throw new HttpError(400, "Select a real inventory item");
    if (v.kind === "EQUIPMENT") {
      const equipment = await tx.equipment.findMany({
        select: { id: true, name: true },
      });
      if (
        equipment.some(
          (e) => e.id !== v.equipmentId && equipmentSlug(e) === v.slug,
        )
      )
        throw new HttpError(409, "This slug belongs to another inventory item");
    }
    const all = await tx.setting.findMany({
      where: { id: { startsWith: "public:" } },
    });
    const occupied = [
      ...all,
      ...draftTemplates
        .filter((t) => !all.some((r) => r.id === `public:${t.id}`))
        .map((t) => ({ id: `public:${t.id}`, value: t })),
    ];
    if (
      occupied.some(
        (r) =>
          r.id !== `public:${v.id}` &&
          (() => {
            const p = contentSchema.parse(r.value);
            return (
              p.slug === v.slug ||
              p.aliases.includes(v.slug) ||
              (v.kind === "EQUIPMENT" && p.equipmentId === v.equipmentId) ||
              (v.kind === "CATEGORY" &&
                p.kind === "CATEGORY" &&
                p.category === v.category)
            );
          })(),
      )
    )
      throw new HttpError(
        409,
        "Slug or inventory item already has website content",
      );
    const aliases = [
      ...new Set([
        ...(old?.aliases || []),
        ...(old && old.slug !== v.slug ? [old.slug] : []),
      ]),
    ].filter((s) => s !== v.slug);
    if (aliases.length > 100)
      throw new HttpError(
        400,
        "This page has reached its rename limit; retain its current slug.",
      );
    const data = { ...v, aliases };
    const saved = await tx.setting.upsert({
      where: { id: `public:${v.id}` },
      create: { id: `public:${v.id}`, value: data },
      update: { value: data },
    });
    await audit(tx, a, "EDIT_WEBSITE", "Setting", saved.id, {
      published: v.published,
      slug: v.slug,
    });
    return { ok: true };
  });
}
