import { z } from "zod";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./auth";
import {
  availableQuantity,
  checkCapacity,
  locked,
  settings,
  audit,
} from "./service";
import { rentalDays } from "./domain";

export function rentalInterval(from: string, to: string) {
  const format = z.iso.datetime({ offset: true });
  const start = new Date(format.parse(from)),
    end = new Date(format.parse(to));
  if (
    +start < Date.now() - 60000 ||
    +end <= +start ||
    +end - +start > 90 * 86400000
  )
    throw new HttpError(
      400,
      "Choose future pickup and return times, up to 90 days apart",
    );
  return { start, end };
}

export async function customerCatalogue(
  from?: string | null,
  to?: string | null,
) {
  if (Boolean(from) !== Boolean(to))
    throw new HttpError(400, "Choose both pickup and return");
  const interval = from && to ? rentalInterval(from, to) : null;
  return db.$transaction(
    async (tx) => {
      const preferences = await settings(tx);
      const equipment = await tx.equipment.findMany({
        where: { assets: { some: { status: { not: "RETIRED" } } } },
        select: {
          id: true,
          name: true,
          category: true,
          rate: true,
          photo: { select: { updatedAt: true } },
        },
        orderBy: { name: "asc" },
      });
      const items = [];
      for (const e of equipment)
        items.push({
          ...e,
          photo: e.photo
            ? `/api/customer/photos/${encodeURIComponent(e.id)}?v=${encodeURIComponent(e.photo.updatedAt.toISOString())}`
            : null,
          available: interval
            ? await availableQuantity(tx, e.id, interval.start, interval.end)
            : null,
        });
      return {
        items,
        days: interval
          ? rentalDays(interval.start, interval.end, preferences.rentalPolicy)
          : null,
        businessName: preferences.businessName,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
}

export async function registerCustomer(input: unknown, source: string) {
  const v = z
    .object({
      name: z.string().trim().min(1).max(100),
      email: z
        .email()
        .max(254)
        .transform((s) => s.toLowerCase()),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[\d ()-]{8,25}$/, "Enter a valid phone number"),
      password: z.string().min(12).max(128),
    })
    .parse(input);
  const key = "register:" + createHash("sha256").update(source).digest("hex");
  const allowed = await locked(async (tx) => {
    const attempt = await tx.loginAttempt.findUnique({ where: { id: key } });
    if (attempt && attempt.resetAt > new Date() && attempt.count >= 5)
      return false;
    await tx.loginAttempt.upsert({
      where: { id: key },
      create: { id: key, count: 1, resetAt: new Date(Date.now() + 3600000) },
      update:
        attempt && attempt.resetAt > new Date()
          ? { count: { increment: 1 } }
          : { count: 1, resetAt: new Date(Date.now() + 3600000) },
    });
    return true;
  });
  if (!allowed)
    throw new HttpError(429, "Too many account attempts. Try again in an hour");
  const passwordHash = await hash(v.password, 12);
  // Create a new customer identity. An unverified email must never grant access to old business records.
  const account = await db.customerAccount.create({
    data: {
      email: v.email,
      name: v.name,
      passwordHash,
      customer: { create: { name: v.name, email: v.email, phones: [v.phone] } },
    },
    select: { id: true },
  });
  return { id: account.id };
}

export async function submitCustomerRequest(accountId: string, input: unknown) {
  const v = z
    .object({
      from: z.string(),
      to: z.string(),
      requestKey: z.uuid(),
      notes: z.string().trim().max(1000).default(""),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[\d ()-]{8,25}$/, "Enter a valid phone number")
        .optional(),
      items: z
        .array(
          z.object({
            equipmentId: z.string().min(1).max(100),
            quantity: z.number().int().min(1).max(50),
          }),
        )
        .min(1)
        .max(30),
    })
    .parse(input);
  const { start, end } = rentalInterval(v.from, v.to);
  if (new Set(v.items.map((i) => i.equipmentId)).size !== v.items.length)
    throw new HttpError(400, "Combine duplicate products");
  return locked(async (tx) => {
    const account = await tx.customerAccount.findUnique({
      where: { id: accountId },
    });
    if (!account?.active) throw new HttpError(401, "Please sign in again");
    const duplicate = await tx.booking.findUnique({
      where: {
        customerAccountId_requestKey: {
          customerAccountId: accountId,
          requestKey: v.requestKey,
        },
      },
      select: { id: true },
    });
    if (duplicate) return duplicate;
    if (
      (await tx.booking.count({
        where: {
          customerAccountId: accountId,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      })) >= 10
    )
      throw new HttpError(
        429,
        "You have reached today's request limit. Contact our team",
      );
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: account.customerId },
    });
    const phone = v.phone ?? customer.phones[0];
    if (!phone || !/^\+?[\d ()-]{8,25}$/.test(phone))
      throw new HttpError(400, "Add a valid contact phone number");
    if (v.phone)
      await tx.customer.update({
        where: { id: account.customerId },
        data: {
          phones: [...new Set([v.phone, ...customer.phones])],
          rawPhone: v.phone,
        },
      });
    const preferences = await settings(tx);
    const days = rentalDays(start, end, preferences.rentalPolicy);
    const lines = [];
    let total: number | null = 0;
    for (const item of v.items) {
      const e = await tx.equipment.findUnique({
        where: { id: item.equipmentId },
      });
      if (!e) throw new HttpError(400, "Product not found");
      await checkCapacity(tx, e.id, item.quantity, start, end);
      if (e.rate === null) total = null;
      else if (total !== null) total += e.rate * item.quantity * days;
      if (total !== null && total > 2_000_000_000)
        throw new HttpError(400, "Request exceeds supported amount");
      lines.push({
        equipmentId: e.id,
        quantity: item.quantity,
        rate: e.rate ?? 0,
        days,
      });
    }
    const booking = await tx.booking.create({
      data: {
        customerId: account.customerId,
        customerAccountId: account.id,
        requestKey: v.requestKey,
        pickupAt: start,
        returnAt: end,
        status: "DRAFT",
        total,
        notes: `Customer portal request — awaiting team confirmation.\nContact phone: ${phone}\n${v.notes}`,
        items: { create: lines },
      },
      select: { id: true },
    });
    await audit(
      tx,
      {
        id: account.id,
        role: "CUSTOMER",
        name: account.name,
        email: account.email,
      },
      "REQUEST",
      "Booking",
      booking.id,
      { source: "customer portal" },
    );
    return booking;
  });
}

export async function customerRequests(accountId: string) {
  return db.booking.findMany({
    where: { customerAccountId: accountId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      pickupAt: true,
      returnAt: true,
      total: true,
      items: {
        select: { quantity: true, equipment: { select: { name: true } } },
      },
    },
  });
}
