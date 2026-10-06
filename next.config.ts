import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "exceljs", "unzipper"],
  experimental: { cpus: 2 },
};
export default config;
