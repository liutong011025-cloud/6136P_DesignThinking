import { config } from "dotenv";
import { defineConfig } from "prisma/config";
config({ path: ".env.local" });
config();
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/int6136p" }
});
