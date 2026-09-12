import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthLabel, firstOfMonth } from "@/lib/dates";
import { TIERS, TIER_DEFS, type Tier } from "@/lib/tier-logic";
import { CREDIT_CATEGORIES, type CreditCategory } from "@/lib/credit-rules";
import type { AppUser, CreditEntry, Flag, AttendanceRecord, TierHistory } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { LedgerEditor } from "@/components/LedgerEditor";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { changeTier, setEligibilityFlag, removeFlag, adjustPoints } from "@/app/actions";

const CAT_LABEL = Object.fromEntries(
  CREDIT_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<CreditCategory, string>;

export const dynamic = "force-dynamic";

function tenureMonths(joinDate: string): number {
  const j = new Date(joinDate);
  const now = new Date();
  return (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
}

export default async function ProfileDetail({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const supabase = createClient();

  const { data: target } = await supabase.from("users").select("*").eq("id", params.id).single();
  if (!target) notFound();
  const user = target as AppUser;

  // Executives may only view their own profile.
  if (me.role === "executive" && me.id !== user.id) redirect("/executive");

  const [ledgerRes, flagsRes, attRes, tierRes, orgRes] = await Promise.all([
    supabase.from("credit_entries").select("*").eq("user_id", user.id).order("month", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("flags").select("*").eq("user_id", user.id).eq("voided", false).order("issued_at", { ascending: false }),
    supabase.from("attendance_records").select("*").eq("user_id", user.id).order("month", { ascending: false }),
    supabase.from("tier_history").select("*").eq("user_id", user.id).order("effective_date", { ascending: false }),
    supabase.from("organizations").select("name").eq("id", user.org_id).single(),
  ]);

  const ledger = (ledgerRes.data ?? []) as CreditEntry[];
  const flags = (flagsRes.data ?? []) as Flag[];
  const attendance = (attRes.data ?? []) as AttendanceRecord[];
  const tierHistory = (tierRes.data ?? []) as TierHistory[];
  const orgName = orgRes.data?.name as string | undefined;

  const total = ledger.reduce((s, e) => s + e.credits, 0);
  const canManage = me.role === "management" || me.role === "pm";
  const isMgmt = me.role === "management";

  // This-month tally (for month-end reconciliation).
  const thisMonth = firstOfMonth();
  const monthEntries = ledger.filter((e) => e.month === thisMonth);
  const monthNet = monthEntries.reduce((s, e) => s + e.credits, 0);
  const monthByCat = new Map<CreditCategory, number>();
  for (const e of monthEntries) {
    monthByCat.set(e.category, (monthByCat.get(e.category) ?? 0) + e.credits);
  }

  // Tier options a PM may assign (no S — management only).
  const tierOptions = isMgmt ? TIERS : TIERS.filter((t) => t !== "S");

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Link href={me.role === "management" ? "/management" : "/pm"} className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>

        {/* Header */}
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.name} url={user.avatar_url} size="lg" />
            <TierBadge tier={user.current_tier} size="lg" />
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
              <p className="text-sm text-slate-500">
                {user.email} · joined {new Date(user.join_date).toLocaleDateString("en-US")} ·{" "}
                {tenureMonths(user.join_date)} mo tenure
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">All-time credits</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
            </div>
          </div>
        </Card>

        {/* This-month tally + month-end adjustment */}
        {canManage && (
          <Card title={`This month · ${monthLabel(thisMonth)}`} subtitle="Review the tally, then reconcile with an adjustment">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                {monthEntries.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">No entries this month yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {CREDIT_CATEGORIES.map(({ value }) => {
                      if (!monthByCat.has(value)) return null;
                      const sub = monthByCat.get(value)!;
                      return (
                        <li key={value} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{CAT_LABEL[value]}</span>
                          <span className={sub < 0 ? "font-medium text-red-600" : "font-medium text-slate-800"}>
                            {sub > 0 ? "+" : ""}{sub}
                          </span>
                        </li>
                      );
                    })}
                    <li className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                      <span className="font-semibold text-slate-900">Net this month</span>
                      <span className="text-lg font-bold text-slate-900">{monthNet}</span>
                    </li>
                  </ul>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Month-end adjustment
                </h3>
                <form action={adjustPoints} className="space-y-2">
                  <input type="hidden" name="user_id" value={user.id} />
                  <input type="hidden" name="month" value={thisMonth.slice(0, 7)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Amount (use a minus sign to reduce, e.g. -5)
                    </label>
                    <input
                      type="number"
                      name="amount"
                      required
                      placeholder="e.g. 5 or -3"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reason</label>
                    <input
                      name="note"
                      required
                      placeholder="e.g. month-end correction"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                    Apply adjustment
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-400">
                  This adds one adjustment entry to the ledger (nothing is edited or deleted).
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Management / PM controls */}
        {canManage && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Change tier" subtitle="Logged to tier history (never silently overwritten)">
              <form action={changeTier} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="user_id" value={user.id} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tier</label>
                  <select name="tier" defaultValue={user.current_tier} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {tierOptions.map((t) => (
                      <option key={t} value={t}>
                        Tier {t} · min {TIER_DEFS[t].minCredits}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Reason</label>
                  <select name="reason" defaultValue="promotion" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="promotion">Promotion</option>
                    <option value="demotion">Demotion</option>
                    <option value="initial">Initial</option>
                  </select>
                </div>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  Apply
                </button>
              </form>
              {!isMgmt && (
                <p className="mt-2 text-xs text-amber-600">Only Management can promote to Tier S.</p>
              )}
            </Card>

            {isMgmt && (
              <Card title="Tier S eligibility flags" subtitle="Manual — required before S approval (§4.5)">
                <div className="space-y-2">
                  <EligibilityToggle userId={user.id} field="mentoring_capable" label="Mentoring capability" value={user.mentoring_capable} />
                  <EligibilityToggle userId={user.id} field="moral_conduct" label="Moral / ethical conduct" value={user.moral_conduct} />
                </div>
              </Card>
            )}

            <Card title="Reset password" subtitle="If this editor forgot their password">
              <ResetPasswordForm userId={user.id} name={user.name} />
            </Card>
          </div>
        )}

        {/* Tier history timeline */}
        <Card title="Tier history">
          {tierHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No tier records.</p>
          ) : (
            <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-5">
              {tierHistory.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-slate-400 ring-4 ring-slate-100" />
                  <div className="flex items-center gap-2">
                    <TierBadge tier={h.tier} size="sm" />
                    <span className="text-sm font-medium capitalize text-slate-800">{h.reason}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(h.effective_date).toLocaleDateString("en-US")}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Full ledger */}
          <Card
            title="Credit ledger"
            subtitle={canManage ? `${ledger.length} entries · edit or delete any` : `${ledger.length} entries`}
          >
            <LedgerEditor entries={ledger} userId={user.id} canManage={canManage} />
          </Card>

          <div className="space-y-5">
            {/* Attendance */}
            <Card title="Attendance history">
              {attendance.length === 0 ? (
                <p className="text-sm text-slate-400">No records.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-1">Month</th>
                      <th className="text-center">Late</th>
                      <th className="text-center">Unexcused</th>
                      <th className="text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1 text-slate-500">{monthLabel(a.month)}</td>
                        <td className="text-center text-slate-700">{a.late_days}</td>
                        <td className="text-center text-slate-700">{a.unexcused_absences}</td>
                        <td className="text-right font-medium text-slate-800">{a.credit_awarded}/5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Flags */}
            <Card title="Flag history">
              {flags.length === 0 ? (
                <p className="text-sm text-slate-400">No flags. 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {flags.map((f) => (
                    <li key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${f.type === "red" ? "text-red-700" : "text-amber-700"}`}>
                          {f.type === "red" ? "Red flag (−6)" : "Yellow flag (−3)"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {new Date(f.issued_at).toLocaleDateString("en-US")}
                          </span>
                          {canManage && (
                            <form action={removeFlag}>
                              <input type="hidden" name="flag_id" value={f.id} />
                              <button className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-white">
                                Remove
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700">{f.reason}</p>
                      {f.video_reference && <p className="text-xs text-slate-400">Ref: {f.video_reference}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function EligibilityToggle({
  userId,
  field,
  label,
  value,
}: {
  userId: string;
  field: string;
  label: string;
  value: boolean;
}) {
  return (
    <form action={setEligibilityFlag} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={(!value).toString()} />
      <span className="text-sm text-slate-700">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`text-xs font-medium ${value ? "text-emerald-600" : "text-slate-400"}`}>
          {value ? "Confirmed" : "Not set"}
        </span>
        <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-white">
          {value ? "Revoke" : "Confirm"}
        </button>
      </span>
    </form>
  );
}
