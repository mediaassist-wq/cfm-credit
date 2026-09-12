import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("select name, email, role, active from users order by role, name");
r.rows.forEach((u) => console.log(`${u.role.padEnd(11)} ${u.active ? "  " : "✗ "} ${u.name} <${u.email}>`));
await c.end();
