/**
 * Create a single real user (auth account + profile) in the CFM Wing org.
 *
 * Reads from env:
 *   EMAIL, PASSWORD, NAME, ROLE (management|pm|executive)
 *
 * Run:  node --env-file=.env.local scripts/create-user.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.EMAIL;
const password = process.env.PASSWORD;
const name = process.env.NAME ?? email;
const role = process.env.ROLE ?? "management";

if (!url || !serviceKey || !email || !password) {
  console.error("Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL, PASSWORD");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "cfm")
    .single();
  if (orgErr || !org) throw new Error("CFM Wing org missing — run migrations/seed first.");

  // Create or find the auth user.
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user?.id) {
    userId = created.user.id;
  } else if (createErr) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users?.find((x) => x.email === email)?.id;
    if (userId) {
      // Reset the password so the provided one works.
      await admin.auth.admin.updateUserById(userId, { password });
      console.log("(user already existed — password reset to the provided value)");
    } else {
      throw createErr;
    }
  }

  await admin.from("users").upsert({
    id: userId,
    org_id: org.id,
    name,
    email,
    role,
    current_tier: "D",
    mentoring_capable: role === "management",
    moral_conduct: true,
  });

  console.log(`\n✔ ${role} account ready: ${email}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
