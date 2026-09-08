/**
 * CFM Credit Rules — hard-coded from CFM-SOP-EXEC-001 (v4.0), PRD §4.
 *
 * These values are the single source of truth on the client/server side.
 * The database enforces the same numbers via triggers (see
 * supabase/migrations/0003_functions.sql). Keep the two in sync if ever changed.
 */

// ── §4 Category taxonomy ────────────────────────────────────────────────────
export type CreditCategory =
  | "production"
  | "bonus"
  | "penalty"
  | "attendance"
  | "adjustment";

export const CREDIT_CATEGORIES: { value: CreditCategory; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "bonus", label: "Bonus" },
  { value: "penalty", label: "Penalty" },
  { value: "attendance", label: "Attendance" },
  { value: "adjustment", label: "Adjustment / Correction" },
];

// ── §4.1 Production credits (per delivered item) ────────────────────────────
// `null` credits => PM must enter the value manually.
export interface ProductionType {
  key: string;
  label: string;
  credits: number | null;
}

export const PRODUCTION_TYPES: ProductionType[] = [
  { key: "ai_long_form", label: "AI-Generated Long-Form Video", credits: 12 },
  { key: "yt_long_form_th_basic", label: "YouTube Long-Form Talking Head (Basic)", credits: 10 },
  { key: "podcast_full_cut", label: "Podcast Full Cut (Basic/Regular)", credits: 3 },
  { key: "podcast_trailer", label: "Podcast Trailer Edit", credits: 2 },
  { key: "ads_standard", label: "Advertisements (Standard)", credits: 10 },
  { key: "other_long_form", label: "Other Long-Form / Talking Head", credits: null },
  { key: "other_ads", label: "Other Advertisements", credits: null },
];

/** The production types that must each be delivered at least once for Tier B+ (§4.5). */
export const REQUIRED_PRODUCTION_KEYS = [
  "ai_long_form",
  "yt_long_form_th_basic",
  "podcast_full_cut",
  "podcast_trailer",
  "ads_standard",
] as const;

// ── §4.2 Bonus credits ──────────────────────────────────────────────────────
export interface BonusType {
  key: string;
  label: string;
  credits: number; // for pm_discretionary this is the MAX (partial allowed)
  isMax?: boolean;
  condition: string;
}

export const BONUS_TYPES: BonusType[] = [
  { key: "client_appraisal", label: "Client Appraisal", credits: 4, condition: "Approved first submission, no revisions" },
  { key: "zero_comment_long_form", label: "Zero-Comment Long-Form Acceptance", credits: 2, condition: "First submission, zero comments" },
  { key: "zero_comment_trailer", label: "Zero-Comment Trailer Acceptance", credits: 1, condition: "First submission, zero comments" },
  { key: "mentorship", label: "Mentorship / Workshop Delivery", credits: 5, condition: "Conducted training / mentoring" },
  { key: "pm_discretionary", label: "PM Discretionary Bonus", credits: 5, isMax: true, condition: "PM judgment — up to +5 (partial allowed, no justification required)" },
  { key: "attendance_perfect", label: "Attendance (Perfect Month)", credits: 5, condition: "0 late, 0 absences (see §4.4 sliding scale)" },
];

export const PM_DISCRETIONARY_MAX = 5;

// ── §4.3 Penalties (auto-deduct on flag/event creation) ─────────────────────
export const PENALTIES = {
  yellow_flag: -3,
  red_flag: -6,
  negative_client_review: -4,
  unexcused_absence: -3,
} as const;

export type PenaltyKey = keyof typeof PENALTIES;

export const PENALTY_LABELS: Record<PenaltyKey, string> = {
  yellow_flag: "Yellow Flag",
  red_flag: "Red Flag",
  negative_client_review: "Negative Client Review",
  unexcused_absence: "Unexcused Absence",
};

// ── §4.4 Attendance credit sliding scale ────────────────────────────────────
/**
 * Mutually exclusive with §4.2's flat "perfect month" bonus — same line item.
 * Returns { credit, disciplinary } where disciplinary=true means the UI must
 * flag further disciplinary action.
 */
export function attendanceCredit(lateDays: number, unexcusedAbsences: number): {
  credit: number;
  disciplinary: boolean;
} {
  if (lateDays === 0 && unexcusedAbsences === 0) return { credit: 5, disciplinary: false };
  if (lateDays >= 1 && lateDays <= 5) return { credit: 2, disciplinary: false };
  // More than 5 late days
  return { credit: 0, disciplinary: true };
}

export const ATTENDANCE_MAX = 5;
