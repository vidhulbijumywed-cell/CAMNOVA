import "dotenv/config";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 60000,
  testDir: "tests",
  testMatch: "*.e2e.ts",
  workers: 1,
  use: {
    baseURL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
  },
  reporter: "list",
});
