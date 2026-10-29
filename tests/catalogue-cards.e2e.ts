import { test, expect } from "@playwright/test";
test("category cards match the main catalogue and carry an item into the rental cart", async ({
  page,
}) => {
  await page.goto("/rentals");
  const original = page.locator("#catalogue .portal-product").first();
  await expect(original).toBeVisible();
  const style = await original.evaluate((e) => {
    const c = getComputedStyle(e);
    const image = getComputedStyle(e.querySelector(".portal-product-image")!);
    return {
      background: c.backgroundColor,
      borderRadius: c.borderRadius,
      padding: c.padding,
      imageHeight: image.height,
    };
  });
  await page.goto("/lens-rental-kochi");
  const card = page.locator(".catalogue-cards .portal-product").first();
  await expect(card).toBeVisible();
  expect(
    await card.evaluate((e) => {
      const c = getComputedStyle(e);
      const image = getComputedStyle(e.querySelector(".portal-product-image")!);
      return {
        background: c.backgroundColor,
        borderRadius: c.borderRadius,
        padding: c.padding,
        imageHeight: image.height,
      };
    }),
  ).toEqual(style);
  await expect(card.locator(".portal-product-image")).toHaveCount(1);
  await expect(card.locator(".portal-product-image>span")).toHaveText("Lenses");
  const name = await card.locator("h3").innerText();
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
  }
  await card.getByRole("link", { name: `Add ${name}`, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your rental request" }),
  ).toContainText(name);
  await expect(
    page.getByRole("button", { name: "Send rental request", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close · keep browsing" }).click();
  await expect(
    page.getByRole("button", { name: "Check availability", exact: true }),
  ).toBeVisible();
});
