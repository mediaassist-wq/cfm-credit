import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = process.argv[2] || "imam@gmail.com";
const { data: u } = await admin.from("users").select("id, name, email").eq("email", email).single();
if (!u) { console.log("no such user"); process.exit(0); }
console.log("Deleting", u.name, u.email, u.id);
const { data, error } = await admin.auth.admin.deleteUser(u.id);
console.log("error:", error ? JSON.stringify(error) : "none");
console.log("data:", JSON.stringify(data));
