/**
 * Tier thresholds and evaluation-cycle logic — PRD §4.5 & §4.6.
 *
 * NOTE: Tier S is NEVER auto-promoted. This module can mark an executive as an
 * "S candidate awaiting Management review", but the actual promotion to S must
 * be an explicit Management action in the UI (PRD §6).
 */

import { REQUIRED_PRODUCTION_KEYS } from "./credit-rules";

export type Tier = "D" | "C" | "B" | "A" | "S";

export const TIERS: Tier[] = ["D", "C", "B", "A", "S"];

export interface TierDef {
  tier: Tier;
  minCredits: number;
  label: string;
  extraConditions: string[];
}

// §4.5 — minimum credits/month + extra conditions
export const TIER_DEFS: Record<Tier, TierDef> = {
  D: { tier: "D", minCredits: 30, label: "Tier D", extraConditions: [] },
  C: { tier: "C", minCredits: 40, label: "Tier C", extraConditions: [] },
  B: {
    tier: "B",
    minCredits: 50,
    label: "Tier B",
    extraConditions: [
      "Attendance stable (≤5 late/month, 0 unexcused absences)",
      "All production types delivered at least once",
    ],
  },
  A: {
    tier: "A",
    minCredits: 60,
    label: "Tier A",
    extraConditions: [
      "All Tier B conditions",
      "0 flags in last 2 months",
      "≥8 months tenure",
    ],
  },
  S: {
    tier: "S",
    minCredits: 70,
    label: "Tier S",
    extraConditions: [
      "All Tier A conditions",
      "Mentoring capability (manual flag)",
      "Moral / ethical conduct (manual flag)",
      "Explicit Management approval (never auto-promoted)",
    ],
  },
};

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

/** The highest tier whose *credit threshold* a single month's total meets. */
export function tierForCredits(credits: number): Tier | null {
  let result: Tier | null = null;
  for (const t of TIERS) {
    if (credits >= TIER_DEFS[t].minCredits) result = t;
  }
  return result; // null => below Tier D floor (30)
}

// ── §4.6 Evaluation cycle ───────────────────────────────────────────────────

export interface MonthMetrics {
  month: string; // YYYY-MM-01
  credits: number;
  lateDays: number;
  unexcusedAbsences: number;
  deliveredProductionKeys: string[];
  flagCount: number; // flags issued in this month
}

export interface CycleInput {
  months: [MonthMetrics, MonthMetrics]; // two consecutive calendar months
  currentTier: Tier;
  tenureMonths: number;
  flagsInLastTwoMonths: number;
  // manual Management-controlled flags for S
  mentoringCapable: boolean;
  moralConduct: boolean;
}

export type CycleOutcome =
  | { kind: "promotion"; toTier: Tier; reason: string }
  | { kind: "demotion"; toTier: Tier; reason: string }
  | { kind: "hold"; reason: string }
  | { kind: "management_review"; reason: string } // below D floor OR S candidate
  | { kind: "s_candidate"; reason: string };

function meetsExtraConditions(
  tier: Tier,
  input: CycleInput,
): { ok: boolean; failed: string[] } {
  const failed: string[] = [];
  const { months, tenureMonths, flagsInLastTwoMonths, mentoringCapable, moralConduct } = input;

  const attendanceStable = months.every(
    (m) => m.lateDays <= 5 && m.unexcusedAbsences === 0,
  );
  const allProductionDelivered = months.some((m) =>
    REQUIRED_PRODUCTION_KEYS.every((k) => m.deliveredProductionKeys.includes(k)),
  );

  if (tier === "B" || tier === "A" || tier === "S") {
    if (!attendanceStable) failed.push("Attendance not stable (≤5 late, 0 unexcused)");
    if (!allProductionDelivered) failed.push("Not all production types delivered");
  }
  if (tier === "A" || tier === "S") {
    if (flagsInLastTwoMonths > 0) failed.push("Has flags in last 2 months");
    if (tenureMonths < 8) failed.push("Tenure < 8 months");
  }
  if (tier === "S") {
    if (!mentoringCapable) failed.push("Mentoring capability not confirmed");
    if (!moralConduct) failed.push("Moral/ethical conduct not confirmed");
  }
  return { ok: failed.length === 0, failed };
}

/**
 * Evaluate a completed 2-month cycle.
 *
 * CRITICAL (§4.6): both months must INDIVIDUALLY meet a threshold — never average.
 */
export function evaluateCycle(input: CycleInput): CycleOutcome {
  const { months, currentTier } = input;
  const [m1, m2] = months;

  // Below Tier D floor in EITHER month → management review (D is the floor).
  const floor = TIER_DEFS.D.minCredits;
  if (m1.credits < floor || m2.credits < floor) {
    return {
      kind: "management_review",
      reason: `Below Tier D floor (${floor}) in ${m1.credits < floor ? m1.month : m2.month}. Flagged for management review; no auto-demotion below D.`,
    };
  }

  // Highest tier BOTH months individually satisfy (credits only, first pass).
  const perMonthTier = (c: number) => tierForCredits(c);
  const t1 = perMonthTier(m1.credits);
  const t2 = perMonthTier(m2.credits);
  // Lowest of the two credit-tiers is the best both months reach.
  let bothReach: Tier = "D";
  for (const t of TIERS) {
    if (t1 && t2 && tierRank(t1) >= tierRank(t) && tierRank(t2) >= tierRank(t)) {
      bothReach = t;
    }
  }

  // Now walk down from bothReach to find the highest tier whose EXTRA
  // conditions also pass.
  let achievable: Tier = "D";
  for (let i = tierRank(bothReach); i >= 0; i--) {
    const t = TIERS[i];
    if (meetsExtraConditions(t, input).ok) {
      achievable = t;
      break;
    }
  }

  const curRank = tierRank(currentTier);
  const achRank = tierRank(achievable);

  // Tier S is a candidate flag only — never auto-promote.
  if (achievable === "S" && currentTier !== "S") {
    return {
      kind: "s_candidate",
      reason:
        "Both months meet all Tier S metrics. Awaiting explicit Management approval — the system does not auto-promote to S.",
    };
  }

  if (achRank > curRank) {
    return {
      kind: "promotion",
      toTier: achievable,
      reason: `Both months individually met ${TIER_DEFS[achievable].label} threshold and extra conditions. Promote at start of next cycle.`,
    };
  }
  if (achRank < curRank) {
    return {
      kind: "demotion",
      toTier: achievable,
      reason: `A month fell below ${TIER_DEFS[currentTier].label}. Demote to the highest tier actually met: ${TIER_DEFS[achievable].label}.`,
    };
  }
  return { kind: "hold", reason: `Maintained ${TIER_DEFS[currentTier].label}.` };
}

// ── §4.7 PM monthly bonus ───────────────────────────────────────────────────
export const PM_BONUS_BLOCK_SIZE = 6;
export const PM_BONUS_PER_BLOCK = 4000; // BDT
export const PM_MISTAKE_DEDUCTION = 4000; // BDT per video

export function pmNetBonus(perfectVideos: number, mistakeVideos: number): {
  grossBonus: number;
  deduction: number;
  netBonus: number;
} {
  const grossBonus = Math.floor(perfectVideos / PM_BONUS_BLOCK_SIZE) * PM_BONUS_PER_BLOCK;
  const deduction = mistakeVideos * PM_MISTAKE_DEDUCTION;
  const netBonus = Math.max(0, grossBonus - deduction);
  return { grossBonus, deduction, netBonus };
}
