/**
 * Runs the SQL migration files (and seed.sql) against the database in order.
 * Connection comes from the DATABASE_URL env var (never hard-coded / committed).
 *
 * Run:  $env:DATABASE_URL="postgresql://..."; node scripts/migrate.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

const FILES = [
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_functions.sql",
  "supabase/migrations/0003_rls.sql",
  "supabase/seed.sql",
];

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected.\n");
  for (const rel of FILES) {
    const sql = readFileSync(join(root, rel), "utf8");
    process.stdout.write(`Applying ${rel} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("\nAll migrations applied.");
}

main()
  .catch((e) => {
    console.error("\nMigration failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
