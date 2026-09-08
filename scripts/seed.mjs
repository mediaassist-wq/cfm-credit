/**
 * Seed demo users + a few credit entries for local development.
 *
 * Creates Supabase Auth users (via the admin API) and their matching
 * public.users profile rows in the CFM Wing org.
 *
 * Prereqs:
 *   1. Migrations + supabase/seed.sql already applied.
 *   2. .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run:  node --env-file=.env.local scripts/seed.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "cfm-demo-1234"; // change after first login

const DEMO_USERS = [
  { key: "mgmt", email: "founder@cfm.test", name: "Founder", role: "management" },
  { key: "pm", email: "pm@cfm.test", name: "Priya (PM)", role: "pm" },
  { key: "exec1", email: "editor1@cfm.test", name: "Rahim (Editor)", role: "executive", pm: "pm", tier: "C" },
  { key: "exec2", email: "editor2@cfm.test", name: "Karim (Editor)", role: "executive", pm: "pm", tier: "B" },
];

async function main() {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "cfm")
    .single();
  if (orgErr || !org) throw new Error("Run supabase/seed.sql first (CFM Wing org missing).");
  const orgId = org.id;

  const ids = {};

  for (const u of DEMO_USERS) {
    // Create (or find) the auth user.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });

    let userId = created?.user?.id;
    if (createErr) {
      // Likely already exists — look it up.
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users?.find((x) => x.email === u.email)?.id;
      if (!userId) throw createErr;
    }
    ids[u.key] = userId;

    await admin.from("users").upsert({
      id: userId,
      org_id: orgId,
      name: u.name,
      email: u.email,
      role: u.role,
      pm_id: u.pm ? ids[u.pm] : null,
      current_tier: u.tier ?? "D",
      mentoring_capable: u.role === "pm",
      moral_conduct: true,
    });

    // Record an initial tier_history row.
    await admin.from("tier_history").insert({
      org_id: orgId,
      user_id: userId,
      tier: u.tier ?? "D",
      reason: "initial",
      created_by: ids.mgmt ?? userId,
    });

    console.log(`✔ ${u.role.padEnd(10)} ${u.email}`);
  }

  // A few credit entries this month for exec1 so the dashboard isn't empty.
  const month = new Date();
  const firstOfMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;

  await admin.from("credit_entries").insert([
    { org_id: orgId, user_id: ids.exec1, month: firstOfMonth, category: "production", subcategory: "ai_long_form", credits: 12, note: "AI long-form", created_by: ids.pm },
    { org_id: orgId, user_id: ids.exec1, month: firstOfMonth, category: "production", subcategory: "ads_standard", credits: 10, note: "Standard ad", created_by: ids.pm },
    { org_id: orgId, user_id: ids.exec1, month: firstOfMonth, category: "bonus", subcategory: "client_appraisal", credits: 4, note: "First-submission approval", created_by: ids.pm },
    { org_id: orgId, user_id: ids.exec1, month: firstOfMonth, category: "bonus", subcategory: "pm_discretionary", credits: 3, note: "Great turnaround", created_by: ids.pm },
  ]);

  // Attendance (triggers auto-compute the +5) and a yellow flag (auto −3).
  await admin.from("attendance_records").insert({
    org_id: orgId, user_id: ids.exec1, month: firstOfMonth, late_days: 0, unexcused_absences: 0, created_by: ids.pm,
  });
  await admin.from("flags").insert({
    org_id: orgId, user_id: ids.exec1, type: "yellow", reason: "Missed a delivery checklist item", issued_by: ids.pm,
  });

  console.log("\nDone. Demo password:", PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
