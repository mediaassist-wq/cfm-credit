/**
 * Add real editors (executives) to the CFM Wing org.
 * Creates a Supabase Auth user + profile + initial tier_history for each.
 * Idempotent: re-running updates the profile and resets the password.
 *
 * Run:  node --env-file=.env.local scripts/add-editors.mjs
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PASSWORD = "Cfm@2026"; // shared default — ask editors to change later

// name -> email local part
const EDITORS = [
  { name: "Omar", slug: "omar" },
  { name: "Jaber", slug: "jaber" },
  { name: "Laden", slug: "laden" },
  { name: "Sourav Roy", slug: "souravroy" },
  { name: "Bellal", slug: "bellal" },
  { name: "Abiuz", slug: "abiuz" },
  { name: "Shariful", slug: "shariful" },
];
const DOMAIN = "cfm.team";

async function main() {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "cfm")
    .single();
  if (orgErr || !org) throw new Error("CFM Wing org missing — run migrations/seed first.");

  // created_by for tier_history: the management account (fallback: the user itself).
  const { data: mgmt } = await admin
    .from("users")
    .select("id")
    .eq("org_id", org.id)
    .eq("role", "management")
    .limit(1)
    .maybeSingle();

  for (const e of EDITORS) {
    const email = `${e.slug}@${DOMAIN}`;

    let userId;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created?.user?.id) {
      userId = created.user.id;
    } else if (createErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users?.find((x) => x.email === email)?.id;
      if (userId) await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
      else throw createErr;
    }

    await admin.from("users").upsert({
      id: userId,
      org_id: org.id,
      name: e.name,
      email,
      role: "executive",
      pm_id: null,
      current_tier: "D",
      mentoring_capable: false,
      moral_conduct: true,
    });

    // Seed an initial tier row only if the editor has none yet.
    const { count } = await admin
      .from("tier_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!count) {
      await admin.from("tier_history").insert({
        org_id: org.id,
        user_id: userId,
        tier: "D",
        reason: "initial",
        created_by: mgmt?.id ?? userId,
      });
    }

    console.log(`✔ ${e.name.padEnd(12)} ${email}`);
  }

  console.log(`\nDone. ${EDITORS.length} editors. Shared password: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
