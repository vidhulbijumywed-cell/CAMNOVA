import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "./db";
import { includeBooking, settings, snapshot } from "./service";
import { bookingNumber, money, ledger, safeCell } from "./domain";
import { HttpError } from "./auth";
import { invoicePdf } from "./invoice";
export async function exportSheet(
  kind: string,
  format: string,
  report?: Awaited<ReturnType<typeof snapshot>>,
) {
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet("CAMNOVA");
  if (kind === "reports" && report) {
    const m = report.metrics;
    s.addRow(["CAMNOVA monthly report", report.month, "Asia/Kolkata"]);
    s.addRow(["Metric", "Value", "Basis / units"]);
    const rows: [string, number | string | null, string][] = [
      ["Bookings", m.bookings, "Booking date; excludes cancelled and drafts"],
      ["Cancelled bookings", m.cancelled, "Booking date"],
      ["Booked revenue", m.revenue / 100, "INR; booking date"],
      [
        "Collected against bookings",
        m.collected / 100,
        "INR; booking-date cohort",
      ],
      ["Outstanding", m.outstanding / 100, "INR; booking-date cohort"],
      ["Collection rate", m.collectionRate, "Fraction"],
      [
        "Agreed outsource costs",
        m.outsourceCost / 100,
        "INR; booking date; includes cancellations",
      ],
      [
        "Revenue after outsourcing",
        m.afterOutsourcing / 100,
        "INR; excludes other business expenses",
      ],
      ["Average priced booking", m.average / 100, "INR"],
      ["Unpaid bookings", m.unpaid, "Count"],
      ["Missing amount", m.missingAmount, "Count"],
      ["Records needing attention", m.attention, "All months"],
      ["Inventory investment", m.investment / 100, "INR"],
      ["Priced daily capacity", m.maxDaily / 100, "INR"],
      ["Priced monthly capacity", m.maxMonthly / 100, "INR"],
      [
        "Revenue-capacity ratio",
        m.capacityRatio,
        "Fraction; not actual utilization",
      ],
      ["Illustrative gross payback months", m.payback, "Months; gross revenue"],
      ["Unpriced models", m.unpriced, "Count; excluded from priced capacity"],
      ["Rental cash inflows", m.cashIn / 100, "INR; actual payment date"],
      ["Rental refunds", m.cashRefunds / 100, "INR; actual refund date"],
      ["Vendor payments", m.vendorPaid / 100, "INR; actual payment date"],
      ["Deposit movement", m.depositMovement / 100, "INR; actual payment date"],
      [
        "Unknown payment dates",
        m.unknownPaymentDates,
        "All months; excluded from dated cash flow",
      ],
    ];
    for (const [label, value, basis] of rows)
      s.addRow([label, value ?? "Unavailable", basis]);
    s.addRow([]);
    s.addRow(["Weekday", "Bookings", "Revenue INR"]);
    for (const day of m.weekday)
      s.addRow([day.day, day.bookings, day.revenue / 100]);
    s.addRow([]);
    s.addRow(["Payment mode", "Ledger entries", "Net amount INR"]);
    for (const mode of m.modes)
      s.addRow([mode.mode, mode.count, mode.amount / 100]);
    s.addRow([]);
    s.addRow(["Equipment", "Occupied unit-days", "Nominal capacity unit-days"]);
    for (const e of m.utilization)
      s.addRow([safeCell(e.name), e.occupiedUnitDays, e.capacityUnitDays]);
  } else if (kind === "inventory") {
    s.addRow([
      "Item",
      "Category",
      "Units",
      "Purchase cost (INR)",
      "Daily rent (INR)",
    ]);
    for (const e of await db.equipment.findMany({ include: { assets: true } }))
      s.addRow([
        safeCell(e.name),
        safeCell(e.category),
        e.assets.length,
        e.purchaseCost / 100,
        e.rate === null ? "Not set" : e.rate / 100,
      ]);
  } else if (kind === "reports") {
    s.addRow([
      "Booking",
      "Date",
      "Status",
      "Total INR",
      "Collected INR",
      "Outsource cost INR",
      "Revenue after outsourcing INR",
    ]);
    for (const b of await db.booking.findMany({
      where: { status: { not: "DELETED" } },
      include: includeBooking,
    })) {
      const l = ledger(b.payments, b.total),
        cost = b.outsourced.reduce((n, o) => n + o.cost, 0);
      s.addRow([
        bookingNumber(b.id),
        b.bookingDate.toISOString(),
        b.status,
        b.status === "CANCELLED" ? 0 : (b.total ?? 0) / 100,
        l.paid / 100,
        cost / 100,
        ((b.status === "CANCELLED" ? 0 : (b.total ?? 0)) - cost) / 100,
      ]);
    }
  } else {
    s.addRow([
      "Booking",
      "Date",
      "Customer",
      "Phone",
      "Equipment",
      "Total INR",
      "Paid INR",
      "Balance INR",
      "Payment status",
      "Order status",
      "Source row",
      "Notes",
    ]);
    for (const b of await db.booking.findMany({
      where: { status: { not: "DELETED" } },
      include: includeBooking,
      orderBy: { bookingDate: "asc" },
    })) {
      const l = ledger(b.payments, b.total);
      if (
        kind === "collections" &&
        (b.status === "CANCELLED" ||
          !["Pending", "Partial"].includes(l.paymentStatus))
      )
        continue;
      s.addRow([
        bookingNumber(b.id),
        b.bookingDate.toISOString(),
        safeCell(b.customer?.name),
        safeCell(b.customer?.rawPhone || b.customer?.phones.join(", ")),
        safeCell(
          b.equipmentText ||
            b.items
              .map((i) => `${i.equipment.name} × ${i.quantity}`)
              .join(", "),
        ),
        b.total === null ? "" : b.total / 100,
        l.paid / 100,
        l.balance === null ? "" : l.balance / 100,
        l.paymentStatus,
        b.status,
        b.sourceRow ?? "",
        safeCell(b.notes),
      ]);
    }
  }
  return format === "csv"
    ? Buffer.from(await w.csv.writeBuffer())
    : Buffer.from(await w.xlsx.writeBuffer());
}
export async function documentPdf(
  id: number,
  kind: string,
  paymentId?: string,
) {
  if (!["summary", "quotation", "invoice", "receipt"].includes(kind))
    throw new HttpError(400, "Invalid document type");
  const b = await db.booking.findUnique({
    where: { id },
    include: includeBooking,
  });
  if (!b || b.status === "DELETED")
    throw new HttpError(404, "Booking not found");
  const s = await settings(),
    l = ledger(b.payments, b.total);
  if (kind === "invoice") return invoicePdf(b, s);
  const p = paymentId ? b.payments.find((p) => p.id === paymentId) : undefined;
  if (kind === "receipt" && !p)
    throw new HttpError(400, "Choose a payment for the receipt");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Standard PDF fonts do not support every Unicode character. INR is explicit.
  const clean = (v: unknown) =>
    String(v ?? "")
      .replace(/₹/g, "INR ")
      .replace(/×/g, " x ")
      .replace(/[^\x20-\x7E\n]/g, "?");
  let page = doc.addPage([595, 842]),
    y = 790;
  const line = (text: string, heading = false) => {
    for (const part of clean(text).split("\n")) {
      const words = part.split(" ");
      let out = "";
      for (const word of words) {
        if (font.widthOfTextAtSize(out + " " + word, 11) > 480) {
          if (y < 60) {
            page = doc.addPage([595, 842]);
            y = 790;
          }
          page.drawText(out, {
            x: 48,
            y,
            size: 11,
            font: heading ? bold : font,
            color: rgb(0, 0, 0),
          });
          y -= 19;
          out = word;
        } else out += (out ? " " : "") + word;
      }
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(out, {
        x: 48,
        y,
        size: heading ? 14 : 11,
        font: heading ? bold : font,
        color: heading ? rgb(0.93, 0.1, 0.23) : rgb(0, 0, 0),
      });
      y -= heading ? 29 : 19;
    }
  };
  try {
    const fs = await import("node:fs/promises");
    const logo = await doc.embedPng(await fs.readFile("public/logo.png"));
    page.drawImage(logo, { x: 48, y: 730, width: 180, height: 50 });
    y = 700;
  } catch {
    line(s.businessName, true);
  }
  line(
    `${kind.toUpperCase()} - ${s.invoicePrefix}-${String(id).padStart(6, "0")}`,
    true,
  );
  line(bookingNumber(id));
  line(
    `Issued: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`,
  );
  line(s.address);
  line(`Contact: ${s.phone} ${s.email}`);
  if (s.gst) line(`GST registration: ${s.gst}`);
  line(`Customer: ${b.customer?.name ?? "Not recorded"}`);
  line(`Phone: ${b.customer?.phones.join(", ") ?? ""}`);
  line(`Status: ${b.status}`);
  line(
    `Pickup: ${b.pickupAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "Not recorded"}`,
  );
  line(
    `Return: ${b.returnAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "Not recorded"}`,
  );
  for (const i of b.items)
    line(
      `${i.equipment.name} x ${i.quantity} | ${i.days} day(s) | ${money(i.rate)} / day | ${money(i.quantity * i.days * i.rate)}`,
    );
  if (b.equipmentText) line(`Equipment: ${b.equipmentText}`);
  line(`Agreed total: ${money(b.total)}`, true);
  line(
    `Discount: ${money(b.discount)} | Negotiated override: ${b.negotiated ? "Yes" : "No"}`,
  );
  line(
    `Rental payments net of refunds: ${money(l.paid)} | Balance: ${money(l.balance)}`,
  );
  line(`Refundable deposit held: ${money(l.deposit)}`);
  if (p) {
    line(`Payment ID: ${p.id}`);
    line(`Payment amount: ${money(p.amount)} | ${p.kind} | ${p.mode}`);
    line(
      `Payment date: ${p.paidAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "Unknown historical date"}`,
    );
    line(`Reference: ${p.reference}`);
  }
  if (s.taxPercent)
    line(
      `Configured tax rate: ${s.taxPercent}%. This document preserves the agreed total; no additional tax is automatically charged.`,
    );
  line(s.paymentInstructions);
  line(s.terms);
  return Buffer.from(await doc.save());
}
