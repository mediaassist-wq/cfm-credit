import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const id = "c506a14e-342e-4f10-a040-9d331abc832b"; // Karim
try {
  await c.query("begin");
  await c.query("delete from auth.users where id = $1", [id]);
  console.log("delete succeeded (rolling back)");
  await c.query("rollback");
} catch (e) {
  console.log("FK/DELETE error:");
  console.log("  message:", e.message);
  console.log("  detail :", e.detail);
  console.log("  table  :", e.table);
  console.log("  constraint:", e.constraint);
  await c.query("rollback");
}
await c.end();
