import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, staff = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email address")
    .fill(process.env[staff ? "SEED_STAFF_EMAIL" : "SEED_ADMIN_EMAIL"]!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env[staff ? "SEED_STAFF_PASSWORD" : "SEED_ADMIN_PASSWORD"]!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your business, in focus." }),
  ).toBeVisible();
}
test("unauthenticated API is protected and login page renders", async ({
  page,
  request,
}) => {
  const r = await request.get("/api/snapshot?month=2026-10");
  expect(r.status()).toBe(401);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your next shoot starts here." }),
  ).toBeVisible();
});
test("owner books gear, collects split payments, downloads documents, and cancels without losing the ledger", async ({
  page,
}) => {
  await login(page);
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const name = `UI Test Studio ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Phone numbers (comma separated)").fill("9000000000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Bookings", exact: true }).click();
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: name });
  await page.getByLabel("Order status").selectOption("BOOKED");
  await page
    .getByLabel("Pickup (IST)", { exact: true })
    .fill("2027-12-10T10:00");
  await page.getByLabel("Expected return (IST)").fill("2027-12-11T10:00");
  await page
    .getByRole("button", { name: "Add equipment", exact: true })
    .click();
  await page
    .getByLabel("Equipment 1", { exact: true })
    .selectOption({ label: "SONY A7M4" });
  await page.getByLabel("Use an explicitly negotiated total").check();
  await page.getByLabel("Negotiated total (₹)").fill("3000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: name });
  const reference = (await row.locator(".text-link").textContent())!;
  async function pay(amount: string, mode: string) {
    await row.locator(".text-link").click();
    await page
      .getByRole("button", { name: "Record payment / deposit" })
      .click();
    await page.getByLabel("Amount (₹)", { exact: true }).fill(amount);
    await page.getByLabel("Payment mode", { exact: true }).selectOption(mode);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await pay("1000", "UPI");
  await pay("500", "Cash");
  await expect(row).toContainText("₹1,500.00 due");
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "₹1,500.00",
  );
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Payment", exact: true })
    .click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("1500");
  await page.getByLabel("Payment mode", { exact: true }).selectOption("Bank");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await page.getByRole("button", { name: "Bookings", exact: true }).click();
  await page.getByRole("button", { name: reference, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("₹3,000.00");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Invoice", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/camnova/);
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("Cancelled");
  await expect(row).toContainText("Paid");
  expect(failures).toEqual([]);
});
test("mobile navigation, booking draft, and collections remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({ path: "/tmp/camnova-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Collections", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search collections" }),
  ).toBeVisible();
});
test("staff is denied admin mutation, unknown origins are rejected, and logout clears access", async ({
  page,
}) => {
  await login(page, true);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Business settings are managed by the workspace owner.",
    }),
  ).toBeVisible();
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return r.status;
  });
  expect(status).toBe(403);
  const response = await page.request.post("/api/settings", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/snapshot?month=2026-10")).status()).toBe(
    401,
  );
});
test("desktop dashboard, inventory, calendar, reports and settings have functional views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.screenshot({ path: "/tmp/camnova-desktop.png", fullPage: true });
  for (const label of [
    "Inventory",
    "Calendar",
    "Reports",
    "Vendors",
    "Settings",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("button", { name: /CANON R6III/ })).toContainText(
    "Rate not set",
  );
});

test("disabling and re-enabling an account revokes its existing session", async ({
  page,
  browser,
}) => {
  await login(page, true);
  const ctx = await browser.newContext();
  const ownerPage = await ctx.newPage();
  await login(ownerPage);
  const origin = new URL(process.env.NEXTAUTH_URL!).origin;
  const snapshot = await (
    await ownerPage.request.get("/api/snapshot?month=2026-10")
  ).json();
  const user = snapshot.users.find(
    (u: { email: string }) => u.email === process.env.SEED_STAFF_EMAIL,
  );
  try {
    expect(
      (
        await ownerPage.request.post("/api/users", {
          headers: { Origin: origin },
          data: { ...user, active: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await page.request.get("/api/snapshot?month=2026-10")).status(),
    ).toBe(401);
    expect(
      (
        await ownerPage.request.post("/api/users", {
          headers: { Origin: origin },
          data: { ...user, active: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await page.request.get("/api/snapshot?month=2026-10")).status(),
    ).toBe(401);
    await login(page, true);
  } finally {
    await ownerPage.request.post("/api/users", {
      headers: { Origin: origin },
      data: { ...user, active: true },
    });
    await ctx.close();
  }
});
