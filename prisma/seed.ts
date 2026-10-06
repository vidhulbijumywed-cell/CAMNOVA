import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "../lib/db";
import inventory from "./inventory.json";
import { defaultSettings } from "../lib/domain";
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD,
    staffPassword = process.env.SEED_STAFF_PASSWORD;
  if (
    !password ||
    password.length < 12 ||
    !staffPassword ||
    staffPassword.length < 12
  )
    throw new Error(
      "Set strong SEED_ADMIN_PASSWORD and SEED_STAFF_PASSWORD before seeding",
    );
  const owner = await db.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? "owner@example.test" },
    update: {},
    create: {
      email: process.env.SEED_ADMIN_EMAIL ?? "owner@example.test",
      name: "CAMNOVA Owner",
      role: "ADMIN",
      passwordHash: await hash(password, 12),
    },
  });
  await db.user.upsert({
    where: { email: process.env.SEED_STAFF_EMAIL ?? "staff@example.test" },
    update: {},
    create: {
      email: process.env.SEED_STAFF_EMAIL ?? "staff@example.test",
      name: "Rental Staff",
      role: "STAFF",
      passwordHash: await hash(staffPassword, 12),
    },
  });
  await db.setting.upsert({
    where: { id: "business" },
    update: {},
    create: { id: "business", value: defaultSettings },
  });
  for (const item of inventory) {
    const { quantity, ...data } = item;
    await db.equipment.upsert({
      where: { name: item.name },
      update: {},
      create: {
        ...data,
        assets: {
          create: Array.from({ length: quantity }, () => ({
            purchaseCost: data.purchaseCost,
          })),
        },
      },
    });
  }
  // Fictional customers only. Demo seeding is idempotent and does not reset application data.
  if (process.env.SEED_DEMO === "true" && (await db.booking.count()) === 0) {
    const camera = await db.equipment.findUniqueOrThrow({
        where: { name: "SONY A7M4" },
      }),
      lens = await db.equipment.findUniqueOrThrow({
        where: { name: "SIGMA 24-70 F/2.8" },
      });
    const now = new Date(),
      base = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 4, 30),
      );
    const names = [
      "Avery Studio",
      "Northlight Films",
      "River Frame",
      "Mira Creative",
      "Atlas Productions",
      "Lumen Collective",
      "Frame House",
      "Vista Studio",
    ];
    for (let i = 0; i < names.length; i++) {
      const customer = await db.customer.create({
        data: {
          name: names[i],
          phones: [],
          email: `demo${i + 1}@example.test`,
          notes: "Fictional demonstration customer",
        },
      });
      const pickup = new Date(+base + (i * 2 + 1) * 86400000),
        ret = new Date(+pickup + 86400000),
        total = (i % 2 ? 3000 : 2500) * 100;
      const returned = ret < now;
      const b = await db.booking.create({
        data: {
          customerId: customer.id,
          bookingDate: pickup,
          pickupAt: pickup,
          returnAt: ret,
          status: returned ? "RETURNED" : "BOOKED",
          actualReturnAt: returned ? ret : null,
          actualPickupAt: returned ? pickup : null,
          dueAt: ret,
          total,
          negotiated: true,
          referral: i % 2 ? "Instagram" : "Customer referral",
          notes: "Fictional demonstration booking",
          items: {
            create: [
              {
                equipmentId: camera.id,
                quantity: 1,
                rate: camera.rate!,
                days: 1,
                returned: returned ? 1 : 0,
              },
              {
                equipmentId: lens.id,
                quantity: 1,
                rate: lens.rate!,
                days: 1,
                returned: returned ? 1 : 0,
              },
            ],
          },
          payments:
            i % 3 === 0
              ? undefined
              : {
                  create: {
                    amount: i % 3 === 1 ? total : 100000,
                    kind: "RENTAL",
                    mode: i % 2 ? "UPI" : "Cash",
                    paidAt: pickup,
                    recordedBy: owner.id,
                  },
                },
          checklist: returned
            ? {
                events: [
                  { action: "RETURN", at: ret.toISOString(), items: [] },
                ],
              }
            : {},
        },
      });
      if (returned) {
        const items = await db.bookingItem.findMany({
          where: { bookingId: b.id },
        });
        await db.booking.update({
          where: { id: b.id },
          data: {
            checklist: {
              events: [
                {
                  action: "RETURN",
                  at: ret.toISOString(),
                  items: items.map((item) => ({
                    id: item.id,
                    quantity: item.quantity,
                  })),
                },
              ],
            },
          },
        });
      }
    }
    await db.vendor.create({
      data: {
        name: "Orbit Equipment (demo)",
        notes: "Fictional demonstration vendor",
      },
    });
  }
  console.log(
    "Seed complete: inventory and fictional demo records prepared. Existing passwords and records preserved.",
  );
}
main().finally(() => db.$disconnect());
