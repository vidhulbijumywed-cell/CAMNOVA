import ExcelJS from "exceljs";
import { Open } from "unzipper";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { Actor, admin, HttpError } from "./auth";
import { locked, audit, settings } from "./service";
import { toPaise } from "./domain";
type ImportedBooking = {
  row: number;
  customer: string;
  rawPhone: string;
  date: string | null;
  equipment: string;
  total: number | null;
  paid: number;
  mode: string;
  status: string;
  outsourced: string;
  cost: number;
  referral: string;
  notes: string;
  warnings: string[];
  errors: string[];
};
type ImportedEquipment = {
  row: number;
  name: string;
  category: string;
  quantity: number;
  purchaseCost: number;
  rate: number | null;
  warnings: string[];
  errors: string[];
};
function raw(sheet: ExcelJS.Worksheet, row: number, col: number): unknown {
  const v = sheet.getCell(row, col).value;
  if (v && typeof v === "object") {
    if (v instanceof Date) return v;
    if ("formula" in v || "sharedFormula" in v)
      throw new Error("Formula in input column: replace with a source value");
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    throw new Error("Unsupported cell value");
  }
  return v;
}
function dateValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date)
    return `${v.toISOString().slice(0, 10)}T00:00:00+05:30`;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    if (!Number.isFinite(+d)) throw new Error("Invalid Excel date");
    return `${d.toISOString().slice(0, 10)}T00:00:00+05:30`;
  }
  const text = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(+new Date(text)))
    return `${text}T00:00:00+05:30`;
  const m = text.match(/^(\d{1,2})[- ]([a-z]{3,9})[- ](\d{2}|\d{4})$/i);
  if (m) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const mon = months.indexOf(m[2].slice(0, 3).toLowerCase());
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(year, mon, Number(m[1])));
    if (mon < 0 || d.getUTCDate() !== Number(m[1]))
      throw new Error("Invalid date");
    return `${d.toISOString().slice(0, 10)}T00:00:00+05:30`;
  }
  throw new Error("Ambiguous or unrecognized date; use YYYY-MM-DD");
}
export async function previewImport(
  buffer: Buffer,
  name: string,
  mapping?: Record<string, number>,
) {
  if (buffer.length > 10 * 1024 * 1024)
    throw new HttpError(413, "Maximum workbook size is 10 MB");
  const archive = await Open.buffer(buffer);
  if (
    archive.files.length > 2000 ||
    archive.files.some((f) => f.uncompressedSize > 25 * 1024 * 1024) ||
    archive.files.reduce((n, f) => n + f.uncompressedSize, 0) >
      100 * 1024 * 1024
  )
    throw new HttpError(413, "Workbook expands beyond safe size limits");
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const bookings = w.getWorksheet("Bookings"),
    inventory = w.getWorksheet("Rate Card");
  if (!bookings || !inventory)
    throw new HttpError(
      400,
      "Workbook must contain Bookings and Rate Card sheets",
    );
  if (bookings.rowCount > 10000 || inventory.rowCount > 2000)
    throw new HttpError(400, "Workbook exceeds row limit");
  const cols = {
    date: 2,
    customer: 3,
    phone: 4,
    equipment: 5,
    total: 6,
    paid: 7,
    mode: 8,
    status: 11,
    outsourced: 12,
    cost: 13,
    referral: 15,
    notes: 16,
    ...mapping,
  };
  const rows: ImportedBooking[] = [],
    gear: ImportedEquipment[] = [];
  const seen = new Set<string>();
  for (let r = 5; r <= bookings.rowCount; r++) {
    const errors: string[] = [],
      warnings: string[] = [];
    const get = (key: keyof typeof cols) => {
      try {
        return raw(bookings, r, cols[key]);
      } catch (e) {
        errors.push(`${key}: ${(e as Error).message}`);
        return null;
      }
    };
    const source = {
      date: get("date"),
      customer: get("customer"),
      phone: get("phone"),
      equipment: get("equipment"),
      total: get("total"),
      paid: get("paid"),
      mode: get("mode"),
      status: get("status"),
      outsourced: get("outsourced"),
      cost: get("cost"),
      referral: get("referral"),
      notes: get("notes"),
    };
    if (
      ![
        source.date,
        source.customer,
        source.equipment,
        source.total,
        source.paid,
      ].some((v) => v !== null && v !== "")
    )
      continue;
    const amount = (v: unknown, label: string) => {
      try {
        return toPaise(v);
      } catch (e) {
        errors.push(`${label}: ${(e as Error).message}`);
        return null;
      }
    };
    let date: string | null = null;
    try {
      date = dateValue(source.date);
    } catch (e) {
      errors.push((e as Error).message);
    }
    const customer = String(source.customer ?? "").trim(),
      equipment = String(source.equipment ?? "");
    if (!customer) errors.push("Customer name required");
    if (!date) errors.push("Valid booking date required");
    const total = amount(source.total, "Total"),
      paid = amount(source.paid, "Paid") ?? 0,
      cost = amount(source.cost, "Outsource cost") ?? 0;
    if (total === null) warnings.push("No amount");
    if (total !== null && paid > total) errors.push("Paid is more than total");
    const statuses: Record<string, string> = {
      Booked: "BOOKED",
      Collected: "PICKED_UP",
      Dropped: "RETURNED",
      Cancelled: "CANCELLED",
    };
    const status = statuses[String(source.status)] ?? "DRAFT";
    if (!statuses[String(source.status)])
      warnings.push("Order status needs review");
    const mode = ["UPI", "Bank", "Cash"].includes(String(source.mode))
      ? String(source.mode)
      : "Not recorded";
    warnings.push(
      "Historical record: rental period and equipment assignment need review",
    );
    if (paid) warnings.push("Opening payment: payment date unknown");
    const fingerprint = `${date}|${customer.toLowerCase()}|${equipment.toLowerCase()}|${total}`;
    if (seen.has(fingerprint))
      warnings.push("Possible duplicate booking; review before selecting");
    seen.add(fingerprint);
    if (
      rows.some(
        (b) =>
          b.customer === customer &&
          b.equipment === equipment &&
          b.total === total,
      )
    )
      warnings.push(
        "Similar booking may be a multi-day rental; do not merge without review",
      );
    rows.push({
      row: r,
      customer,
      rawPhone: String(source.phone ?? ""),
      date,
      equipment,
      total,
      paid,
      mode,
      status,
      outsourced: String(source.outsourced ?? ""),
      cost,
      referral: String(source.referral ?? ""),
      notes: String(source.notes ?? ""),
      warnings,
      errors,
    });
  }
  for (let r = 5; r <= inventory.rowCount; r++) {
    const errors: string[] = [],
      warnings: string[] = [];
    const get = (c: number) => {
      try {
        return raw(inventory, r, c);
      } catch (e) {
        errors.push((e as Error).message);
        return null;
      }
    };
    const name = String(get(1) ?? "").trim();
    if (!name || name.toUpperCase() === "TOTAL") continue;
    const quantity = Number(get(3));
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 500)
      errors.push("Invalid unit quantity");
    let purchaseCost = 0,
      rate: number | null = null;
    try {
      purchaseCost = toPaise(get(4)) ?? 0;
      rate = toPaise(get(5));
    } catch (e) {
      errors.push((e as Error).message);
    }
    if (rate === null) warnings.push("Daily rate not set");
    gear.push({
      row: r,
      name,
      category: String(get(2) ?? "OTHER"),
      quantity,
      purchaseCost,
      rate,
      warnings,
      errors,
    });
  }
  const hash = createHash("sha256").update(buffer).digest("hex");
  const batch = await db.importBatch.findUnique({ where: { hash } });
  const existing = await db.equipment.findMany({ select: { name: true } });
  for (const e of gear)
    if (existing.some((x) => x.name === e.name))
      e.warnings.push("Existing inventory: will be skipped");
  return {
    name,
    hash,
    alreadyImported: !!batch,
    bookings: rows,
    inventory: gear,
    columns: cols,
  };
}
export async function commitImport(
  a: Actor,
  buffer: Buffer,
  name: string,
  selectedRows: number[],
  mapping?: Record<string, number>,
) {
  admin(a);
  const p = await previewImport(buffer, name, mapping);
  const rows = p.bookings.filter((b) => selectedRows.includes(b.row));
  if (
    rows.some((b) => b.errors.length) ||
    p.inventory.some((e) => e.errors.length)
  )
    throw new HttpError(400, "Fix source errors before importing");
  return locked(async (tx) => {
    if (await tx.importBatch.findUnique({ where: { hash: p.hash } }))
      throw new HttpError(
        409,
        "This workbook has already been imported. Re-import is blocked even after rollback.",
      );
    const s = await settings(tx);
    for (const b of rows)
      if (
        b.paid > 0 &&
        b.mode === "Not recorded" &&
        b.date &&
        b.date.slice(0, 10) >= s.paymentModeRequiredFrom
      )
        throw new HttpError(
          400,
          `Row ${b.row}: payment mode required from ${s.paymentModeRequiredFrom}`,
        );
    const batch = await tx.importBatch.create({
      data: {
        hash: p.hash,
        name,
        summary: { bookings: rows.length, inventory: p.inventory.length },
      },
    });
    let gearCreated = 0;
    for (const e of p.inventory) {
      if (await tx.equipment.findUnique({ where: { name: e.name } })) continue;
      const eq = await tx.equipment.create({
        data: {
          name: e.name,
          category: e.category,
          rate: e.rate,
          purchaseCost: e.purchaseCost,
          importId: batch.id,
          assets: {
            create: Array.from({ length: e.quantity }, () => ({
              purchaseCost: e.purchaseCost,
            })),
          },
        },
      });
      gearCreated++;
      await audit(tx, a, "IMPORT", "Equipment", eq.id, { importId: batch.id });
    }
    for (const row of rows) {
      // Each source customer gets a reviewable record; no unsafe name-only merge.
      const c = await tx.customer.create({
        data: {
          name: row.customer,
          rawPhone: row.rawPhone,
          phones: row.rawPhone ? [row.rawPhone] : [],
          referral: row.referral,
          importId: batch.id,
        },
      });
      const b = await tx.booking.create({
        data: {
          customerId: c.id,
          bookingDate: new Date(row.date!),
          status: row.status,
          total: row.total,
          negotiated: true,
          equipmentText: row.equipment,
          notes: row.notes,
          referral: row.referral,
          warnings: row.warnings,
          historical: true,
          sourceRef: `BK-${String(row.row - 4).padStart(3, "0")}`,
          sourceRow: row.row,
          importId: batch.id,
          payments: row.paid
            ? {
                create: {
                  amount: row.paid,
                  kind: "RENTAL",
                  mode: row.mode,
                  paidAt: null,
                  recordedBy: a.id,
                  notes: "Imported cumulative payment; date unknown",
                },
              }
            : undefined,
          outsourced:
            row.outsourced || row.cost
              ? {
                  create: {
                    description: row.outsourced || "Imported outsourcing",
                    cost: row.cost,
                  },
                }
              : undefined,
        },
      });
      await audit(tx, a, "IMPORT", "Booking", b.id, {
        importId: batch.id,
        sourceRow: row.row,
      });
    }
    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        summary: {
          bookings: rows.length,
          inventoryCreated: gearCreated,
          inventorySkipped: p.inventory.length - gearCreated,
        },
      },
    });
    await audit(tx, a, "IMPORT", "Import", batch.id, { count: rows.length });
    return {
      id: batch.id,
      bookings: rows.length,
      inventoryCreated: gearCreated,
    };
  });
}
export async function rollbackImport(a: Actor, id: string) {
  admin(a);
  return locked(async (tx) => {
    const batch = await tx.importBatch.findUniqueOrThrow({ where: { id } });
    if (batch.rolledBackAt) throw new HttpError(409, "Already rolled back");
    const bookings = await tx.booking.findMany({
        where: { importId: id },
        include: { payments: true },
      }),
      equipment = await tx.equipment.findMany({ where: { importId: id } }),
      customers = await tx.customer.findMany({ where: { importId: id } });
    for (const b of bookings) {
      if (b.version !== 1)
        throw new HttpError(
          409,
          "Imported bookings have changed. Rollback would destroy later work.",
        );
    }
    for (const e of equipment) {
      if (await tx.bookingItem.count({ where: { equipmentId: e.id } }))
        throw new HttpError(409, "Imported equipment is used by bookings");
      if (
        await tx.audit.count({
          where: {
            entity: "Equipment",
            entityId: e.id,
            action: { not: "IMPORT" },
          },
        })
      )
        throw new HttpError(409, "Imported equipment has changed");
    }
    for (const c of customers) {
      if (
        (await tx.booking.count({
          where: {
            customerId: c.id,
            OR: [{ importId: null }, { importId: { not: id } }],
          },
        })) ||
        c.updatedAt > c.createdAt
      )
        throw new HttpError(409, "Imported customers have later changes");
    }
    await tx.booking.deleteMany({ where: { importId: id } });
    await tx.customer.deleteMany({ where: { importId: id } });
    await tx.equipment.deleteMany({ where: { importId: id } });
    await tx.importBatch.update({
      where: { id },
      data: { rolledBackAt: new Date() },
    });
    await audit(tx, a, "ROLLBACK", "Import", id, {});
    return { ok: true };
  });
}
