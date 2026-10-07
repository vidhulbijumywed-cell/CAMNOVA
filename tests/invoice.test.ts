import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { invoicePdf } from "../lib/invoice";
import { defaultSettings } from "../lib/domain";
import { execFileSync } from "node:child_process";

const booking = {
  id: 42,
  pickupAt: new Date("2026-10-07T04:30:00Z"),
  returnAt: new Date("2026-10-09T04:30:00Z"),
  dueAt: null,
  total: 180000,
  discount: 20000,
  notes: "Handle equipment with care.",
  equipmentText: "",
  customer: { name: "Sample Customer", phones: ["9876543210"], rawPhone: "" },
  items: [
    {
      equipment: { name: "Sony FX3 camera" },
      quantity: 1,
      days: 2,
      rate: 100000,
    },
  ],
  payments: [
    { amount: 50000, kind: "RENTAL", mode: "UPI", reference: "SAMPLE-PAYMENT" },
    { amount: 100000, kind: "DEPOSIT", mode: "Cash", reference: "" },
  ],
};
const text = (pdf: Buffer) =>
  execFileSync("pdftotext", ["-", "-"], { input: pdf }).toString();
test("invoice uses the supplied format and keeps deposits separate from rental balance", async () => {
  const pdf = await invoicePdf(booking, defaultSettings);
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getForm().getFields().length, 0);
  const content = text(pdf);
  for (const value of [
    "CN-000042",
    "Sample Customer",
    "Sony FX3 camera",
    "1,800.00",
    "500.00",
    "1,300.00",
    "Refundable deposit held separately: 1,000.00 INR.",
  ])
    assert.ok(content.includes(value), value);
  assert.ok(!content.includes("Enter totals manually"));
});
test("equipment continues across pages without losing long notes or changing agreed prices", async () => {
  const items = Array.from({ length: 8 }, (_, n) => ({
    ...booking.items[0],
    equipment: { name: `Camera ${n + 1}` },
  }));
  const pdf = await invoicePdf(
    {
      ...booking,
      items,
      notes: "Long rental terms ".repeat(100) + "END OF TERMS",
    },
    defaultSettings,
  );
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() >= 3);
  const content = text(pdf);
  assert.ok(content.includes("Camera 8"));
  assert.ok(content.includes("END OF TERMS"));
  assert.ok(content.includes("Agreed pricing adjustment"));
  assert.ok(content.includes("1,300.00"));
});
test("unknown booking totals are not converted into a zero balance", async () => {
  const content = text(
    await invoicePdf(
      { ...booking, total: null, items: [], payments: [], notes: "" },
      defaultSettings,
    ),
  );
  assert.ok(content.includes("Not set"));
});
