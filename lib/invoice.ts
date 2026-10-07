import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { bookingNumber, ledger, type BusinessSettings } from "./domain";

type InvoiceBooking = {
  id: number;
  pickupAt: Date | null;
  returnAt: Date | null;
  dueAt: Date | null;
  total: number | null;
  discount: number;
  notes: string;
  equipmentText: string;
  customer: { name: string; phones: string[]; rawPhone: string } | null;
  items: {
    equipment: { name: string };
    quantity: number;
    days: number;
    rate: number;
  }[];
  payments: (Parameters<typeof ledger>[0][number] & {
    mode: string;
    reference: string;
  })[];
};

// The supplied PDF is a visual template, not a source of billing rules.
export async function invoicePdf(b: InvoiceBooking, s: BusinessSettings) {
  const template = await readFile("public/invoice-template.pdf");
  const output = await PDFDocument.create();
  const clean = (value: unknown) =>
    String(value ?? "")
      .replace(/₹/g, "INR ")
      .replace(/×/g, " x ")
      .replace(/[^\x20-\x7E\n]/g, "?");
  const amount = (value: number | null) =>
    value === null
      ? "Not set"
      : (value / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const date = (value: Date | null, time = false) =>
    value
      ? value.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
        })
      : "Not recorded";
  const payments = ledger(b.payments, b.total);
  const rows: {
    name: string;
    quantity?: number;
    days?: number;
    rate?: number;
  }[] = b.items.map((i) => ({ name: i.equipment.name, ...i }));
  if (b.equipmentText) rows.push({ name: b.equipmentText });
  const pages = Math.max(1, Math.ceil(rows.length / 6));
  const details: string[] = [];
  for (let index = 0; index < pages; index++) {
    const doc = await PDFDocument.load(template);
    const form = doc.getForm();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const set = (name: string, value: unknown) => {
      const field = form.getTextField(name);
      const text = clean(value).replace(/\s+/g, " ").trim();
      const rect = field.acroField.getWidgets()[0].getRectangle();
      let size = 9;
      while (size > 6 && font.widthOfTextAtSize(text, size) > rect.width - 6)
        size -= 0.5;
      let visible = text;
      if (font.widthOfTextAtSize(text, size) > rect.width - 6) {
        if (!details.includes(`${name.replace(/_/g, " ")}: ${text}`))
          details.push(`${name.replace(/_/g, " ")}: ${text}`);
        while (font.widthOfTextAtSize(visible + "...", size) > rect.width - 6)
          visible = visible.slice(0, -1);
        visible += "...";
      }
      field.setText(visible);
      field.setFontSize(size);
    };
    set(
      "invoice_number",
      `${s.invoicePrefix}-${String(b.id).padStart(6, "0")}`,
    );
    set("invoice_date", date(new Date()));
    set("payment_due", b.dueAt ? date(b.dueAt) : "Not set");
    set("business_address", s.address);
    set("business_phone_email", [s.phone, s.email].filter(Boolean).join(" / "));
    set("business_gstin", s.gst);
    set("customer_name", b.customer?.name ?? "Not recorded");
    set(
      "customer_phone_gstin",
      b.customer?.rawPhone || b.customer?.phones.join(", "),
    );
    set("rental_from", date(b.pickupAt, true));
    set("rental_to", date(b.returnAt, true));
    set(
      "project_reference",
      `${bookingNumber(b.id)}${pages > 1 ? ` / Page ${index + 1} of ${pages}` : ""}`,
    );
    set(
      "rental_duration",
      [...new Set(b.items.map((i) => `${i.days} day(s)`))].join(", ") ||
        "Not recorded",
    );
    rows.slice(index * 6, index * 6 + 6).forEach((row, n) => {
      const slot = n + 1;
      set(`equipment_${slot}`, row.name);
      if (
        row.quantity !== undefined &&
        row.days !== undefined &&
        row.rate !== undefined
      ) {
        set(`quantity_${slot}`, row.quantity);
        set(`days_${slot}`, row.days);
        set(`rate_${slot}`, amount(row.rate));
        set(`amount_${slot}`, amount(row.quantity * row.days * row.rate));
      }
    });
    const final = index === pages - 1;
    if (final) {
      set(
        "payment_method",
        [
          ...new Set(
            b.payments.filter((p) => p.kind === "RENTAL").map((p) => p.mode),
          ),
        ].join(" / "),
      );
      set(
        "payment_reference",
        b.payments
          .filter((p) => p.kind === "RENTAL")
          .map((p) => p.reference)
          .filter(Boolean)
          .join(" / "),
      );
      set(
        "notes",
        [b.notes, s.terms, s.paymentInstructions].filter(Boolean).join(" | "),
      );
      set(
        "subtotal",
        amount(
          b.items.reduce((sum, i) => sum + i.quantity * i.days * i.rate, 0),
        ),
      );
      set("discount", amount(b.discount));
      set("tax", "Not added");
      set("total", amount(b.total));
      set("paid", amount(payments.paid));
      set("balance_due", amount(payments.balance));
    }
    form.updateFieldAppearances(font);
    form.flatten();
    const page = doc.getPages()[0];
    // Replace the blank template's manual-entry instruction with accurate billing context.
    page.drawRectangle({
      x: 313,
      y: 76,
      width: 250,
      height: 15,
      color: rgb(1, 1, 1),
    });
    page.drawText(
      final
        ? "All amounts in INR. Invoice total is the agreed booking total."
        : "Continued on next page. Totals appear on the final invoice page.",
      { x: 314, y: 81, font, size: 6 },
    );
    const [copied] = await output.copyPages(doc, [0]);
    output.addPage(copied);
  }
  if (s.taxPercent)
    details.push(
      `Configured tax rate: ${s.taxPercent}%. No additional tax has been charged; the agreed booking total is preserved.`,
    );
  const computed =
    b.items.reduce((sum, i) => sum + i.quantity * i.days * i.rate, 0) -
    b.discount;
  if (b.total !== null && computed !== b.total)
    details.push(
      `Agreed pricing adjustment: ${amount(b.total - computed)} INR. Invoice total follows the agreed booking amount.`,
    );
  if (payments.deposit)
    details.push(
      `Refundable deposit held separately: ${amount(payments.deposit)} INR.`,
    );
  if (details.length) {
    const font = await output.embedFont(StandardFonts.Helvetica);
    let page = output.addPage([595.276, 841.89]),
      y = 788;
    const line = (text: string) => {
      if (y < 48) {
        page = output.addPage([595.276, 841.89]);
        y = 788;
      }
      page.drawText(text, { x: 36, y, font, size: 10 });
      y -= 16;
    };
    line(
      `INVOICE ${s.invoicePrefix}-${String(b.id).padStart(6, "0")} - Additional details`,
    );
    y -= 12;
    for (const detail of details) {
      let remaining = clean(detail);
      while (remaining) {
        let length = remaining.length;
        while (font.widthOfTextAtSize(remaining.slice(0, length), 10) > 520)
          length--;
        const space = remaining.lastIndexOf(" ", length);
        if (length < remaining.length && space > 0) length = space;
        line(remaining.slice(0, length));
        remaining = remaining.slice(length).trimStart();
      }
      y -= 8;
    }
  }
  return Buffer.from(await output.save());
}
