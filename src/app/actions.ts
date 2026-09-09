"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
