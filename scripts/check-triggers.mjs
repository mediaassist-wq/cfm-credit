import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  "select event_object_table as tbl, trigger_name from information_schema.triggers where trigger_name in ('trg_tier_history_immutable','trg_flags_immutable','trg_credit_entries_immutable') order by tbl",
);
if (r.rowCount === 0) console.log("No immutability DELETE triggers remain — cascade delete should work.");
else r.rows.forEach((x) => console.log("STILL PRESENT:", x.tbl, x.trigger_name));
await c.end();
