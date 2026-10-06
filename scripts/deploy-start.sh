#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Render supplies its assigned HTTPS address. Other hosts must set NEXTAUTH_URL.
export NEXTAUTH_URL="${NEXTAUTH_URL:-${RENDER_EXTERNAL_URL:-}}"
export NODE_ENV=production
export SEED_DEMO="${SEED_DEMO:-false}"

node --input-type=module <<'JS'
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
let origin;
try {
  origin = new URL(process.env.NEXTAUTH_URL);
} catch {
  fail("Set NEXTAUTH_URL to the public HTTPS address, or deploy on Render.");
}
if (origin.protocol !== "https:" || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash) {
  fail("NEXTAUTH_URL must be a public HTTPS origin without a path or credentials.");
}
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  fail("Set a persistent random NEXTAUTH_SECRET of at least 32 characters.");
}
for (const key of ["SEED_ADMIN_PASSWORD", "SEED_STAFF_PASSWORD"]) {
  if (!process.env[key] || process.env[key].length < 12) {
    fail(`Set ${key} to a password of at least 12 characters before deployment.`);
  }
}
let database;
try {
  database = new URL(process.env.DATABASE_URL);
} catch {
  fail("Set DATABASE_URL to the hosted PostgreSQL connection string.");
}
if (!["postgres:", "postgresql:"].includes(database.protocol)) {
  fail("DATABASE_URL must be a PostgreSQL connection string.");
}
if (process.env.SEED_DEMO !== "false") {
  fail("Set SEED_DEMO=false for the hosted application.");
}
console.log("Production configuration checked.");
JS

npm run db:wait
npm run db:migrate
npm run db:seed
exec npm start
