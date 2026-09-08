import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstOfMonth, lastNMonths, monthLabel } from "@/lib/dates";
import { TIER_DEFS } from "@/lib/tier-logic";
import { CREDIT_CATEGORIES, type CreditCategory } from "@/lib/credit-rules";
import type { CreditEntry, Flag, AttendanceRecord } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { TierProgress } from "@/components/TierProgress";
import { CreditTrendChart, type TrendPoint } from "@/components/CreditTrendChart";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL = Object.fromEntries(
  CREDIT_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<CreditCategory, string>;

export default async function ExecutiveDashboard() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const thisMonth = firstOfMonth();
  const sixMonths = lastNMonths(6);
  const earliest = sixMonths[0];

  // Parallel data fetch (RLS restricts an executive to their own rows).
  const [orgRes, monthEntriesRes, trendEntriesRes, flagsRes, attendanceRes] =
    await Promise.all([
      supabase.from("organizations").select("name").eq("id", user.org_id).single(),
      supabase
        .from("credit_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", thisMonth)
        .order("created_at", { ascending: true }),
      supabase
        .from("credit_entries")
        .select("month, credits")
        .eq("user_id", user.id)
        .gte("month", earliest),
      supabase
        .from("flags")
        .select("*")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false }),
      supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", thisMonth)
        .maybeSingle(),
    ]);

  const orgName = orgRes.data?.name as string | undefined;
  const monthEntries = (monthEntriesRes.data ?? []) as CreditEntry[];
  const flags = (flagsRes.data ?? []) as Flag[];
  const attendance = (attendanceRes.data ?? null) as AttendanceRecord | null;

  const monthTotal = monthEntries.reduce((s, e) => s + e.credits, 0);

  // Group this-month entries by category.
  const byCategory = new Map<CreditCategory, CreditEntry[]>();
  for (const e of monthEntries) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  // 6-month trend.
  const trendMap = new Map<string, number>(sixMonths.map((m) => [m, 0]));
  for (const row of (trendEntriesRes.data ?? []) as { month: string; credits: number }[]) {
    if (trendMap.has(row.month)) trendMap.set(row.month, trendMap.get(row.month)! + row.credits);
  }
  const trend: TrendPoint[] = sixMonths.map((m) => ({
    month: monthLabel(m),
    credits: trendMap.get(m) ?? 0,
  }));

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={user} orgName={orgName} />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {/* Tier + progress */}
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <TierBadge tier={user.current_tier} size="lg" />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Current tier</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {TIER_DEFS[user.current_tier].label}
                </p>
              </div>
            </div>
            <div className="flex-1 sm:border-l sm:border-slate-200 sm:pl-6">
              <TierProgress tier={user.current_tier} monthCredits={monthTotal} />
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Credit breakdown */}
          <Card
            title="This month's credits"
            subtitle={monthLabel(thisMonth)}
            className="lg:col-span-2"
          >
            {monthEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No credit entries recorded this month yet.
              </p>
            ) : (
              <div className="space-y-4">
                {CREDIT_CATEGORIES.map(({ value }) => {
                  const items = byCategory.get(value);
                  if (!items || items.length === 0) return null;
                  const subtotal = items.reduce((s, e) => s + e.credits, 0);
                  return (
                    <div key={value}>
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {CATEGORY_LABEL[value]}
                        </h3>
                        <span className={subtotal < 0 ? "text-sm font-semibold text-red-600" : "text-sm font-semibold text-slate-800"}>
                          {subtotal > 0 ? "+" : ""}{subtotal}
                        </span>
                      </div>
                      <ul className="divide-y divide-slate-100 rounded-lg bg-slate-50">
                        {items.map((e) => (
                          <li key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-slate-700">
                              {e.subcategory ?? "—"}
                              {e.note && <span className="text-slate-400"> · {e.note}</span>}
                            </span>
                            <span className={e.credits < 0 ? "font-medium text-red-600" : "font-medium text-slate-800"}>
                              {e.credits > 0 ? "+" : ""}{e.credits}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-900">Total</span>
                  <span className="text-lg font-bold text-slate-900">{monthTotal}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Attendance */}
          <Card title="Attendance" subtitle={monthLabel(thisMonth)}>
            {attendance ? (
              <div className="space-y-3">
                <Stat label="Late days" value={attendance.late_days} />
                <Stat label="Unexcused absences" value={attendance.unexcused_absences} />
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm text-slate-600">Credit awarded</span>
                  <span className="text-lg font-bold text-slate-900">
                    {attendance.credit_awarded}/5
                  </span>
                </div>
                {attendance.late_days > 5 && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    More than 5 late days — flagged for further disciplinary action.
                  </p>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                No attendance record for this month yet.
              </p>
            )}
          </Card>
        </div>

        {/* Trend + flags */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="6-month credit trend" className="lg:col-span-2">
            <CreditTrendChart data={trend} threshold={TIER_DEFS[user.current_tier].minCredits} />
          </Card>

          <Card title="Flag history">
            {flags.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No flags on record. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {flags.map((f) => (
                  <li key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${f.type === "red" ? "text-red-700" : "text-amber-700"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${f.type === "red" ? "bg-red-500" : "bg-amber-400"}`} />
                        {f.type === "red" ? "Red flag" : "Yellow flag"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(f.issued_at).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{f.reason}</p>
                    {f.video_reference && (
                      <p className="text-xs text-slate-400">Ref: {f.video_reference}</p>
                    )}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-lg font-semibold text-slate-900">{value}</span>
    </div>
  );
}
