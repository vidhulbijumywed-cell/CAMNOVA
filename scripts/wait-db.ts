import "dotenv/config";
import { Client } from "pg";
async function main() {
  for (let i = 0; i < 30; i++) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("PostgreSQL is ready");
      return;
    } catch {
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("PostgreSQL did not become ready");
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
