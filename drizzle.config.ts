import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED is required to run Drizzle migrations.");
}

const migrationDatabaseUrl = new URL(databaseUrl);
migrationDatabaseUrl.searchParams.set("sslmode", "verify-full");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: migrationDatabaseUrl.toString() },
  strict: true,
  verbose: true,
});
