import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { lastNMonths } from "@/lib/dates";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { Leaderboard, type LeaderboardRow } from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await getCurrentUser();
  const months = lastNMonths(6);
  const earliest = months[0];

  const orgName =
    (await createClient().from("organizations").select("name").eq("id", me.org_id).single()).data
      ?.name as string | undefined;

  // The Best Executive leaderboard is an org-wide ranking everyone can see.
  // We compute it with the service-role client so executives (whose RLS only
  // exposes their own rows) still see the full ranking — but only the ranking
  // is rendered, never peers' raw ledgers.
  const admin = createAdmin();
  const [execRes, entriesRes] = await Promise.all([
    admin
      .from("users")
      .select("id, name, current_tier")
      .eq("org_id", me.org_id)
      .eq("role", "executive")
      .eq("active", true),
    admin.from("credit_entries").select("user_id, month, credits").eq("org_id", me.org_id).gte("month", earliest),
  ]);

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

  const myRank = rows.findIndex((r) => r.userId === me.id) + 1;

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {me.role === "executive" && myRank > 0 && (
          <Card>
            <p className="text-sm text-slate-600">
              Your rank:{" "}
              <span className="text-lg font-bold text-slate-900">#{myRank}</span>{" "}
              of {rows.length} · {totals.get(me.id) ?? 0} credits over 6 months
            </p>
          </Card>
        )}
        <Card
          title="Best Executive leaderboard"
          subtitle="6-month cumulative credits — top performer is the Best Executive Award nominee (§5.4)"
        >
          <Leaderboard
            rows={rows}
            highlightUserId={me.id}
            linkProfiles={me.role !== "executive"}
          />
        </Card>
      </main>
    </div>
  );
}
