import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lastNMonths } from "@/lib/dates";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { Leaderboard, type LeaderboardRow } from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") {
    redirect(homePathForRole(me.role));
  }

  const supabase = createClient();
  const months = lastNMonths(6);
  const earliest = months[0];

  // A PM sees their own team; management sees all executives.
  let execQuery = supabase
    .from("users")
    .select("id, name, current_tier")
    .eq("role", "executive")
    .eq("active", true);
  if (me.role === "pm") execQuery = execQuery.eq("pm_id", me.id);

  const [orgRes, execRes, entriesRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", me.org_id).single(),
    execQuery,
    supabase.from("credit_entries").select("user_id, month, credits").gte("month", earliest),
  ]);

  const orgName = orgRes.data?.name as string | undefined;
  const execs = (execRes.data ?? []) as Pick<AppUser, "id" | "name" | "current_tier">[];
  const entries = (entriesRes.data ?? []) as { user_id: string; month: string; credits: number }[];

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

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card
          title="Best Executive leaderboard"
          subtitle="6-month cumulative credits — top performer is the Best Executive Award nominee (§5.4)"
        >
          <Leaderboard rows={rows} />
        </Card>
      </main>
    </div>
  );
}
