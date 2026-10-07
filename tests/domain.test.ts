import "dotenv/config";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { db } from "../lib/db";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Actor } from "../lib/auth";
import {
  saveBooking,
  addPayment,
  bookingAction,
  saveEntity,
  snapshot,
  includeBooking,
} from "../lib/service";
import { previewImport, commitImport, rollbackImport } from "../lib/importer";
import {
  ledger,
  toPaise,
  rentalDays,
  safeCell,
  defaultSettings,
} from "../lib/domain";
import { documentPdf, exportSheet } from "../lib/documents";
import { decodeProductPhoto, MAX_PHOTO_BYTES } from "../lib/product-photo";
import {
  customerCatalogue,
  registerCustomer,
  submitCustomerRequest,
  customerRequests,
} from "../lib/customer-portal";
if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error("Tests require an isolated _test database");
const owner: Actor = {
    id: "test-owner",
    role: "ADMIN",
    name: "Test Owner",
    email: "owner@example.test",
  },
  staff: Actor = {
    id: "test-staff",
    role: "STAFF",
    name: "Staff",
    email: "staff@example.test",
  };
let customerId: string, equipmentId: string;
const pickup = "2026-11-10T10:00:00+05:30",
  returnAt = "2026-11-11T10:00:00+05:30";
const body = () => ({
  customerId,
  bookingDate: pickup,
  pickupAt: pickup,
  returnAt,
  status: "BOOKED",
  negotiated: true,
  total: 300000,
  items: [{ equipmentId, quantity: 1 }],
});
async function workbook() {
  const w = new ExcelJS.Workbook(),
    b = w.addWorksheet("Bookings"),
    i = w.addWorksheet("Rate Card");
  b.getCell("B5").value = new Date("2026-09-01T00:00:00Z");
  b.getCell("C5").value = "Fictional Import Customer";
  b.getCell("D5").value = "raw multiple numbers";
  b.getCell("E5").value = "Camera + lens";
  b.getCell("F5").value = "₹3,000/-";
  b.getCell("G5").value = 1500;
  b.getCell("K5").value = "Dropped";
  b.getCell("A6").value = { formula: '"BK-002"', result: "BK-002" };
  i.getCell("A5").value = "Unpriced Test Lens";
  i.getCell("B5").value = "LENS";
  i.getCell("C5").value = 2;
  i.getCell("D5").value = 20000;
  return Buffer.from(await w.xlsx.writeBuffer());
}
beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE "Payment","BookingItem","VendorPayment","Outsource","Booking","Asset","Equipment","Customer","Vendor","Audit","ImportBatch","Setting","User","LoginAttempt" RESTART IDENTITY CASCADE',
  );
  const c = await db.customer.create({ data: { name: "Test Customer" } });
  customerId = c.id;
  const e = await db.equipment.create({
    data: {
      name: "Test Camera",
      category: "CAMERA",
      rate: 100000,
      purchaseCost: 20000000,
      assets: { create: [{ purchaseCost: 20000000 }] },
    },
  });
  equipmentId = e.id;
  await db.setting.create({ data: { value: defaultSettings } });
});
after(() => db.$disconnect());
test("customer catalogue uses real capacity and excludes internal business records", async () => {
  let catalogue = await customerCatalogue(pickup, returnAt);
  const product = catalogue.items.find((e) => e.id === equipmentId)!;
  assert.equal(product.available, 1);
  assert.equal(catalogue.days, 1);
  assert.equal("purchaseCost" in product, false);
  assert.equal("assets" in product, false);
  assert.equal("notes" in product, false);
  await saveBooking(owner, body());
  catalogue = await customerCatalogue(pickup, returnAt);
  assert.equal(catalogue.items.find((e) => e.id === equipmentId)!.available, 0);
  assert.equal((await customerCatalogue()).items[0].available, null);
  await assert.rejects(
    customerCatalogue(returnAt, pickup),
    /future pickup and return/,
  );
});
test("customer signup cannot claim historical customers; requests are private, idempotent drafts", async () => {
  const email = "customer@example.test";
  await db.customer.update({ where: { id: customerId }, data: { email } });
  const account = await registerCustomer(
    {
      name: "New Customer",
      email,
      phone: "9000000000",
      password: "FictionalCustomerPassword42!",
    },
    "unit-test",
  );
  const saved = await db.customerAccount.findUniqueOrThrow({
    where: { id: account.id },
  });
  assert.notEqual(saved.customerId, customerId);
  const request = {
    from: pickup,
    to: returnAt,
    requestKey: "7d1f0afe-53bb-4f7d-bb8c-34e348758dd0",
    items: [{ equipmentId, quantity: 1 }],
    notes: "Wedding shoot",
  };
  const first = await submitCustomerRequest(account.id, request);
  assert.deepEqual(await submitCustomerRequest(account.id, request), first);
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: first.id },
    include: { items: true },
  });
  assert.equal(booking.status, "DRAFT");
  assert.equal(booking.total, 100000);
  assert.equal(booking.customerId, saved.customerId);
  assert.equal(
    (await customerCatalogue(pickup, returnAt)).items.find(
      (e) => e.id === equipmentId,
    )!.available,
    1,
  );
  assert.equal((await customerRequests(account.id)).length, 1);
  assert.equal((await customerRequests("another-account")).length, 0);
  assert.equal("notes" in (await customerRequests(account.id))[0], false);
  await saveBooking(
    owner,
    {
      ...body(),
      customerId: saved.customerId,
      status: "DRAFT",
      version: booking.version,
    },
    booking.id,
  );
  assert.equal((await customerRequests(account.id)).length, 1);
  const updated = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  await saveBooking(
    owner,
    { ...body(), status: "DRAFT", version: updated.version },
    booking.id,
  );
  assert.equal((await customerRequests(account.id)).length, 0);
  await saveBooking(owner, body());
  await assert.rejects(
    submitCustomerRequest(account.id, {
      ...request,
      requestKey: "971811a9-8843-4c0d-914e-d01d817d90d5",
    }),
    /Insufficient equipment/,
  );
});
test("customer requests keep unpriced totals unknown and reject invalid input", async () => {
  const account = await registerCustomer(
    {
      name: "Quote Customer",
      email: "quote@example.test",
      phone: "9000000000",
      password: "FictionalCustomerPassword42!",
    },
    "quote-test",
  );
  await db.equipment.update({
    where: { id: equipmentId },
    data: { rate: null },
  });
  const request = {
    from: pickup,
    to: returnAt,
    requestKey: "7d1f0afe-53bb-4f7d-bb8c-34e348758dd0",
    items: [{ equipmentId, quantity: 1 }],
  };
  const booking = await submitCustomerRequest(account.id, request);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).total,
    null,
  );
  await assert.rejects(
    submitCustomerRequest(account.id, {
      ...request,
      items: [request.items[0], request.items[0]],
    }),
    /Combine duplicate/,
  );
  await db.customerAccount.update({
    where: { id: account.id },
    data: { active: false },
  });
  await assert.rejects(
    submitCustomerRequest(account.id, request),
    /sign in again/,
  );
  await assert.rejects(
    registerCustomer(
      {
        name: "Bad",
        email: "bad@example.test",
        phone: "9000000000",
        password: "short",
      },
      "bad-test",
    ),
  );
});
test("product photos persist, stay out of snapshots, preserve on edit, replace and remove", async () => {
  const image = readFileSync(
    new URL("./fixtures/product.jpg", import.meta.url),
  );
  const photo = `data:image/jpeg;base64,${image.toString("base64")}`;
  const input = {
    id: equipmentId,
    name: "Test Camera",
    category: "CAMERA",
    quantity: 1,
    rate: 100000,
    purchaseCost: 20000000,
    photo,
  };
  await assert.rejects(
    saveEntity(staff, "inventory", input),
    /Owner permission required/,
  );
  await saveEntity(owner, "inventory", input);
  const stored = await db.equipmentPhoto.findUniqueOrThrow({
    where: { equipmentId },
  });
  assert.deepEqual(Buffer.from(stored.data), image);
  const snap = await snapshot(staff, "2026-11");
  const item = snap.inventory.find((e) => e.id === equipmentId)!;
  assert.ok(item.photo?.updatedAt);
  assert.equal("data" in item.photo!, false);
  const { photo: _, ...withoutPhoto } = input;
  await saveEntity(owner, "inventory", {
    ...withoutPhoto,
    notes: "Updated notes",
  });
  assert.equal(await db.equipmentPhoto.count(), 1);
  await assert.rejects(
    saveEntity(owner, "inventory", {
      ...input,
      name: "Should roll back",
      photo: "data:image/jpeg;base64,bm90IGEgcGhvdG8=",
    }),
    /Invalid JPEG/,
  );
  assert.equal(
    (await db.equipment.findUniqueOrThrow({ where: { id: equipmentId } })).name,
    "Test Camera",
  );
  await saveEntity(owner, "inventory", input);
  assert.deepEqual(
    Buffer.from(
      (await db.equipmentPhoto.findUniqueOrThrow({ where: { equipmentId } }))
        .data,
    ),
    image,
  );
  await saveEntity(owner, "inventory", { ...input, photo: null });
  assert.equal(await db.equipmentPhoto.count(), 0);
  await saveEntity(owner, "inventory", {
    ...withoutPhoto,
    id: undefined,
    name: "New photographed equipment",
    photo,
  });
  assert.equal(await db.equipmentPhoto.count(), 1);
});
test("photo uploads reject active content, oversized data, corrupt images and oversized dimensions", () => {
  const image = readFileSync(
    new URL("./fixtures/product.jpg", import.meta.url),
  );
  const encode = (bytes: Buffer) =>
    `data:image/jpeg;base64,${bytes.toString("base64")}`;
  assert.deepEqual(decodeProductPhoto(encode(image)), image);
  assert.throws(
    () => decodeProductPhoto("data:image/svg+xml;base64,PHN2Zz4="),
    /JPEG/,
  );
  assert.throws(
    () => decodeProductPhoto(encode(Buffer.alloc(MAX_PHOTO_BYTES + 1))),
    /at most 1 MB/,
  );
  assert.throws(
    () => decodeProductPhoto(encode(Buffer.from([255, 216, 255, 217]))),
    /Invalid JPEG/,
  );
  assert.throws(
    () => decodeProductPhoto(encode(image.subarray(0, image.length - 2))),
    /Invalid JPEG/,
  );
  const oversized = Buffer.from(image);
  const startOfFrame = oversized.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(startOfFrame >= 0);
  oversized.writeUInt16BE(2000, startOfFrame + 7);
  assert.throws(() => decodeProductPhoto(encode(oversized)), /1600 pixels/);
});
test("exact currency parsing and rental-day rules reject malformed amounts", () => {
  assert.equal(toPaise("Rs. 1,500/-"), 150000);
  assert.equal(toPaise("0.10"), 10);
  assert.equal(toPaise(null), null);
  assert.throws(() => toPaise("-10"));
  assert.throws(() => toPaise("5.001"));
  assert.equal(rentalDays(new Date(pickup), new Date(returnAt)), 1);
  assert.equal(rentalDays(new Date(pickup), new Date(returnAt), "CALENDAR"), 2);
  assert.equal(safeCell('=IMPORTXML("x")'), '\'=IMPORTXML("x")');
});
test("booking persists across a new database client with a stable number", async () => {
  const b = await saveBooking(owner, body());
  await db.$disconnect();
  const fresh = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  assert.equal(
    (await fresh.booking.findUniqueOrThrow({ where: { id: b.id } })).total,
    300000,
  );
  await fresh.$disconnect();
});
test("split UPI and cash payments derive balance and final collection status", async () => {
  const b = await saveBooking(staff, body());
  await addPayment(staff, b.id, {
    amount: 100000,
    mode: "UPI",
    paidAt: pickup,
  });
  await addPayment(staff, b.id, {
    amount: 50000,
    mode: "Cash",
    paidAt: pickup,
  });
  let result = await snapshot(owner, "2026-11");
  assert.equal(result.bookings[0].balance, 150000);
  assert.equal(result.metrics.unpaid, 1);
  await addPayment(staff, b.id, {
    amount: 150000,
    mode: "Bank",
    paidAt: pickup,
  });
  result = await snapshot(owner, "2026-11");
  assert.equal(result.bookings[0].paymentStatus, "Paid");
  assert.equal(result.metrics.unpaid, 0);
  assert.equal(result.metrics.collected, 300000);
});
test("concurrent reservations cannot exceed a single unit", async () => {
  const results = await Promise.allSettled([
    saveBooking(staff, body()),
    saveBooking(staff, body()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await db.booking.count(), 1);
});
test("disjoint existing bookings use peak overlap, not summed quantities", async () => {
  await saveBooking(owner, body());
  await saveBooking(owner, {
    ...body(),
    pickupAt: "2026-11-12T10:00:00+05:30",
    returnAt: "2026-11-13T10:00:00+05:30",
  });
  const e = await db.equipment.findUniqueOrThrow({
    where: { id: equipmentId },
  });
  await saveEntity(owner, "inventory", {
    id: e.id,
    name: e.name,
    category: e.category,
    quantity: 2,
    rate: e.rate,
    purchaseCost: e.purchaseCost,
  });
  await saveBooking(owner, {
    ...body(),
    returnAt: "2026-11-13T10:00:00+05:30",
  });
  assert.equal(await db.booking.count(), 3);
});
test("cancellation excludes revenue, preserves ledger, and releases gear", async () => {
  const b = await saveBooking(owner, body());
  await addPayment(staff, b.id, {
    amount: 100000,
    mode: "UPI",
    paidAt: pickup,
  });
  await bookingAction(owner, b.id, { action: "CANCEL" });
  const result = await snapshot(owner, "2026-11");
  assert.equal(result.metrics.revenue, 0);
  assert.equal(result.metrics.cashIn, 100000);
  assert.equal(result.bookings[0].paid, 100000);
  await saveBooking(staff, body());
});
test("staff cannot edit settings, retire gear, cancel bookings, or issue refunds", async () => {
  const b = await saveBooking(staff, body());
  await assert.rejects(
    () => saveEntity(staff, "settings", defaultSettings),
    /Owner permission/,
  );
  await assert.rejects(
    () =>
      saveEntity(staff, "inventory", {
        name: "x",
        category: "CAMERA",
        quantity: 1,
        rate: null,
        purchaseCost: 0,
      }),
    /Owner permission/,
  );
  await assert.rejects(
    () => bookingAction(staff, b.id, { action: "CANCEL" }),
    /Owner permission/,
  );
  await assert.rejects(
    () =>
      addPayment(staff, b.id, {
        amount: 100,
        mode: "Cash",
        paidAt: pickup,
        refund: true,
      }),
    /Owner permission/,
  );
});
test("pickup/partial return checklists release returned quantity, maintenance reduces fleet capacity", async () => {
  const e = await db.equipment.findUniqueOrThrow({
    where: { id: equipmentId },
  });
  await saveEntity(owner, "inventory", {
    id: e.id,
    name: e.name,
    category: e.category,
    quantity: 2,
    rate: e.rate,
    purchaseCost: e.purchaseCost,
  });
  const b = await saveBooking(owner, {
    ...body(),
    items: [{ equipmentId, quantity: 2 }],
  });
  await bookingAction(staff, b.id, {
    action: "PICKUP",
    condition: "Good",
    accessories: "2 caps",
  });
  await bookingAction(staff, b.id, {
    action: "RETURN",
    condition: "Good",
    items: [{ id: b.items[0].id, quantity: 1 }],
  });
  await saveBooking(staff, body());
  await assert.rejects(() => saveBooking(staff, body()), /availability/);
  await bookingAction(staff, b.id, {
    action: "RETURN",
    condition: "Good",
    items: [{ id: b.items[0].id, quantity: 1 }],
  });
  const assets = await db.asset.findMany({ where: { equipmentId } });
  await saveEntity(owner, "assets", {
    id: assets[0].id,
    status: "MAINTENANCE",
    condition: "Repair",
  });
  await assert.rejects(() => saveBooking(staff, body()), /availability/);
});
test("unreturned overdue gear blocks future bookings until checked in", async () => {
  const b = await saveBooking(owner, {
    ...body(),
    pickupAt: "2026-01-01T10:00:00+05:30",
    returnAt: "2026-01-02T10:00:00+05:30",
  });
  await db.booking.update({
    where: { id: b.id },
    data: {
      status: "PICKED_UP",
      actualPickupAt: new Date("2026-01-01T10:00:00+05:30"),
    },
  });
  await assert.rejects(() => saveBooking(staff, body()), /availability/);
  await bookingAction(staff, b.id, {
    action: "RETURN",
    condition: "Good",
    items: [{ id: b.items[0].id, quantity: 1 }],
  });
  await saveBooking(staff, body());
});
test("extension rechecks availability and preserves the agreed price", async () => {
  const b = await saveBooking(owner, body());
  await saveBooking(owner, {
    ...body(),
    pickupAt: "2026-11-12T10:00:00+05:30",
    returnAt: "2026-11-13T10:00:00+05:30",
  });
  await assert.rejects(
    () =>
      bookingAction(staff, b.id, {
        action: "EXTEND",
        returnAt: "2026-11-13T10:00:00+05:30",
      }),
    /availability/,
  );
  await bookingAction(staff, b.id, {
    action: "EXTEND",
    returnAt: "2026-11-12T10:00:00+05:30",
  });
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: b.id } })).total,
    300000,
  );
});
test("overpayment needs owner review; deposits and refunds remain separate", async () => {
  const b = await saveBooking(owner, body());
  await assert.rejects(
    () =>
      addPayment(staff, b.id, { amount: 400000, mode: "UPI", paidAt: pickup }),
    /exceeds/,
  );
  await addPayment(owner, b.id, {
    amount: 400000,
    mode: "UPI",
    paidAt: pickup,
    reviewedCredit: true,
    notes: "Reviewed customer credit",
  });
  await addPayment(staff, b.id, {
    amount: 500000,
    kind: "DEPOSIT",
    mode: "Cash",
    paidAt: pickup,
  });
  await addPayment(owner, b.id, {
    amount: 100000,
    mode: "UPI",
    paidAt: pickup,
    refund: true,
  });
  const result = await snapshot(owner, "2026-11");
  assert.equal(result.bookings[0].paid, 300000);
  assert.equal(result.bookings[0].deposit, 500000);
  assert.equal(result.metrics.collected, 300000);
  await assert.rejects(
    () =>
      addPayment(owner, b.id, {
        amount: 600000,
        kind: "DEPOSIT",
        mode: "Cash",
        paidAt: pickup,
        refund: true,
      }),
    /exceeds funds/,
  );
});
test("payment correction is immutable and audited", async () => {
  const b = await saveBooking(owner, body());
  const original = await addPayment(staff, b.id, {
    amount: 100000,
    mode: "UPI",
    paidAt: pickup,
  });
  await addPayment(owner, b.id, {
    amount: 50000,
    mode: "Cash",
    paidAt: pickup,
    correctId: original.id,
    notes: "Corrected mistaken amount",
  });
  const result = await db.booking.findUniqueOrThrow({
    where: { id: b.id },
    include: includeBooking,
  });
  assert.equal(result.payments.length, 3);
  assert.equal(ledger(result.payments, result.total).paid, 50000);
  assert.equal(
    await db.audit.count({ where: { action: "CORRECT_PAYMENT" } }),
    1,
  );
  await assert.rejects(
    () =>
      addPayment(owner, b.id, {
        amount: 50000,
        mode: "Cash",
        paidAt: pickup,
        correctId: original.id,
        notes: "Again",
      }),
    /already corrected/,
  );
});
test("workbook preview ignores formula-only rows, imports null rates and unknown payment dates, and prevents re-import", async () => {
  const buffer = await workbook(),
    p = await previewImport(buffer, "fictional.xlsx");
  assert.equal(p.bookings.length, 1);
  assert.equal(p.inventory.length, 1);
  assert.equal(p.inventory[0].rate, null);
  assert.equal(p.bookings[0].status, "RETURNED");
  const imported = await commitImport(owner, buffer, "fictional.xlsx", [5]);
  const result = await snapshot(owner, "2026-09");
  assert.equal(result.metrics.revenue, 300000);
  assert.equal(result.metrics.collected, 150000);
  assert.equal(result.metrics.cashIn, 0);
  assert.equal(result.metrics.unknownPaymentDates, 1);
  assert.equal(result.bookings[0].pickupAt, null);
  assert.equal(result.bookings[0].historical, true);
  await assert.rejects(
    () => commitImport(owner, buffer, "fictional.xlsx", [5]),
    /already been imported/,
  );
  await rollbackImport(owner, imported.id);
  assert.equal(await db.booking.count(), 0);
  assert.equal(await db.equipment.count(), 1);
  await assert.rejects(
    () => commitImport(owner, buffer, "fictional.xlsx", [5]),
    /already been imported/,
  );
});
test("rollback refuses to destroy later payment changes", async () => {
  const buffer = await workbook(),
    imported = await commitImport(owner, buffer, "fictional.xlsx", [5]);
  const b = await db.booking.findFirstOrThrow();
  await addPayment(staff, b.id, { amount: 10000, mode: "UPI", paidAt: pickup });
  await assert.rejects(() => rollbackImport(owner, imported.id), /later work/);
  assert.equal(await db.booking.count(), 1);
});
test("invalid amounts or formulas in source inputs are preview errors", async () => {
  const buffer = await workbook(),
    w = new ExcelJS.Workbook();
  await w.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  w.getWorksheet("Bookings")!.getCell("F5").value = {
    formula: "1+2",
    result: 3,
  };
  const p = await previewImport(
    Buffer.from(await w.xlsx.writeBuffer()),
    "bad.xlsx",
  );
  assert.ok(p.bookings[0].errors.some((e) => e.includes("Formula")));
  await assert.rejects(
    () =>
      commitImport(owner, Buffer.from(buffer), "good.xlsx", [5], { date: 6 }),
    /source errors/,
  );
});
test("new bookings require pricing, missing total stays No amount, and pickup requires a checklist", async () => {
  const d = await saveBooking(staff, { status: "DRAFT" });
  assert.equal(d.paymentStatus, "No amount");
  await assert.rejects(
    () => saveBooking(staff, { status: "BOOKED" }),
    /required/,
  );
  await assert.rejects(
    () => saveBooking(staff, { ...body(), status: "PICKED_UP" }),
    /checklist/,
  );
});
test("database constraints reject invalid quantities outside the service", async () => {
  const b = await saveBooking(owner, body());
  await assert.rejects(() =>
    db.bookingItem.update({
      where: { id: b.items[0].id },
      data: { returned: 2 },
    }),
  );
});
test("exports escape formula injection and PDF documents contain real booking records", async () => {
  await db.customer.update({
    where: { id: customerId },
    data: { name: '=HYPERLINK("bad")' },
  });
  const b = await saveBooking(owner, body());
  const p = await addPayment(staff, b.id, {
    amount: 10000,
    mode: "Cash",
    paidAt: pickup,
  });
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(
    (await exportSheet("bookings", "xlsx")) as unknown as ExcelJS.Buffer,
  );
  assert.ok(String(w.worksheets[0].getCell("C2").value).startsWith("'="));
  for (const kind of ["summary", "quotation", "invoice", "receipt"]) {
    const pdf = await documentPdf(b.id, kind, p.id);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 1000);
  }
});

test("corrected payments restate cash flow without inventing refund movements", async () => {
  const b = await saveBooking(owner, body());
  const p = await addPayment(owner, b.id, {
    amount: 100000,
    mode: "UPI",
    paidAt: pickup,
  });
  await addPayment(owner, b.id, {
    amount: 50000,
    mode: "Cash",
    paidAt: pickup,
    correctId: p.id,
    notes: "Correcting data entry",
  });
  const result = await snapshot(owner, "2026-11");
  assert.equal(result.metrics.cashIn, 50000);
  assert.equal(result.metrics.cashRefunds, 0);
});
test("historical returned bookings can be corrected without inventing reservations", async () => {
  const buffer = await workbook();
  await commitImport(owner, buffer, "fictional.xlsx", [5]);
  const b = await db.booking.findFirstOrThrow();
  const updated = await saveBooking(
    owner,
    {
      customerId: b.customerId,
      status: "RETURNED",
      negotiated: true,
      total: 350000,
      notes: "Reviewed historical price",
      version: b.version,
    },
    b.id,
  );
  assert.equal(updated.historical, true);
  assert.equal(updated.pickupAt, null);
  assert.equal(updated.total, 350000);
  assert.equal(updated.status, "RETURNED");
});
test("turnaround buffer applies after actual check-in", async () => {
  await db.setting.update({
    where: { id: "business" },
    data: { value: { ...defaultSettings, turnaroundMinutes: 60 } },
  });
  const b = await saveBooking(owner, body());
  await bookingAction(staff, b.id, { action: "PICKUP", condition: "Good" });
  await bookingAction(staff, b.id, {
    action: "RETURN",
    condition: "Good",
    items: [{ id: b.items[0].id, quantity: 1 }],
  });
  const inTen = new Date(Date.now() + 10 * 60000).toISOString(),
    tomorrow = new Date(Date.now() + 86400000).toISOString();
  await assert.rejects(
    () =>
      saveBooking(staff, { ...body(), pickupAt: inTen, returnAt: tomorrow }),
    /availability/,
  );
  await saveBooking(staff, {
    ...body(),
    pickupAt: new Date(Date.now() + 120 * 60000).toISOString(),
    returnAt: tomorrow,
  });
});
