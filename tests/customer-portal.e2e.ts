import { test, expect } from "@playwright/test";
test("customers check live dates, register, send a private draft and cannot access staff APIs", async ({
  page,
  browser,
}) => {
  await page.goto("/rentals");
  await expect(
    page.getByRole("heading", { name: "Your vision. Our gear." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add SONY A7M4", exact: true }),
  ).toBeDisabled();
  const tomorrow = new Date(Date.now() + 30 * 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" },
  );
  const after = new Date(Date.now() + 31 * 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" },
  );
  await page.getByLabel("Pickup (IST)").fill(`${tomorrow}T10:00`);
  await page.getByLabel("Return (IST)").fill(`${after}T10:00`);
  await page.getByRole("button", { name: "Check availability" }).click();
  await expect(
    page.getByRole("button", { name: "Add SONY A7M4", exact: true }),
  ).toBeEnabled();
  const catalogue = await (
    await page.request.get(
      `/api/customer/catalogue?from=${encodeURIComponent(tomorrow + "T10:00:00+05:30")}&to=${encodeURIComponent(after + "T10:00:00+05:30")}`,
    )
  ).json();
  expect(catalogue.items[0]).not.toHaveProperty("purchaseCost");
  expect(catalogue.items[0]).not.toHaveProperty("assets");
  await page
    .getByRole("button", { name: "Add SONY A7M4", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Sign in to send your request" })
    .click();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  const email = `portal-${Date.now()}@example.test`;
  await page.getByLabel("Full name").fill("Fictional Portal Customer");
  await page.getByLabel("Phone or WhatsApp").fill("9000000000");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("FictionalCustomerPassword42!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/rentals$/);
  await page.getByRole("button", { name: "Check availability" }).click();
  await expect(
    page.getByRole("button", { name: "Send rental request", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("What are you shooting? (optional)")
    .fill("Fictional acceptance request");
  await page
    .getByRole("button", { name: "Send rental request", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("sent");
  await expect(page.locator(".portal-my-requests")).toContainText(
    "Awaiting confirmation",
  );
  const ownRequests = await (await page.request.get("/api/customer/me")).json();
  const requestId = ownRequests.requests[0].id;
  const ownerContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto("/login");
    await ownerPage
      .getByLabel("Email address")
      .fill(process.env.SEED_ADMIN_EMAIL!);
    await ownerPage
      .getByLabel("Password", { exact: true })
      .fill(process.env.SEED_ADMIN_PASSWORD!);
    await ownerPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      ownerPage.getByRole("heading", { name: "Your business, in focus." }),
    ).toBeVisible();
    const snapshot = await (
      await ownerPage.request.get("/api/snapshot?month=2026-10")
    ).json();
    const draft = snapshot.bookings.find(
      (b: { id: number }) => b.id === requestId,
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.notes).toContain("Customer portal request");
    const confirm = await ownerPage.request.post(`/api/bookings/${requestId}`, {
      headers: { Origin: new URL(process.env.NEXTAUTH_URL!).origin },
      data: {
        customerId: draft.customerId,
        version: draft.version,
        pickupAt: draft.pickupAt,
        returnAt: draft.returnAt,
        status: "BOOKED",
        items: draft.items.map(
          (i: { equipmentId: string; quantity: number; rate: number }) => ({
            equipmentId: i.equipmentId,
            quantity: i.quantity,
            rate: i.rate,
          }),
        ),
        notes: draft.notes,
      },
    });
    expect(confirm.status()).toBe(200);
    expect((await ownerPage.request.get("/api/customer/me")).status()).toBe(
      401,
    );
  } finally {
    await ownerContext.close();
  }
  await page.reload();
  await expect(page.locator(".portal-my-requests")).toContainText("BOOKED");
  expect((await page.request.get("/api/snapshot?month=2026-10")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.post("/api/settings", {
        headers: { Origin: new URL(process.env.NEXTAUTH_URL!).origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/customer/requests", {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const context = await browser.newContext();
  try {
    expect(
      (
        await context.request.get(
          new URL("/api/customer/me", process.env.NEXTAUTH_URL!).toString(),
        )
      ).status(),
    ).toBe(401);
    const otherPage = await context.newPage();
    await otherPage.goto("/customer/login");
    await otherPage
      .getByRole("button", { name: "New here? Create an account" })
      .click();
    await otherPage.getByLabel("Full name").fill("Other Fictional Customer");
    await otherPage.getByLabel("Phone or WhatsApp").fill("9000000001");
    await otherPage
      .getByLabel("Email address")
      .fill(`other-${Date.now()}@example.test`);
    await otherPage
      .getByLabel("Password", { exact: true })
      .fill("FictionalCustomerPassword42!");
    await otherPage
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(otherPage).toHaveURL(/\/rentals$/);
    await expect(otherPage.locator(".portal-my-requests")).toContainText(
      "Your rental requests will appear here",
    );
  } finally {
    await context.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/camnova-customer-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/camnova-customer-desktop.png",
    fullPage: true,
  });
});
