import "dotenv/config";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
async function main() {
  const original = process.env.DATABASE_URL;
  if (!original) throw new Error("DATABASE_URL required");
  const url = new URL(original);
  url.pathname = "/camnova_test";
  const adminUrl = new URL(original);
  adminUrl.pathname = "/postgres";
  const c = new Client({ connectionString: adminUrl.toString() });
  await c.connect();
  if (
    !(
      await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [
        "camnova_test",
      ])
    ).rowCount
  )
    await c.query("CREATE DATABASE camnova_test");
  await c.end();
  const env = { ...process.env, DATABASE_URL: url.toString() };
  for (const args of [
    ["prisma", "migrate", "deploy"],
    ["tsx", "--test", "tests/domain.test.ts"],
  ]) {
    const result = spawnSync("npx", args, { env, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
