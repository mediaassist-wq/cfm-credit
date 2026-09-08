import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstOfMonth } from "@/lib/dates";
import { type Tier } from "@/lib/tier-logic";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Tabs } from "@/components/Tabs";
import {
  CreditEntryForm,
  FlagForm,
  AttendanceForm,
  NegativeReviewForm,
  PmBonusForm,
  type Member,
} from "@/components/pm/PmForms";

export const dynamic = "force-dynamic";

export default async function PmDashboard() {
  const me = await getCurrentUser();
  if (me.role !== "pm" && me.role !== "management") {
    redirect(homePathForRole(me.role));
  }

  const supabase = createClient();
  const thisMonth = firstOfMonth();

  // A PM sees their own team; management sees all executives.
  let teamQuery = supabase
    .from("users")
    .select("id, name, current_tier, join_date")
    .eq("role", "executive")
    .eq("active", true);
  if (me.role === "pm") teamQuery = teamQuery.eq("pm_id", me.id);

  const [orgRes, teamRes, entriesRes, bonusRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", me.org_id).single(),
    teamQuery,
    supabase.from("credit_entries").select("user_id, credits").eq("month", thisMonth),
    supabase.from("pm_bonus_log").select("*").eq("pm_id", me.id).eq("month", thisMonth).maybeSingle(),
  ]);

  const orgName = orgRes.data?.name as string | undefined;
  const team = (teamRes.data ?? []) as Pick<AppUser, "id" | "name" | "current_tier" | "join_date">[];

  const monthTotals = new Map<string, number>();
  for (const e of (entriesRes.data ?? []) as { user_id: string; credits: number }[]) {
    monthTotals.set(e.user_id, (monthTotals.get(e.user_id) ?? 0) + e.credits);
  }

  const members: Member[] = team.map((t) => ({ id: t.id, name: t.name, tier: t.current_tier }));
  const bonus = bonusRes.data as
    | { perfect_videos: number; mistake_videos: number; net_bonus: number }
    | null;

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Team roster */}
          <Card title="My team" subtitle={`${team.length} executives · this month`} className="lg:col-span-3">
            {team.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No executives assigned yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {team.map((t) => {
                  const total = monthTotals.get(t.id) ?? 0;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <TierBadge tier={t.current_tier as Tier} size="sm" />
                      <Link
                        href={`/users/${t.id}`}
                        className="flex-1 text-sm font-medium text-slate-900 hover:underline"
                      >
                        {t.name}
                      </Link>
                      <span className="text-sm font-semibold text-slate-800">{total}</span>
                      <span className="text-xs text-slate-400">this mo.</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* PM bonus */}
          <Card title="My PM bonus" subtitle="This month (§4.7)" className="lg:col-span-2">
            {bonus && (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Logged: {bonus.perfect_videos} perfect / {bonus.mistake_videos} mistakes ·
                net <span className="font-bold">৳{bonus.net_bonus.toLocaleString()}</span>
              </p>
            )}
            <PmBonusForm
              pmId={me.id}
              defaults={bonus ? { perfect: bonus.perfect_videos, mistakes: bonus.mistake_videos } : undefined}
            />
          </Card>
        </div>

        {/* Action forms */}
        <Card title="Log activity">
          <Tabs
            tabs={[
              { label: "Credit entry", content: <CreditEntryForm members={members} /> },
              { label: "Issue flag", content: <FlagForm members={members} /> },
              { label: "Attendance", content: <AttendanceForm members={members} /> },
              { label: "Negative review", content: <NegativeReviewForm members={members} /> },
            ]}
          />
        </Card>
      </main>
    </div>
  );
}
