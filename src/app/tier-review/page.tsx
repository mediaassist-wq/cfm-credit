import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstOfMonth, monthLabel } from "@/lib/dates";
import { evaluateCycle, TIER_DEFS, type Tier, type CycleOutcome } from "@/lib/tier-logic";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { changeTier } from "@/app/actions";

export const dynamic = "force-dynamic";

/** "2026-09" -> ["2026-08-01", "2026-09-01"] (the 2-month cycle ending there). */
function cycleMonths(endMonth: string): [string, string] {
  const [y, m] = endMonth.split("-").map(Number);
  const end = new Date(y, m - 1, 1);
  const start = new Date(y, m - 2, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return [fmt(start), fmt(end)];
}

function tenureMonths(joinDate: string): number {
  const j = new Date(joinDate);
  const now = new Date();
  return (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
}

export default async function TierReviewPage({
  searchParams,
}: {
  searchParams: { cycle?: string };
}) {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") {
    redirect(homePathForRole(me.role));
  }

  const endMonth = /^\d{4}-\d{2}$/.test(searchParams.cycle ?? "")
    ? searchParams.cycle!
    : firstOfMonth().slice(0, 7);
  const [m1, m2] = cycleMonths(endMonth);

  const supabase = createClient();
  let execQuery = supabase
    .from("users")
    .select("id, name, current_tier, join_date, avatar_url, mentoring_capable, moral_conduct")
    .eq("role", "executive")
    .eq("active", true)
    .order("name");
  if (me.role === "pm") execQuery = execQuery.eq("pm_id", me.id);

  const [orgRes, execRes, creditRes, attRes, flagRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", me.org_id).single(),
    execQuery,
    supabase.from("credit_entries").select("user_id, month, credits").in("month", [m1, m2]),
    supabase.from("attendance_records").select("user_id, month, late_days, unexcused_absences").in("month", [m1, m2]),
    supabase.from("flags").select("user_id, issued_at").eq("voided", false).gte("issued_at", m1),
  ]);

  const orgName = orgRes.data?.name as string | undefined;
  const execs = (execRes.data ?? []) as Pick<
    AppUser,
    "id" | "name" | "current_tier" | "join_date" | "avatar_url" | "mentoring_capable" | "moral_conduct"
  >[];

  // credits[userId][month]
  const credits = new Map<string, Map<string, number>>();
  for (const r of (creditRes.data ?? []) as { user_id: string; month: string; credits: number }[]) {
    const byMonth = credits.get(r.user_id) ?? new Map<string, number>();
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.credits);
    credits.set(r.user_id, byMonth);
  }
  const att = new Map<string, { late: number; abs: number }>();
  for (const r of (attRes.data ?? []) as {
    user_id: string; month: string; late_days: number; unexcused_absences: number;
  }[]) {
    const k = `${r.user_id}|${r.month}`;
    att.set(k, { late: r.late_days, abs: r.unexcused_absences });
  }
  const flagCount = new Map<string, number>();
  for (const r of (flagRes.data ?? []) as { user_id: string }[]) {
    flagCount.set(r.user_id, (flagCount.get(r.user_id) ?? 0) + 1);
  }

  const rows = execs.map((ex) => {
    const c1 = credits.get(ex.id)?.get(m1) ?? 0;
    const c2 = credits.get(ex.id)?.get(m2) ?? 0;
    const a1 = att.get(`${ex.id}|${m1}`) ?? { late: 0, abs: 0 };
    const a2 = att.get(`${ex.id}|${m2}`) ?? { late: 0, abs: 0 };
    const flags = flagCount.get(ex.id) ?? 0;

    const outcome: CycleOutcome = evaluateCycle({
      months: [
        { month: m1, credits: c1, lateDays: a1.late, unexcusedAbsences: a1.abs, deliveredProductionKeys: [], flagCount: 0 },
        { month: m2, credits: c2, lateDays: a2.late, unexcusedAbsences: a2.abs, deliveredProductionKeys: [], flagCount: 0 },
      ],
      currentTier: ex.current_tier,
      tenureMonths: tenureMonths(ex.join_date),
      flagsInLastTwoMonths: flags,
      mentoringCapable: ex.mentoring_capable,
      moralConduct: ex.moral_conduct,
      // Entries are free-text project names, so this condition is manager-confirmed.
      productionVarietyOk: true,
    });

    return { ex, c1, c2, flags, outcome };
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <Card
          title="Tier review"
          subtitle={`Cycle: ${monthLabel(m1)} + ${monthLabel(m2)} — both months must individually meet a tier's threshold (§4.6)`}
        >
          <form className="mb-4 flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Cycle ending month</label>
              <input
                type="month"
                name="cycle"
                defaultValue={endMonth}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Show cycle
            </button>
          </form>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No active executives.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(({ ex, c1, c2, flags, outcome }) => (
                <li key={ex.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={ex.name} url={ex.avatar_url} size="sm" />
                    <TierBadge tier={ex.current_tier as Tier} size="sm" />
                    <Link href={`/users/${ex.id}`} className="flex-1 text-sm font-medium text-slate-900 hover:underline">
                      {ex.name}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {monthLabel(m1)}: <b className="text-slate-800">{c1}</b> · {monthLabel(m2)}:{" "}
                      <b className="text-slate-800">{c2}</b>
                      {flags > 0 && <span className="text-amber-700"> · {flags} flag(s)</span>}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Recommendation outcome={outcome} />
                    {(outcome.kind === "promotion" || outcome.kind === "demotion") && (
                      <form action={changeTier}>
                        <input type="hidden" name="user_id" value={ex.id} />
                        <input type="hidden" name="tier" value={outcome.toTier} />
                        <input type="hidden" name="reason" value={outcome.kind} />
                        <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700">
                          Apply {outcome.kind === "promotion" ? "promotion" : "demotion"} → Tier {outcome.toTier}
                        </button>
                      </form>
                    )}
                    {outcome.kind === "s_candidate" && me.role === "management" && (
                      <form action={changeTier}>
                        <input type="hidden" name="user_id" value={ex.id} />
                        <input type="hidden" name="tier" value="S" />
                        <input type="hidden" name="reason" value="promotion" />
                        <button className="rounded-md bg-pink-600 px-3 py-1 text-xs font-medium text-white hover:bg-pink-500">
                          Approve Tier S
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{outcome.reason}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Note: the &ldquo;all production types delivered&rdquo; condition (Tier B+) can&rsquo;t be
            checked automatically because entries are logged as free-text project names — confirm it
            yourself before applying a promotion.
          </p>
        </Card>
      </main>
    </div>
  );
}

function Recommendation({ outcome }: { outcome: CycleOutcome }) {
  const styles: Record<CycleOutcome["kind"], string> = {
    promotion: "bg-emerald-100 text-emerald-800",
    demotion: "bg-red-100 text-red-800",
    hold: "bg-slate-200 text-slate-700",
    management_review: "bg-amber-100 text-amber-800",
    s_candidate: "bg-pink-100 text-pink-800",
  };
  const label: Record<CycleOutcome["kind"], string> = {
    promotion: `Promote → Tier ${"toTier" in outcome ? outcome.toTier : ""}`,
    demotion: `Demote → Tier ${"toTier" in outcome ? outcome.toTier : ""}`,
    hold: "Hold — no change",
    management_review: "Management review",
    s_candidate: "Tier S candidate",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[outcome.kind]}`}>
      {label[outcome.kind]}
    </span>
  );
}

export const metadata = { title: "Tier review" };
