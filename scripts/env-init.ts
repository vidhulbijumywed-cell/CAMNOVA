import { existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const secret = () => randomBytes(24).toString("base64url");
  writeFileSync(
    ".env",
    [
      "DATABASE_URL=postgresql://camnova:camnova_local_only@localhost:5432/camnova",
      "NEXTAUTH_URL=http://localhost:3000",
      `NEXTAUTH_SECRET=${secret()}${secret()}`,
      "SEED_ADMIN_EMAIL=owner@example.test",
      `SEED_ADMIN_PASSWORD=${secret()}`,
      "SEED_STAFF_EMAIL=staff@example.test",
      `SEED_STAFF_PASSWORD=${secret()}`,
      "SEED_DEMO=true",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  console.log(
    "Created ignored .env with generated local credentials. Values are not printed.",
  );
} else console.log("Existing .env preserved.");
