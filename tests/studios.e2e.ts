import { test, expect } from "@playwright/test";
test("studio section is responsive, accessible and sends the selected package enquiry to WhatsApp", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.open = (url?: string | URL) => {
      (window as unknown as { studioOpened: string }).studioOpened =
        String(url);
      return null;
    };
  });
  await page.goto("/");
  await page
    .getByRole("link", { name: "Explore our studios", exact: true })
    .click();
  await expect(page).toHaveURL(/#studios$/);
  const section = page.locator("#studios");
  await expect(
    section.getByRole("heading", { name: "Come rent and shoot", exact: true }),
  ).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "Camnova Studio, Thammanam" }),
  ).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "Camnova Studio, Vennala" }),
  ).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    await page.screenshot({
      path: `/tmp/camnova-studios-${width}.png`,
      fullPage: true,
    });
  }
  const thumb = section.getByRole("button", {
    name: "Show Thammanam podcast room",
    exact: true,
  });
  await thumb.focus();
  await page.keyboard.press("Enter");
  await expect(thumb).toHaveAttribute("aria-pressed", "true");
  await expect(
    section.locator("#studio-thammanam .studio-hero-image"),
  ).toHaveAttribute("src", /thammanam-podcast-room.jpg$/);
  await section
    .getByRole("button", { name: "Ask about this package", exact: true })
    .nth(1)
    .click();
  const dialog = page.getByRole("dialog", { name: "Request a studio booking" });
  await expect(
    dialog.getByRole("combobox", { name: "Podcast package", exact: true }),
  ).toHaveValue("pkg-2");
  await dialog.getByRole("button", { name: "Continue to WhatsApp" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("Fictional Studio Customer");
  await dialog.getByLabel("Phone or WhatsApp").fill("9000000000");
  await dialog
    .getByRole("combobox", { name: "Studio", exact: true })
    .selectOption("vennala");
  await dialog.getByLabel("Preferred date").fill(
    new Date(Date.now() + 86400000 * 2).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    }),
  );
  await dialog.getByLabel("Preferred time (IST)").fill("10:30");
  await dialog.getByLabel("Number of people").fill("3");
  await dialog.getByLabel("Do you need gear from us?").selectOption("yes");
  await dialog.getByLabel("Notes").fill("Fictional podcast enquiry & editing");
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/studio-test-request", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true}',
    });
  });
  await page.evaluate(() => {
    window.CAMNOVA_REQUEST_URL = "/api/studio-test-request";
  });
  await dialog.getByRole("button", { name: "Continue to WhatsApp" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Tap Send in WhatsApp",
  );
  await expect.poll(() => posted?.studio).toBe("Vennala");
  expect(posted?.package).toBe("Podcast package 2");
  const opened = await page.evaluate(
    () => (window as unknown as { studioOpened: string }).studioOpened,
  );
  const url = new URL(opened);
  expect(url.hostname).toBe("wa.me");
  expect(url.pathname).toBe("/917736655080");
  const message = url.searchParams.get("text")!;
  expect(message).toContain("book the Vennala studio for Podcast package");
  expect(message).toContain("Podcast package: Podcast package 2");
  expect(message).toContain("I need gear: yes");
  expect(message).toContain("Phone: 9000000000");
  expect(message).toContain("Fictional podcast enquiry & editing");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    section.getByRole("link", { name: "Explore the gear" }),
  ).toHaveAttribute("href", "#catalogue");
  await page.goto("/studios");
  await expect(page.locator("h1")).toHaveText("Studio bookings");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://camnova.onrender.com/studios",
  );
  const data = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const graph = data.map((x) => JSON.parse(x)).find((x) => x["@graph"]);
  expect(graph["@graph"]).toHaveLength(2);
  await expect(page.locator("#studios")).not.toContainText("₹");
});
