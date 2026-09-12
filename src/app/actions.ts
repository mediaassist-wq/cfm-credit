"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  BONUS_TYPES,
  PM_DISCRETIONARY_MAX,
  type CreditCategory,
} from "@/lib/credit-rules";
import type { Tier } from "@/lib/tier-logic";

/** Convert a `type="month"` value (YYYY-MM) to a first-of-month date string. */
function monthToFirst(month: string | null): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Log a credit entry (production / bonus / adjustment).
 * Credits are resolved server-side from the SOP rules so the client can't
 * fabricate a value; only manual/PM-assigned types accept a typed amount.
 */
export async function addCreditEntry(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const category = String(formData.get("category") ?? "") as CreditCategory;
  const subKey = String(formData.get("subcategory") ?? "");
  const manualAmount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const month = monthToFirst(formData.get("month") as string | null);

  let credits = 0;
  let subcategory: string | null = subKey || null;

  if (category === "production") {
    // Amount is editable in the UI (pre-filled with the SOP suggestion), so
    // trust the submitted value.
    credits = manualAmount;
  } else if (category === "bonus") {
    const b = BONUS_TYPES.find((x) => x.key === subKey);
    if (b?.key === "pm_discretionary") {
      credits = Math.max(0, Math.min(PM_DISCRETIONARY_MAX, manualAmount));
    } else {
      credits = manualAmount;
    }
  } else if (category === "adjustment") {
    credits = manualAmount; // may be negative (offsetting correction)
    subcategory = subKey || "adjustment";
  } else {
    // penalty/attendance are created via issueFlag / recordAttendance
    throw new Error("Use the flag or attendance form for this category.");
  }

  const { error } = await supabase.from("credit_entries").insert({
    org_id: me.org_id,
    user_id: userId,
    month,
    category,
    subcategory,
    credits,
    note,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/pm");
  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

/**
 * Manually deduct points from an executive (manager's discretion). Enter a
 * positive amount; it is stored as a negative penalty entry.
 */
export async function deductPoints(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  const reason = String(formData.get("note") ?? "").trim() || "Manual deduction";
  const month = monthToFirst(formData.get("month") as string | null);

  if (!(amount > 0)) throw new Error("Enter how many points to deduct.");

  const { error } = await supabase.from("credit_entries").insert({
    org_id: me.org_id,
    user_id: userId,
    month,
    category: "penalty",
    subcategory: "manual_deduction",
    credits: -amount,
    note: reason,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/pm");
  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

/**
 * Month-end reconciliation: append a signed adjustment (+/-) to an executive's
 * month with a reason. Positive adds points, negative removes them. Keeps the
 * ledger immutable (this is a new offsetting entry, not an edit). PM/Management.
 */
export async function adjustPoints(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") throw new Error("Not allowed.");
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const amount = Math.trunc(Number(formData.get("amount") ?? 0));
  const reason = String(formData.get("note") ?? "").trim();
  const month = monthToFirst(formData.get("month") as string | null);

  if (!amount) throw new Error("Enter a non-zero amount (use a minus sign to reduce).");
  if (!reason) throw new Error("A reason is required for an adjustment.");

  const { error } = await supabase.from("credit_entries").insert({
    org_id: me.org_id,
    user_id: userId,
    month,
    category: "adjustment",
    subcategory: "month_end_adjustment",
    credits: amount,
    note: reason,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/users/${userId}`);
  revalidatePath("/pm");
  revalidatePath("/management");
}

/** Edit a ledger entry (credits, item label, note). PM/Management only. */
export async function updateCreditEntry(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") throw new Error("Not allowed.");
  const supabase = createClient();

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const credits = Math.trunc(Number(formData.get("credits") ?? 0));
  const subcategory = String(formData.get("subcategory") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const { error } = await supabase
    .from("credit_entries")
    .update({ credits, subcategory, note })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/users/${userId}`);
  revalidatePath("/pm");
  revalidatePath("/management");
}

/** Delete a ledger entry. PM/Management only. */
export async function deleteCreditEntry(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") throw new Error("Not allowed.");
  const supabase = createClient();

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("user_id") ?? "");

  const { error } = await supabase.from("credit_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/users/${userId}`);
  revalidatePath("/pm");
  revalidatePath("/management");
}

/** Issue a flag. A DB trigger auto-deducts the penalty into the ledger. */
export async function issueFlag(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const type = String(formData.get("type") ?? "") as "yellow" | "red";
  const reason = String(formData.get("reason") ?? "").trim();
  const videoRef = String(formData.get("video_reference") ?? "").trim() || null;

  if (!reason) throw new Error("A reason is required to issue a flag.");

  const { error } = await supabase.from("flags").insert({
    org_id: me.org_id,
    user_id: userId,
    type,
    reason,
    video_reference: videoRef,
    issued_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/pm");
  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

/**
 * Remove (void) a flag and reverse its penalty. The flag is kept but marked
 * voided (and hidden from lists); an offsetting +credit entry restores the
 * points the flag deducted. PM/Management only.
 */
export async function removeFlag(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();
  const flagId = String(formData.get("flag_id") ?? "");

  const { data: flag, error: fErr } = await supabase
    .from("flags")
    .select("*")
    .eq("id", flagId)
    .single();
  if (fErr || !flag) throw new Error("Flag not found.");
  if (flag.voided) return; // already removed

  const { error: vErr } = await supabase
    .from("flags")
    .update({ voided: true, voided_at: new Date().toISOString(), voided_by: me.id })
    .eq("id", flagId);
  if (vErr) throw new Error(vErr.message);

  // Reverse the penalty (yellow −3, red −6) with an offsetting entry.
  const reversal = flag.type === "red" ? 6 : 3;
  const month = new Date(flag.issued_at);
  const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;

  const { error: cErr } = await supabase.from("credit_entries").insert({
    org_id: me.org_id,
    user_id: flag.user_id,
    month: monthStr,
    category: "adjustment",
    subcategory: "flag_reversal",
    credits: reversal,
    note: `Removed ${flag.type} flag: ${flag.reason}`,
    created_by: me.id,
  });
  if (cErr) throw new Error(cErr.message);

  revalidatePath("/management");
  revalidatePath("/pm");
  revalidatePath(`/users/${flag.user_id}`);
}

/** Log a negative client review (−4 penalty) as a ledger entry. */
export async function logNegativeReview(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || "Negative client review";
  const month = monthToFirst(formData.get("month") as string | null);

  const { error } = await supabase.from("credit_entries").insert({
    org_id: me.org_id,
    user_id: userId,
    month,
    category: "penalty",
    subcategory: "negative_client_review",
    credits: -4,
    note,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pm");
  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

/** Record monthly attendance. Triggers compute the credit + absence penalty. */
export async function recordAttendance(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const month = monthToFirst(formData.get("month") as string | null);
  const lateDays = Math.max(0, Number(formData.get("late_days") ?? 0));
  const unexcused = Math.max(0, Number(formData.get("unexcused_absences") ?? 0));

  const { error } = await supabase.from("attendance_records").insert({
    org_id: me.org_id,
    user_id: userId,
    month,
    late_days: lateDays,
    unexcused_absences: unexcused,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/pm");
  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

/** Log/update a PM's monthly bonus. Triggers compute gross/deduction/net. */
export async function logPmBonus(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const pmId = String(formData.get("pm_id") ?? me.id);
  const month = monthToFirst(formData.get("month") as string | null);
  const perfect = Math.max(0, Number(formData.get("perfect_videos") ?? 0));
  const mistakes = Math.max(0, Number(formData.get("mistake_videos") ?? 0));

  const { error } = await supabase.from("pm_bonus_log").upsert(
    {
      org_id: me.org_id,
      pm_id: pmId,
      month,
      perfect_videos: perfect,
      mistake_videos: mistakes,
      created_by: me.id,
    },
    { onConflict: "pm_id,month" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/pm");
}

/**
 * Record a tier change (promotion/demotion/initial). Inserting a tier_history
 * row syncs users.current_tier via trigger. RLS blocks a non-management user
 * from writing tier 'S'.
 */
export async function changeTier(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const tier = String(formData.get("tier") ?? "") as Tier;
  const reason = String(formData.get("reason") ?? "promotion") as
    | "promotion"
    | "demotion"
    | "initial";

  const { error } = await supabase.from("tier_history").insert({
    org_id: me.org_id,
    user_id: userId,
    tier,
    reason,
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}

// ── Editor management (PM / Management) ─────────────────────────────────────

/** Create a new editor (auth account + profile). PM/Management only. */
export async function addEditor(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") throw new Error("Not allowed.");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const admin = createAdmin();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    throw new Error(createErr?.message ?? "Could not create the account (email may already exist).");
  }
  const userId = created.user.id;

  const { error: profErr } = await admin.from("users").insert({
    id: userId,
    org_id: me.org_id,
    name,
    email,
    role: "executive",
    // A PM owns the editors they add; management leaves them unassigned.
    pm_id: me.role === "pm" ? me.id : null,
    current_tier: "D",
    moral_conduct: true,
  });
  if (profErr) {
    // Roll back the orphaned auth user so a retry can succeed.
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profErr.message);
  }

  await admin.from("tier_history").insert({
    org_id: me.org_id,
    user_id: userId,
    tier: "D",
    reason: "initial",
    created_by: me.id,
  });

  revalidatePath("/editors");
  revalidatePath("/pm");
}

/** Deactivate or reactivate an editor. PM/Management only (must manage them). */
export async function setEditorActive(formData: FormData) {
  const me = await getCurrentUser();
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  // RLS (users_update) already restricts this to management or the owning PM.
  const { error } = await supabase.from("users").update({ active }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/editors");
  revalidatePath("/pm");
  revalidatePath("/management");
}

// ── Self-service profile ────────────────────────────────────────────────────

/** Update a display name + avatar. Allowed for the user themselves or a manager. */
export async function updateProfile(formData: FormData) {
  const me = await getCurrentUser();
  const userId = String(formData.get("user_id") ?? me.id);
  const name = String(formData.get("name") ?? "").trim();
  const avatarUrl = formData.get("avatar_url");

  const isSelf = userId === me.id;
  const canManage = me.role === "management" || me.role === "pm";
  if (!isSelf && !canManage) throw new Error("Not allowed.");

  const patch: Record<string, string | null> = {};
  if (name) patch.name = name;
  if (typeof avatarUrl === "string") patch.avatar_url = avatarUrl || null;
  if (Object.keys(patch).length === 0) return;

  // Service role: we enforce the who-can-edit check above and only touch
  // name/avatar_url here (never role/tier).
  const admin = createAdmin();
  const { error } = await admin.from("users").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/account");
  revalidatePath(`/users/${userId}`);
  revalidatePath("/editors");
}

/** Change the signed-in user's own password. */
export async function changePassword(formData: FormData) {
  const supabase = createClient();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** Management toggles the manual Tier S eligibility flags on an executive. */
export async function setEligibilityFlag(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "management") throw new Error("Management only.");
  const supabase = createClient();

  const userId = String(formData.get("user_id") ?? "");
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "") === "true";
  if (field !== "mentoring_capable" && field !== "moral_conduct") {
    throw new Error("Invalid field.");
  }

  const { error } = await supabase
    .from("users")
    .update({ [field]: value })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/management");
  revalidatePath(`/users/${userId}`);
}
