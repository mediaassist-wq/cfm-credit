import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstOfMonth } from "@/lib/dates";
import { TIER_DEFS, type Tier } from "@/lib/tier-logic";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";

export const dynamic = "force-dynamic";

export default async function EditorsPage() {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") {
    redirect(homePathForRole(me.role));
  }

  const supabase = createClient();
  const thisMonth = firstOfMonth();

  let execQuery = supabase
    .from("users")
    .select("id, name, email, current_tier")
    .eq("role", "executive")
    .eq("active", true)
    .order("name");
  if (me.role === "pm") execQuery = execQuery.eq("pm_id", me.id);

  const [orgRes, execRes, entriesRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", me.org_id).single(),
    execQuery,
    supabase.from("credit_entries").select("user_id, credits").eq("month", thisMonth),
  ]);

  const orgName = orgRes.data?.name as string | undefined;
  const execs = (execRes.data ?? []) as Pick<
    AppUser,
    "id" | "name" | "email" | "current_tier"
  >[];

  const monthTotals = new Map<string, number>();
  for (const e of (entriesRes.data ?? []) as { user_id: string; credits: number }[]) {
    monthTotals.set(e.user_id, (monthTotals.get(e.user_id) ?? 0) + e.credits);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Card title="Editors" subtitle={`${execs.length} executives · click to open a profile`}>
          {execs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No editors to show.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {execs.map((ex) => (
                <li key={ex.id}>
                  <Link
                    href={`/users/${ex.id}`}
                    className="flex items-center gap-3 py-3 transition hover:bg-slate-50"
                  >
                    <TierBadge tier={ex.current_tier as Tier} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{ex.name}</p>
                      <p className="truncate text-xs text-slate-500">{ex.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {monthTotals.get(ex.id) ?? 0}
                      </p>
                      <p className="text-[11px] text-slate-400">this month</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {TIER_DEFS[ex.current_tier].label} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
