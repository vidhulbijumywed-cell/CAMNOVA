import { test, expect } from "@playwright/test";
test("public landing page introduces CAMNOVA and leads visitors into the rental store", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "THE COMPLETE",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  for (const link of await page.getByRole("link", { name: "Book now" }).all())
    await expect(link).toHaveAttribute("href", "/rentals");
  await expect(
    page.getByRole("link", { name: "@camnovarentals" }),
  ).toHaveAttribute("href", "https://www.instagram.com/camnovarentals/");
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/camnova-landing-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/camnova-landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Book now" }).first().click();
  await expect(page).toHaveURL(/\/rentals$/);
  await expect(
    page.getByRole("heading", { name: "Your vision. Our gear." }),
  ).toBeVisible();
});
