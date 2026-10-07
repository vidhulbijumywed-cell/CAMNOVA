import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "./db";
import { admin, Actor, HttpError } from "./auth";
import { decodeProductPhoto } from "./product-photo";
import {
  defaultSettings,
  BusinessSettings,
  ledger,
  rentalDays,
  monthWindow,
} from "./domain";
type Tx = Prisma.TransactionClient;
export const includeBooking = {
  customer: true,
  items: { include: { equipment: true } },
  payments: true,
  outsourced: { include: { vendor: true, payments: true } },
} as const;
export async function locked<T>(fn: (tx: Tx) => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(891401)`;
      return fn(tx);
    },
    { timeout: 30000, maxWait: 30000 },
  );
}
export async function audit(
  tx: Tx,
  a: Actor,
  action: string,
  entity: string,
  id: string | number,
  detail: object,
) {
  await tx.audit.create({
    data: {
      actor: a.id,
      action,
      entity,
      entityId: String(id),
      detail: detail as Prisma.InputJsonValue,
    },
  });
}
export async function settings(
  tx: Tx | typeof db = db,
): Promise<BusinessSettings> {
  const s = await tx.setting.findUnique({ where: { id: "business" } });
  const value = (s?.value ?? {}) as Partial<BusinessSettings>;
  return {
    ...defaultSettings,
    ...value,
    templates: { ...defaultSettings.templates, ...value.templates },
  };
}
const nullableDate = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => !v || Number.isFinite(+v), "Invalid date");
const amount = z.number().int().min(0).max(2_000_000_000);
const bookingSchema = z.object({
  customerId: z.string().nullish(),
  bookingDate: nullableDate,
  pickupAt: nullableDate,
  returnAt: nullableDate,
  dueAt: nullableDate,
  status: z
    .enum(["DRAFT", "BOOKED", "PICKED_UP", "RETURNED", "CANCELLED"])
    .default("DRAFT"),
  total: amount.nullish(),
  discount: amount.default(0),
  negotiated: z.boolean().default(false),
  notes: z.string().max(5000).default(""),
  referral: z.string().max(200).default(""),
  equipmentText: z.string().max(5000).default(""),
  version: z.number().int().optional(),
  items: z
    .array(
      z.object({
        equipmentId: z.string(),
        quantity: z.number().int().min(1).max(500),
        rate: amount.optional(),
      }),
    )
    .max(100)
    .default([]),
  outsourced: z
    .array(
      z.object({
        vendorId: z.string().nullish(),
        description: z.string().min(1).max(500),
        cost: amount,
      }),
    )
    .max(100)
    .default([]),
});
export async function availableQuantity(
  tx: Tx,
  equipmentId: string,
  start: Date,
  end: Date,
  excludeId?: number,
) {
  const s = await settings(tx);
  const buffer = s.turnaroundMinutes * 60000;
  const capacity = await tx.asset.count({
    where: { equipmentId, status: "AVAILABLE" },
  });
  const existing = await tx.bookingItem.findMany({
    where: {
      equipmentId,
      bookingId: excludeId ? { not: excludeId } : undefined,
      booking: {
        status: { in: ["BOOKED", "PICKED_UP", "RETURNED"] },
        historical: false,
      },
    },
    include: { booking: true },
  });
  const events: [number, number][] = [
    [+start, 0],
    [+end + buffer, 0],
  ];
  const addInterval = (begin: number, finish: number, units: number) => {
    if (units <= 0 || begin >= +end + buffer || finish <= +start) return;
    events.push(
      [Math.max(+start, begin), units],
      [Math.min(+end + buffer, finish), -units],
    );
  };
  for (const item of existing) {
    const b = item.booking;
    const begin = b.actualPickupAt ?? b.pickupAt;
    if (!begin || !b.returnAt) continue;
    const returns = (
      (
        b.checklist as {
          events?: {
            action: string;
            at: string;
            items?: { id: string; quantity: number }[];
          }[];
        }
      ).events ?? []
    ).filter((e) => e.action === "RETURN");
    let logged = 0;
    for (const event of returns) {
      const units = event.items?.find((i) => i.id === item.id)?.quantity ?? 0;
      logged += units;
      addInterval(+begin, +new Date(event.at) + buffer, units);
    }
    if (item.returned > logged && b.actualReturnAt)
      addInterval(+begin, +b.actualReturnAt + buffer, item.returned - logged);
    const finish =
      b.status === "PICKED_UP" && b.returnAt < new Date()
        ? Math.max(+end + buffer, Date.now())
        : +b.returnAt + buffer;
    addInterval(+begin, finish, item.quantity - item.returned);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let used = 0;
  let peak = 0;
  for (const [, delta] of events) {
    used += delta;
    peak = Math.max(peak, used);
  }
  return Math.max(0, capacity - peak);
}
export async function checkCapacity(
  tx: Tx,
  equipmentId: string,
  quantity: number,
  start: Date,
  end: Date,
  excludeId?: number,
) {
  if (
    quantity > (await availableQuantity(tx, equipmentId, start, end, excludeId))
  )
    throw new HttpError(
      409,
      "Insufficient equipment availability. Check the calendar or reduce quantity.",
    );
}
export async function saveBooking(a: Actor, input: unknown, id?: number) {
  const v = bookingSchema.parse(input);
  return locked(async (tx) => {
    const existing = id
      ? await tx.booking.findUnique({ where: { id }, include: includeBooking })
      : null;
    if (id && (!existing || existing.status === "DELETED"))
      throw new HttpError(404, "Booking not found");
    if (existing && v.version !== existing.version)
      throw new HttpError(409, "This booking changed. Reload before saving.");
    if (
      existing &&
      (existing.status !== "DRAFT" || existing.payments.length > 0)
    )
      admin(a);
    if (
      (existing?.status === "RETURNED" && !existing.historical) ||
      existing?.items.some((i) => i.returned > 0)
    )
      throw new HttpError(
        409,
        "Completed or partially returned bookings cannot be repriced. Use follow-up or ledger actions.",
      );
    if (
      v.status === "PICKED_UP" &&
      (!existing ||
        existing.status !== "PICKED_UP" ||
        (existing.historical && v.items.length > 0))
    )
      throw new HttpError(400, "Use the pickup checklist to issue gear");
    if (
      existing?.status === "PICKED_UP" &&
      !existing.historical &&
      v.status !== "PICKED_UP"
    )
      throw new HttpError(
        409,
        "Use the return checklist before closing or changing an issued booking",
      );
    const s = await settings(tx);
    const days =
      v.pickupAt && v.returnAt
        ? rentalDays(v.pickupAt, v.returnAt, s.rentalPolicy)
        : 1;
    const unique = new Set(v.items.map((i) => i.equipmentId));
    if (unique.size !== v.items.length)
      throw new HttpError(400, "Combine duplicate equipment into one line");
    const items = [];
    for (const line of v.items) {
      const eq = await tx.equipment.findUnique({
        where: { id: line.equipmentId },
      });
      if (!eq) throw new HttpError(400, "Unknown equipment");
      const old = existing?.items.find(
        (i) => i.equipmentId === line.equipmentId,
      );
      const rate = line.rate ?? old?.rate ?? eq.rate;
      if (rate === null)
        throw new HttpError(400, `${eq.name}: daily rate not set`);
      items.push({ equipmentId: eq.id, quantity: line.quantity, rate, days });
    }
    const subtotal =
      items.reduce((n, i) => n + i.rate * i.quantity * i.days, 0) +
      v.outsourced.reduce((n, o) => n + o.cost, 0);
    const total = v.negotiated
      ? (v.total ?? null)
      : items.length
        ? subtotal - v.discount
        : (v.total ?? null);
    if (total !== null && (total < 0 || total > 2_000_000_000))
      throw new HttpError(400, "Invalid booking total");
    if (
      existing &&
      total !== null &&
      ledger(existing.payments, total).paid > total
    )
      throw new HttpError(
        409,
        "Total cannot be below payments already recorded",
      );
    const remainsHistorical = !!existing?.historical && !v.items.length;
    if (
      remainsHistorical &&
      v.status !== existing!.status &&
      v.status !== "CANCELLED"
    )
      throw new HttpError(
        400,
        "Add structured equipment and rental dates to convert historical status",
      );
    if (
      v.status !== "DRAFT" &&
      v.status !== "CANCELLED" &&
      !remainsHistorical
    ) {
      if (
        !v.customerId ||
        !v.pickupAt ||
        !v.returnAt ||
        !items.length ||
        total === null
      )
        throw new HttpError(
          400,
          "Customer, rental dates, equipment, and pricing are required",
        );
      if (v.status === "RETURNED")
        throw new HttpError(400, "Use the return checklist to finish a rental");
      for (const i of items)
        await checkCapacity(
          tx,
          i.equipmentId,
          i.quantity,
          v.pickupAt,
          v.returnAt,
          id,
        );
    }
    if (existing?.outsourced.some((o) => o.payments.length))
      throw new HttpError(
        409,
        "Vendor payments exist; use status and follow-up actions without replacing outsource lines",
      );
    if (existing) {
      await tx.bookingItem.deleteMany({ where: { bookingId: id } });
      await tx.outsource.deleteMany({ where: { bookingId: id } });
    }
    const data = {
      customerId: v.customerId || null,
      bookingDate: v.bookingDate ?? existing?.bookingDate ?? new Date(),
      pickupAt: v.pickupAt,
      returnAt: v.returnAt,
      dueAt: v.dueAt,
      status: v.status,
      total,
      discount: v.discount,
      negotiated: v.negotiated,
      notes: v.notes,
      referral: v.referral,
      equipmentText: v.equipmentText,
      warnings: remainsHistorical
        ? existing!.warnings.filter((w) => w !== "No amount" || total === null)
        : [],
      items: { create: items },
      outsourced: {
        create: v.outsourced.map((o) => ({
          ...o,
          vendorId: o.vendorId || null,
        })),
      },
    };
    const b = existing
      ? await tx.booking.update({
          where: { id },
          data: {
            ...data,
            historical: remainsHistorical,
            ...(existing.customerAccountId &&
            existing.customerId !== data.customerId
              ? { customerAccountId: null, requestKey: null }
              : {}),
            version: { increment: 1 },
          },
          include: includeBooking,
        })
      : await tx.booking.create({ data, include: includeBooking });
    await audit(tx, a, existing ? "UPDATE" : "CREATE", "Booking", b.id, {
      status: b.status,
      total: b.total,
    });
    return { ...b, ...ledger(b.payments, b.total) };
  });
}
const paymentSchema = z.object({
  amount: amount.refine((v) => v > 0),
  kind: z.enum(["RENTAL", "DEPOSIT"]).default("RENTAL"),
  mode: z.enum(["UPI", "Bank", "Cash"]),
  paidAt: z.string().datetime({ offset: true }),
  reference: z.string().max(200).default(""),
  notes: z.string().max(1000).default(""),
  refund: z.boolean().default(false),
  reviewedCredit: z.boolean().default(false),
  correctId: z.string().optional(),
});
export async function addPayment(a: Actor, id: number, input: unknown) {
  const v = paymentSchema.parse(input);
  return locked(async (tx) => {
    const b = await tx.booking.findUnique({
      where: { id },
      include: includeBooking,
    });
    if (!b || b.status === "DELETED")
      throw new HttpError(404, "Booking not found");
    if (v.refund || v.reviewedCredit || v.correctId) admin(a);
    if (v.reviewedCredit && !v.notes.trim())
      throw new HttpError(400, "Explain the reviewed credit");
    if (b.status === "CANCELLED" && !v.refund && !v.correctId)
      throw new HttpError(
        409,
        "Cancelled bookings accept refunds or corrections only",
      );
    if (v.correctId) {
      if (!v.notes.trim())
        throw new HttpError(400, "Correction reason required");
      const original = b.payments.find((p) => p.id === v.correctId);
      if (!original || b.payments.some((p) => p.reversesId === original.id))
        throw new HttpError(409, "Payment already corrected or not found");
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: -original.amount,
          kind: original.kind,
          mode: original.mode,
          paidAt: original.paidAt,
          reference: original.reference,
          notes: `Correction: ${v.notes}`,
          recordedBy: a.id,
          reversesId: original.id,
        },
      });
    }
    const payments = await tx.payment.findMany({ where: { bookingId: id } });
    const l = ledger(payments, b.total);
    const amountSigned = v.refund ? -v.amount : v.amount;
    const available = v.kind === "DEPOSIT" ? l.deposit : l.paid;
    if (amountSigned < 0 && v.amount > available)
      throw new HttpError(400, "Refund exceeds funds held");
    if (
      v.kind === "RENTAL" &&
      amountSigned > 0 &&
      (b.total === null || l.paid + v.amount > b.total) &&
      !v.reviewedCredit
    )
      throw new HttpError(
        409,
        "Payment exceeds total. Owner must explicitly review a credit.",
      );
    const p = await tx.payment.create({
      data: {
        bookingId: id,
        amount: amountSigned,
        kind: v.kind,
        mode: v.mode,
        paidAt: new Date(v.paidAt),
        reference: v.reference,
        notes: v.notes,
        recordedBy: a.id,
        reviewedCredit: v.reviewedCredit,
      },
    });
    await tx.booking.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    await audit(
      tx,
      a,
      v.correctId ? "CORRECT_PAYMENT" : v.refund ? "REFUND" : "PAYMENT",
      "Booking",
      id,
      { paymentId: p.id, amount: p.amount, kind: p.kind },
    );
    return p;
  });
}
export async function bookingAction(a: Actor, id: number, input: unknown) {
  const v = z
    .object({
      version: z.number().int().optional(),
      paymentId: z.string().optional(),
      action: z.enum([
        "PICKUP",
        "RETURN",
        "CANCEL",
        "FOLLOWUP",
        "EXTEND",
        "CONFIRM",
        "DELETE",
        "DELETE_PAYMENT",
      ]),
      notes: z.string().max(5000).default(""),
      accessories: z.string().max(2000).default(""),
      condition: z.string().max(2000).default(""),
      missing: z.string().max(2000).default(""),
      returnAt: nullableDate,
      followupAt: nullableDate,
      items: z
        .array(z.object({ id: z.string(), quantity: z.number().int().min(0) }))
        .default([]),
    })
    .parse(input);
  return locked(async (tx) => {
    const b = await tx.booking.findUnique({
      where: { id },
      include: includeBooking,
    });
    if (!b || b.status === "DELETED")
      throw new HttpError(404, "Booking not found");
    if (["CONFIRM", "DELETE", "DELETE_PAYMENT"].includes(v.action)) {
      if (v.version !== b.version)
        throw new HttpError(409, "Booking changed. Refresh before continuing.");
    }
    if (v.action === "CONFIRM") {
      if (b.status !== "DRAFT" || b.historical)
        throw new HttpError(409, "Only active drafts can be confirmed");
      if (
        !b.customerId ||
        !b.pickupAt ||
        !b.returnAt ||
        !b.items.length ||
        b.total === null
      )
        throw new HttpError(
          400,
          "Edit the booking to complete customer, dates and pricing first",
        );
      for (const item of b.items)
        await checkCapacity(
          tx,
          item.equipmentId,
          item.quantity,
          b.pickupAt,
          b.returnAt,
          b.id,
        );
    }
    if (v.action === "DELETE" || v.action === "DELETE_PAYMENT") {
      admin(a);
      if (!v.notes.trim())
        throw new HttpError(400, "A correction reason is required");
    }
    if (v.action === "DELETE_PAYMENT") {
      const p = b.payments.find((p) => p.id === v.paymentId);
      if (!p || p.reversesId || b.payments.some((x) => x.reversesId === p.id))
        throw new HttpError(409, "Payment already removed or corrected");
      const remaining = ledger(
        b.payments.filter((x) => x.id !== p.id),
        b.total,
      );
      if (remaining.paid < 0 || remaining.deposit < 0)
        throw new HttpError(409, "Correct linked refunds first");
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: -p.amount,
          kind: p.kind,
          mode: p.mode,
          paidAt: p.paidAt,
          reference: p.reference,
          notes: `Removed entry: ${v.notes}`,
          recordedBy: a.id,
          reversesId: p.id,
        },
      });
    }
    if (v.action === "DELETE") {
      if (
        b.status === "PICKED_UP" ||
        b.items.some((i) => i.returned < i.quantity && b.actualPickupAt)
      )
        throw new HttpError(409, "Return issued equipment first");
      if (
        b.payments.some(
          (p) =>
            !p.reversesId && !b.payments.some((x) => x.reversesId === p.id),
        ) ||
        b.outsourced.some((o) => o.payments.length)
      )
        throw new HttpError(
          409,
          "Correct or remove payment entries before deleting this booking",
        );
    }
    const checklist = b.checklist as { events?: object[] };
    const changes: Prisma.BookingUpdateInput = { version: { increment: 1 } };
    if (v.action === "CONFIRM") changes.status = "BOOKED";
    if (v.action === "DELETE") changes.status = "DELETED";
    if (v.action === "FOLLOWUP") {
      changes.followupNote = v.notes;
      changes.followupAt = v.followupAt;
    }
    if (v.action === "CANCEL") {
      admin(a);
      if (b.status === "PICKED_UP" || b.status === "RETURNED")
        throw new HttpError(
          409,
          "Return issued equipment before closing the booking",
        );
      changes.status = "CANCELLED";
    }
    if (v.action === "EXTEND") {
      if (
        !["BOOKED", "PICKED_UP"].includes(b.status) ||
        b.historical ||
        !b.pickupAt ||
        !b.returnAt ||
        !v.returnAt ||
        v.returnAt <= b.returnAt
      )
        throw new HttpError(
          400,
          "A later return time is required for an active reservation",
        );
      for (const i of b.items)
        await checkCapacity(
          tx,
          i.equipmentId,
          i.quantity - i.returned,
          b.actualPickupAt ?? b.pickupAt,
          v.returnAt,
          id,
        );
      changes.returnAt = v.returnAt;
      // Extension keeps agreed price unchanged; any negotiated charge needs explicit owner repricing.
      changes.notes = `${b.notes}\nExtension: ${v.notes}`;
    }
    if (v.action === "PICKUP" || v.action === "RETURN") {
      if (!v.condition.trim())
        throw new HttpError(400, "Record equipment condition");
      if (v.action === "PICKUP") {
        if (b.status !== "BOOKED" || b.historical || !b.pickupAt || !b.returnAt)
          throw new HttpError(
            409,
            "Only confirmed reservations can be picked up",
          );
        if (b.returnAt <= new Date())
          throw new HttpError(
            409,
            "Extend the expected return before picking up an overdue reservation",
          );
        for (const i of b.items)
          await checkCapacity(
            tx,
            i.equipmentId,
            i.quantity,
            new Date(),
            b.returnAt,
            id,
          );
        changes.status = "PICKED_UP";
        changes.actualPickupAt = new Date();
      } else {
        if (b.status !== "PICKED_UP" || b.historical)
          throw new HttpError(409, "Only issued reservations can be returned");
        if (
          new Set(v.items.map((i) => i.id)).size !== v.items.length ||
          !v.items.some((i) => i.quantity > 0)
        )
          throw new HttpError(400, "Choose quantities returned");
        for (const i of v.items) {
          const old = b.items.find((x) => x.id === i.id);
          if (!old || i.quantity > old.quantity - old.returned)
            throw new HttpError(400, "Invalid return quantity");
          await tx.bookingItem.update({
            where: { id: i.id },
            data: { returned: { increment: i.quantity } },
          });
        }
        const updated = await tx.bookingItem.findMany({
          where: { bookingId: id },
        });
        if (updated.every((i) => i.returned === i.quantity)) {
          changes.status = "RETURNED";
          changes.actualReturnAt = new Date();
        }
      }
      changes.checklist = {
        events: [
          ...(checklist.events ?? []),
          {
            action: v.action,
            at: new Date().toISOString(),
            actor: a.id,
            condition: v.condition,
            accessories: v.accessories,
            missing: v.missing,
            notes: v.notes,
            items: v.items,
          },
        ],
      } as Prisma.InputJsonValue;
    }
    await tx.booking.update({ where: { id }, data: changes });
    await audit(tx, a, v.action, "Booking", id, v);
    return { ok: true };
  });
}
export async function saveEntity(a: Actor, entity: string, input: unknown) {
  return locked(async (tx) => {
    if (entity === "customers") {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(1).max(200),
          phones: z.array(z.string().max(100)).max(10).default([]),
          rawPhone: z.string().max(500).default(""),
          email: z.union([z.email(), z.literal("")]).default(""),
          notes: z.string().max(5000).default(""),
          referral: z.string().max(200).default(""),
        })
        .parse(input);
      const { id, ...data } = v;
      const result = id
        ? await tx.customer.update({ where: { id }, data })
        : await tx.customer.create({ data });
      await audit(tx, a, id ? "UPDATE" : "CREATE", "Customer", result.id, {
        name: data.name,
      });
      return result;
    }
    admin(a);
    if (entity === "inventory") {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(1).max(200),
          category: z.string().min(1).max(100),
          quantity: z.number().int().min(0).max(500),
          rate: amount.nullable(),
          purchaseCost: amount,
          notes: z.string().max(5000).default(""),
          photo: z.string().max(1400000).nullable().optional(),
        })
        .parse(input);
      const { id, quantity, photo, ...data } = v;
      const old = id
        ? await tx.equipment.findUnique({
            where: { id },
            include: { assets: true },
          })
        : null;
      if (old && quantity < old.assets.length)
        throw new HttpError(
          400,
          "Retire assets individually to preserve history",
        );
      const result = id
        ? await tx.equipment.update({ where: { id }, data })
        : await tx.equipment.create({ data });
      if (photo !== undefined) {
        if (photo === null) {
          await tx.equipmentPhoto.deleteMany({
            where: { equipmentId: result.id },
          });
        } else {
          const bytes = new Uint8Array(decodeProductPhoto(photo));
          await tx.equipmentPhoto.upsert({
            where: { equipmentId: result.id },
            create: { equipmentId: result.id, data: bytes },
            update: { data: bytes },
          });
        }
      }
      if (quantity > (old?.assets.length ?? 0))
        await tx.asset.createMany({
          data: Array.from(
            { length: quantity - (old?.assets.length ?? 0) },
            () => ({ equipmentId: result.id, purchaseCost: v.purchaseCost }),
          ),
        });
      await audit(tx, a, "SAVE", "Equipment", result.id, {
        name: data.name,
        quantity,
        rate: data.rate,
        ...(photo !== undefined
          ? { photo: photo === null ? "removed" : "updated" }
          : {}),
      });
      return result;
    }
    if (entity === "assets") {
      const v = z
        .object({
          id: z.string(),
          status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]),
          serial: z.string().max(200).nullable().optional(),
          condition: z.string().max(2000),
          accessories: z.string().max(2000).default(""),
          notes: z.string().max(5000).default(""),
          purchaseDate: nullableDate,
          purchaseCost: amount.optional(),
        })
        .parse(input);
      const { id, ...data } = v;
      const asset = await tx.asset.findUniqueOrThrow({ where: { id } });
      const result = await tx.asset.update({ where: { id }, data });
      // Ensure reducing fleet capacity does not invalidate any active reservation.
      const active = await tx.bookingItem.findMany({
        where: {
          equipmentId: asset.equipmentId,
          booking: {
            status: { in: ["BOOKED", "PICKED_UP"] },
            historical: false,
          },
        },
        include: { booking: true },
      });
      for (const i of active)
        if (i.booking.pickupAt && i.booking.returnAt)
          await checkCapacity(
            tx,
            asset.equipmentId,
            i.quantity - i.returned,
            i.booking.pickupAt,
            i.booking.returnAt,
            i.bookingId,
          );
      await audit(tx, a, "UPDATE", "Equipment", asset.equipmentId, {
        assetId: id,
        ...data,
      });
      return result;
    }
    if (entity === "vendors") {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(1).max(200),
          phone: z.string().max(200).default(""),
          notes: z.string().max(5000).default(""),
        })
        .parse(input);
      const { id, ...data } = v;
      const result = id
        ? await tx.vendor.update({ where: { id }, data })
        : await tx.vendor.create({ data });
      await audit(tx, a, "SAVE", "Vendor", result.id, data);
      return result;
    }
    if (entity === "vendor-payments") {
      const v = z
        .object({
          outsourceId: z.string(),
          amount: amount.refine((n) => n > 0),
          paidAt: z.string().datetime({ offset: true }),
          mode: z.enum(["UPI", "Bank", "Cash"]),
          notes: z.string().max(1000).default(""),
        })
        .parse(input);
      const o = await tx.outsource.findUniqueOrThrow({
        where: { id: v.outsourceId },
        include: { payments: true },
      });
      if (o.payments.reduce((n, p) => n + p.amount, 0) + v.amount > o.cost)
        throw new HttpError(409, "Vendor payment exceeds agreed cost");
      const p = await tx.vendorPayment.create({
        data: { ...v, paidAt: new Date(v.paidAt), recordedBy: a.id },
      });
      await tx.booking.update({
        where: { id: o.bookingId },
        data: { version: { increment: 1 } },
      });
      await audit(tx, a, "VENDOR_PAYMENT", "Booking", o.bookingId, {
        paymentId: p.id,
        amount: p.amount,
      });
      return p;
    }
    if (entity === "settings") {
      const v = z
        .object({
          businessName: z.string().min(1).max(200),
          address: z.string().max(1000),
          phone: z.string().max(100),
          email: z.union([z.email(), z.literal("")]),
          gst: z.string().max(100),
          taxPercent: z.number().min(0).max(100),
          invoicePrefix: z.string().regex(/^[A-Za-z0-9-]{1,12}$/),
          rentalPolicy: z.enum(["24H", "CALENDAR"]),
          turnaroundMinutes: z.number().int().min(0).max(10080),
          paymentModeRequiredFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          terms: z.string().max(10000),
          paymentInstructions: z.string().max(2000),
          templates: z.object({
            confirmation: z.string().max(2000),
            pickup: z.string().max(2000),
            return: z.string().max(2000),
            collection: z.string().max(2000),
          }),
        })
        .parse(input);
      const result = await tx.setting.upsert({
        where: { id: "business" },
        create: { id: "business", value: v },
        update: { value: v },
      });
      await audit(tx, a, "UPDATE", "Setting", "business", v);
      return result;
    }
    if (entity === "users") {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().min(1).max(200),
          email: z.email().transform((v) => v.toLowerCase()),
          role: z.enum(["ADMIN", "STAFF"]),
          active: z.boolean().default(true),
          password: z.string().min(12).max(128).optional(),
        })
        .parse(input);
      if (v.id === a.id && (v.role !== "ADMIN" || !v.active))
        throw new HttpError(400, "Cannot remove your own owner access");
      const { id, password, ...data } = v;
      if (!id && !password)
        throw new HttpError(400, "Initial password required");
      const result = id
        ? await tx.user.update({
            where: { id },
            data: {
              ...data,
              ...(password ? { passwordHash: await hash(password, 12) } : {}),
              ...(password || !data.active
                ? { sessionVersion: { increment: 1 } }
                : {}),
            },
          })
        : await tx.user.create({
            data: { ...data, passwordHash: await hash(password!, 12) },
          });
      await audit(tx, a, "SAVE", "User", result.id, {
        role: data.role,
        active: data.active,
      });
      return { id: result.id };
    }
    throw new HttpError(404, "Unknown resource");
  });
}
export async function snapshot(a: Actor, month: string) {
  const { start, end, days } = monthWindow(month);
  const [bookings, inventory, customers, vendors, s, imports, users, audits] =
    await Promise.all([
      db.booking.findMany({
        where: { status: { not: "DELETED" } },
        include: includeBooking,
        orderBy: { bookingDate: "desc" },
      }),
      db.equipment.findMany({
        include: { assets: true, photo: { select: { updatedAt: true } } },
        orderBy: { category: "asc" },
      }),
      db.customer.findMany({ orderBy: { name: "asc" } }),
      db.vendor.findMany({
        include: { outsourced: { include: { payments: true } } },
      }),
      settings(),
      a.role === "ADMIN"
        ? db.importBatch.findMany({ orderBy: { createdAt: "desc" } })
        : [],
      a.role === "ADMIN"
        ? db.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
            },
          })
        : [],
      a.role === "ADMIN"
        ? db.audit.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
        : [],
    ]);
  const decorated = bookings.map((b) => ({
    ...b,
    ...ledger(b.payments, b.total),
  }));
  const selected = decorated.filter(
    (b) => b.bookingDate >= start && b.bookingDate < end,
  );
  const live = selected.filter(
    (b) => b.status !== "CANCELLED" && b.status !== "DRAFT",
  );
  const revenue = live.reduce((n, b) => n + (b.total ?? 0), 0),
    collected = live.reduce((n, b) => n + b.paid, 0);
  const outsourceCost = selected.reduce(
    (n, b) => n + b.outsourced.reduce((s, o) => s + o.cost, 0),
    0,
  );
  const allPayments = bookings.flatMap((b) => b.payments);
  const reversedIds = new Set(
    allPayments.filter((p) => p.reversesId).map((p) => p.reversesId),
  );
  const effectivePayments = allPayments.filter(
    (p) => !p.reversesId && !reversedIds.has(p.id),
  );
  const dated = effectivePayments.filter(
    (p) => p.paidAt && p.paidAt >= start && p.paidAt < end,
  );
  const maxDaily = inventory.reduce(
    (n, e) =>
      n + (e.rate ?? 0) * e.assets.filter((a) => a.status !== "RETIRED").length,
    0,
  );
  const investment = inventory.reduce(
    (n, e) => n + e.assets.reduce((s, a) => s + a.purchaseCost, 0),
    0,
  );
  const weekday = Array.from({ length: 7 }, (_, i) => ({
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
    bookings: 0,
    revenue: 0,
  }));
  for (const b of live) {
    const i = new Date(+b.bookingDate + 19800000).getUTCDay();
    weekday[i].bookings++;
    weekday[i].revenue += b.total ?? 0;
  }
  const modes = ["UPI", "Bank", "Cash", "Not recorded"].map((mode) => ({
    mode,
    amount: live.reduce(
      (n, b) =>
        n +
        b.payments
          .filter((p) => p.kind === "RENTAL" && p.mode === mode)
          .reduce((s, p) => s + p.amount, 0),
      0,
    ),
    count: live
      .flatMap((b) => b.payments)
      .filter((p) => p.kind === "RENTAL" && p.mode === mode).length,
  }));
  const vendorPaid = bookings
    .flatMap((b) => b.outsourced)
    .flatMap((o) => o.payments)
    .filter((p) => p.paidAt && p.paidAt >= start && p.paidAt < end)
    .reduce((n, p) => n + p.amount, 0);
  const utilization = inventory.map((e) => {
    let occupied = 0;
    for (const b of bookings.filter(
      (b) =>
        !b.historical &&
        ["PICKED_UP", "RETURNED"].includes(b.status) &&
        (b.actualPickupAt ?? b.pickupAt),
    )) {
      for (const i of b.items.filter((i) => i.equipmentId === e.id)) {
        const events = (
          (
            b.checklist as {
              events?: {
                action: string;
                at: string;
                items?: { id: string; quantity: number }[];
              }[];
            }
          ).events ?? []
        ).filter((x) => x.action === "RETURN");
        let remaining = i.quantity;
        for (const event of events) {
          const qty = event.items?.find((x) => x.id === i.id)?.quantity ?? 0;
          occupied +=
            (qty *
              Math.max(
                0,
                Math.min(+end, +new Date(event.at)) -
                  Math.max(+start, +(b.actualPickupAt ?? b.pickupAt)!),
              )) /
            86400000;
          remaining -= qty;
        }
        occupied +=
          (remaining *
            Math.max(
              0,
              Math.min(
                +end,
                b.actualReturnAt ? +b.actualReturnAt : Date.now(),
              ) - Math.max(+start, +(b.actualPickupAt ?? b.pickupAt)!),
            )) /
          86400000;
      }
    }
    return {
      name: e.name,
      occupiedUnitDays: occupied,
      capacityUnitDays:
        e.assets.filter((a) => a.status !== "RETIRED").length * days,
    };
  });
  return {
    actor: a,
    bookings: decorated,
    inventory,
    customers,
    vendors,
    settings: s,
    imports,
    users,
    audits,
    month,
    metrics: {
      bookings: live.length,
      cancelled: selected.filter((b) => b.status === "CANCELLED").length,
      revenue,
      collected,
      outstanding: live.reduce((n, b) => n + Math.max(0, b.balance ?? 0), 0),
      collectionRate: revenue ? collected / revenue : 0,
      outsourceCost,
      vendorPaid,
      afterOutsourcing: revenue - outsourceCost,
      average: live.filter((b) => b.total !== null).length
        ? revenue / live.filter((b) => b.total !== null).length
        : 0,
      unpaid: live.filter((b) =>
        ["Pending", "Partial"].includes(b.paymentStatus),
      ).length,
      missingAmount: live.filter((b) => b.total === null).length,
      attention: decorated.filter((b) => b.warnings.length || b.total === null)
        .length,
      maxDaily,
      maxMonthly: maxDaily * days,
      capacityRatio: maxDaily ? revenue / (maxDaily * days) : null,
      investment,
      payback: revenue ? investment / revenue : null,
      unpriced: inventory.filter((e) => e.rate === null).length,
      weekday,
      modes,
      cashIn: dated
        .filter((p) => p.kind === "RENTAL" && p.amount > 0)
        .reduce((n, p) => n + p.amount, 0),
      cashRefunds: dated
        .filter((p) => p.kind === "RENTAL" && p.amount < 0)
        .reduce((n, p) => n - p.amount, 0),
      depositMovement: dated
        .filter((p) => p.kind === "DEPOSIT")
        .reduce((n, p) => n + p.amount, 0),
      unknownPaymentDates: effectivePayments.filter((p) => !p.paidAt).length,
      utilization,
    },
  };
}
