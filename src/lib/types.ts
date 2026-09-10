import type { Tier } from "./tier-logic";
import type { CreditCategory } from "./credit-rules";

export type Role = "management" | "pm" | "executive";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: Role;
  pm_id: string | null;
  join_date: string; // date
  current_tier: Tier;
  active: boolean;
  // Management-controlled manual flags for Tier S eligibility (§4.5)
  mentoring_capable: boolean;
  moral_conduct: boolean;
  avatar_url: string | null;
}

export interface CreditEntry {
  id: string;
  org_id: string;
  user_id: string;
  month: string; // first-of-month date
  category: CreditCategory;
  subcategory: string | null;
  credits: number; // can be negative
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface Flag {
  id: string;
  org_id: string;
  user_id: string;
  type: "yellow" | "red";
  reason: string;
  video_reference: string | null;
  issued_by: string;
  issued_at: string;
}

export interface AttendanceRecord {
  id: string;
  org_id: string;
  user_id: string;
  month: string;
  late_days: number;
  unexcused_absences: number;
  credit_awarded: number; // auto-computed §4.4
}

export interface PmBonusLog {
  id: string;
  org_id: string;
  pm_id: string;
  month: string;
  perfect_videos: number;
  mistake_videos: number;
  gross_bonus: number;
  deduction: number;
  net_bonus: number;
}

export interface TierHistory {
  id: string;
  org_id: string;
  user_id: string;
  tier: Tier;
  effective_date: string;
  reason: "promotion" | "demotion" | "initial";
}
