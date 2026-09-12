import pg from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql>");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(readFileSync(file, "utf8"));
console.log(`Applied ${file}`);
await c.end();
