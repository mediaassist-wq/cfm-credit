/**
 * Adds extra demo credit entries so the leaderboard has competition:
 * gives editor2 some credits this month, and both editors a prior month.
 * Idempotent-ish: safe to skip if already run (may create duplicates — dev only).
 *
 * Run:  node --env-file=.env.local scripts/demo-extra.mjs
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function firstOfMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function main() {
  const { data: org } = await admin.from("organizations").select("id").eq("slug", "cfm").single();
  const { data: users } = await admin
    .from("users")
    .select("id, email, pm_id")
    .in("email", ["editor1@cfm.test", "editor2@cfm.test", "pm@cfm.test"]);

  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const e1 = byEmail["editor1@cfm.test"].id;
  const e2 = byEmail["editor2@cfm.test"].id;
  const pm = byEmail["pm@cfm.test"].id;

  const now = new Date();
  const thisM = firstOfMonth(now);
  const lastM = firstOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const rows = [
    // editor2 this month — strong performer
    { user_id: e2, month: thisM, category: "production", subcategory: "ai_long_form", credits: 12, note: "AI long-form", created_by: pm },
    { user_id: e2, month: thisM, category: "production", subcategory: "yt_long_form_th_basic", credits: 10, note: "YT talking head", created_by: pm },
    { user_id: e2, month: thisM, category: "production", subcategory: "ads_standard", credits: 10, note: "Standard ad", created_by: pm },
    { user_id: e2, month: thisM, category: "bonus", subcategory: "mentorship", credits: 5, note: "Ran a workshop", created_by: pm },
    { user_id: e2, month: thisM, category: "bonus", subcategory: "zero_comment_long_form", credits: 2, note: "Zero comments", created_by: pm },
    // last month for both
    { user_id: e1, month: lastM, category: "production", subcategory: "ai_long_form", credits: 12, note: "AI long-form", created_by: pm },
    { user_id: e1, month: lastM, category: "production", subcategory: "podcast_full_cut", credits: 3, note: "Podcast", created_by: pm },
    { user_id: e1, month: lastM, category: "bonus", subcategory: "client_appraisal", credits: 4, note: "Client praise", created_by: pm },
    { user_id: e2, month: lastM, category: "production", subcategory: "ai_long_form", credits: 12, note: "AI long-form", created_by: pm },
    { user_id: e2, month: lastM, category: "production", subcategory: "ads_standard", credits: 10, note: "Standard ad", created_by: pm },
  ].map((r) => ({ ...r, org_id: org.id }));

  const { error } = await admin.from("credit_entries").insert(rows);
  if (error) throw error;
  console.log(`✔ inserted ${rows.length} extra demo credit entries`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
