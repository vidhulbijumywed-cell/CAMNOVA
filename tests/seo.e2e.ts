import { test, expect } from "@playwright/test";
const origin = process.env.PUBLIC_SITE_URL || "https://camnova.onrender.com";
test("public SEO pages return crawlable HTML, canonical metadata, accurate rental schema and controlled sitemap", async ({
  page,
  request,
  browser,
}) => {
  const response = await request.get("/rentals");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("Rental equipment");
  expect(html).toContain("/rentals/");
  expect(html).not.toContain('name="robots" content="noindex');
  const catalogue = await (await request.get("/api/customer/catalogue")).json();
  const e = catalogue.items[0];
  expect(e).toBeTruthy();
  await page.goto("/rentals");
  await expect(page.getByRole("link",{name:"CAMNOVA Rentals home",exact:true})).toHaveCount(1);
  await expect(page.locator(".seo-nav")).toHaveCount(0);
  const link = page
    .locator(".seo-card h3 a")
    .filter({ hasText: e.name })
    .first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/rentals\//);
  const detail = await request.get(href!);
  expect(detail.status()).toBe(200);
  const text = await detail.text();
  expect(text).toContain(e.name);
  expect(text).not.toContain("purchaseCost");
  await page.goto(href!);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).not.toContainText(/kochi/i);
  await expect(page).not.toHaveTitle(/kochi/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    origin + href,
  );
  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const parsed = schemas.map((s) => JSON.parse(s));
  expect(parsed.some((s) => s["@type"] === "BreadcrumbList")).toBeTruthy();
  expect(parsed.some((s) => s["@type"] === "Service")).toBeTruthy();
  expect(text).not.toContain('"availability":"https://schema.org/InStock"');
  await page
    .getByRole("link", { name: "Check availability and request this item" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(e.name);
  await page.getByRole("button", { name: "Close · keep browsing" }).click();
  await page.goto("/rentals?sort=name");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    origin + "/rentals",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(origin + href);
  for (const excluded of [
    "/workspace",
    "/login",
    "/customer/",
    "/studios/",
    "/podcast-studio-kochi",
    "?sort=",
  ])
    expect(sitemap).not.toContain(excluded);
  const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  for (const url of paths) {
    const target = new URL(url);
    const r = await request.get(target.pathname + target.search);
    expect(r.status(), url).toBe(200);
  }
  expect((await request.get("/rentals/not-a-real-item")).status()).toBe(404);
  expect((await request.get("/studio-rental-kochi")).status()).toBe(404);
  expect((await request.get("/random-missing-page")).status()).toBe(404);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(origin + "/sitemap.xml");
  expect(robots).not.toContain("Disallow: /workspace");
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  try {
    const p = await noJS.newPage();
    await p.goto(href!);
    await expect(p.locator("h1")).toContainText(e.name);
    await expect(
      p.getByRole("link", { name: "Check availability and request this item" }),
    ).toBeVisible();
  } finally {
    await noJS.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(href!);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
});
test("public content editing is authorized on the server", async ({
  request,
}) => {
  expect((await request.get("/api/site-content")).status()).toBe(401);
  expect((await request.post("/api/site-content", { data: {} })).status()).toBe(
    401,
  );
});

test("owners edit public content and renamed guides redirect directly while drafts stay hidden", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your business, in focus." }),
  ).toBeVisible();
  const id = `seo-test-${Date.now()}`;
  const data = {
    id,
    kind: "GUIDE",
    slug: id,
    title: "Fictional SEO integration guide",
    description: "Integration fixture",
    body: "Verified fixture content for redirect testing.",
    published: true,
  };
  const headers = { Origin: new URL(process.env.NEXTAUTH_URL!).origin };
  const save = async (payload: unknown) => {
    const r = await page.request.post("/api/site-content", {
      headers,
      data: payload,
    });
    expect(r.status(), await r.text()).toBe(200);
  };
  try {
    await save(data);
    expect((await request.get(`/guides/${id}`)).status()).toBe(200);
    await save({ ...data, slug: `${id}-updated` });
    const redirect = await request.get(`/guides/${id}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe(`/guides/${id}-updated`);
    await page.goto("/workspace/content");
    await expect(
      page.getByRole("heading", { name: "Public website content" }),
    ).toBeVisible();
    const invalid = await page.request.post("/api/site-content", {
      headers,
      data: {
        id: `${id}-studio`,
        kind: "STUDIO",
        slug: `${id}-studio`,
        title: "Unverified space",
        published: true,
      },
    });
    expect(invalid.status()).toBe(400);
  } finally {
    await save({ ...data, slug: `${id}-updated`, published: false });
  }
  expect((await request.get(`/guides/${id}-updated`)).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(id);
});
