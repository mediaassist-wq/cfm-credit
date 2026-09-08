import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lastNMonths, firstOfMonth } from "@/lib/dates";
import { TIERS, TIER_DEFS, type Tier } from "@/lib/tier-logic";
import type { AppUser, Flag } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Leaderboard, type LeaderboardRow } from "@/components/Leaderboard";
import { Tabs } from "@/components/Tabs";
import {
  CreditEntryForm,
  FlagForm,
  AttendanceForm,
  NegativeReviewForm,
  type Member,
} from "@/components/pm/PmForms";
import { changeTier } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ManagementDashboard() {
  const user = await getCurrentUser();
  if (user.role !== "management") {
    redirect(homePathForRole(user.role));
  }

  const supabase = createClient();
  const months = lastNMonths(6);
  const earliest = months[0];
  const thisMonth = firstOfMonth();

  const [orgRes, execRes, entriesRes, flagsRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", user.org_id).single(),
    supabase
      .from("users")
      .select("id, name, current_tier, join_date, mentoring_capable, moral_conduct")
      .eq("role", "executive")
      .eq("active", true),
    supabase.from("credit_entries").select("user_id, month, credits").gte("month", earliest),
    supabase.from("flags").select("*").order("issued_at", { ascending: false }).limit(25),
  ]);

  const orgName = orgRes.data?.name as string | undefined;
  const execs = (execRes.data ?? []) as (Pick<
    AppUser,
    "id" | "name" | "current_tier" | "join_date" | "mentoring_capable" | "moral_conduct"
  >)[];
  const entries = (entriesRes.data ?? []) as { user_id: string; month: string; credits: number }[];
  const flags = (flagsRes.data ?? []) as Flag[];

  const nameById = new Map(execs.map((e) => [e.id, e.name]));

  // Aggregate.
  const totals = new Map<string, number>();
  const activeMonths = new Map<string, Set<string>>();
  for (const e of entries) {
    totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.credits);
    const set = activeMonths.get(e.user_id) ?? new Set<string>();
    set.add(e.month);
    activeMonths.set(e.user_id, set);
  }

  const rows: LeaderboardRow[] = execs
    .map((ex) => ({
      userId: ex.id,
      name: ex.name,
      tier: ex.current_tier,
      total6mo: totals.get(ex.id) ?? 0,
      thisMonth: 0,
      monthsActive: activeMonths.get(ex.id)?.size ?? 0,
    }))
    .sort((a, b) => b.total6mo - a.total6mo);

  const dist: Record<Tier, number> = { D: 0, C: 0, B: 0, A: 0, S: 0 };
  for (const ex of execs) dist[ex.current_tier]++;
  const totalExecs = execs.length || 1;

  // Tier S candidates: at Tier A with both manual eligibility flags confirmed.
  const sCandidates = execs.filter(
    (e) => e.current_tier === "A" && e.mentoring_capable && e.moral_conduct,
  );

  const members: Member[] = execs.map((e) => ({
    id: e.id,
    name: e.name,
    tier: e.current_tier,
  }));

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={user} orgName={orgName} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Best Executive leaderboard" subtitle="6-month cumulative credits (§5.4)" className="lg:col-span-2">
            <Leaderboard rows={rows} />
          </Card>

          <Card title="Tier distribution" subtitle={`${execs.length} executives`}>
            <div className="space-y-3">
              {TIERS.map((t) => {
                const count = dist[t];
                const pct = Math.round((count / totalExecs) * 100);
                return (
                  <div key={t} className="flex items-center gap-3">
                    <TierBadge tier={t} size="sm" />
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-8 text-right text-sm font-medium text-slate-700">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Log activity — allocate credits, flags, attendance for any executive */}
        <Card title="Log activity" subtitle="Allocate credits / flags / attendance for any executive">
          <Tabs
            tabs={[
              { label: "Credit entry", content: <CreditEntryForm members={members} /> },
              { label: "Issue flag", content: <FlagForm members={members} /> },
              { label: "Attendance", content: <AttendanceForm members={members} /> },
              { label: "Negative review", content: <NegativeReviewForm members={members} /> },
            ]}
          />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Tier S approvals */}
          <Card title="Pending Tier S approvals" subtitle="Never auto-promoted — explicit approval only (§4.5)">
            {sCandidates.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                No candidates. An executive must reach Tier A with both eligibility flags
                confirmed to appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {sCandidates.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg bg-pink-50 px-3 py-2 ring-1 ring-pink-100">
                    <TierBadge tier={c.current_tier} size="sm" />
                    <Link href={`/users/${c.id}`} className="flex-1 text-sm font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    <form action={changeTier}>
                      <input type="hidden" name="user_id" value={c.id} />
                      <input type="hidden" name="tier" value="S" />
                      <input type="hidden" name="reason" value="promotion" />
                      <button className="rounded-md bg-pink-600 px-3 py-1 text-xs font-medium text-white hover:bg-pink-500">
                        Approve Tier S
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Flag audit log */}
          <Card title="Flag audit log" subtitle="Org-wide, most recent">
            {flags.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No flags on record.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {flags.map((f) => (
                  <li key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${f.type === "red" ? "text-red-700" : "text-amber-700"}`}>
                        {nameById.get(f.user_id) ?? "Unknown"} · {f.type === "red" ? "Red (−6)" : "Yellow (−3)"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(f.issued_at).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
