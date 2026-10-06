import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the path to the workbook");
  const adminUrl = new URL(process.env.DATABASE_URL!);
  adminUrl.pathname = "/postgres";
  const c = new Client({ connectionString: adminUrl.toString() });
  await c.connect();
  // This disposable database is exclusive to this check. Never use the application database.
  if (
    (
      await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [
        "camnova_import_test",
      ])
    ).rowCount
  )
    throw new Error(
      "camnova_import_test already exists; preserve or remove it explicitly before this check",
    );
  await c.query("CREATE DATABASE camnova_import_test");
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/camnova_import_test";
  process.env.DATABASE_URL = url.toString();
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "inherit",
  });
  if (migrate.status !== 0) throw new Error("Migration failed");
  const { db } = await import("../lib/db");
  const { previewImport, commitImport, rollbackImport } =
    await import("../lib/importer");
  try {
    const buffer = await readFile(path),
      p = await previewImport(buffer, "private-workbook.xlsx");
    if (
      p.bookings.some((b) => b.errors.length) ||
      p.inventory.some((i) => i.errors.length)
    )
      throw new Error(
        "Workbook has validation errors. Review privately in the app import wizard.",
      );
    const actor = {
      id: "private-check",
      role: "ADMIN",
      name: "Private check",
      email: "check@example.test",
    };
    const batch = await commitImport(
      actor,
      buffer,
      "private-workbook.xlsx",
      p.bookings.map((b) => b.row),
    );
    const imported = await db.booking.count(),
      items = await db.equipment.count();
    if (imported !== p.bookings.length || items !== p.inventory.length)
      throw new Error("Unexpected imported counts");
    let rejected = false;
    try {
      await commitImport(
        actor,
        buffer,
        "private-workbook.xlsx",
        p.bookings.map((b) => b.row),
      );
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Duplicate import was not rejected");
    await rollbackImport(actor, batch.id);
    if (
      (await db.booking.count()) ||
      (await db.customer.count()) ||
      (await db.equipment.count())
    )
      throw new Error("Rollback left private records");
    console.log(
      JSON.stringify({
        bookings: imported,
        inventory: items,
        duplicateRejected: true,
        rollbackClearedRecords: true,
      }),
    );
  } finally {
    await db.$disconnect();
    await c.query("DROP DATABASE camnova_import_test WITH (FORCE)");
    await c.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
