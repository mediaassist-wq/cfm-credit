import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstOfMonth } from "@/lib/dates";
import { TIER_DEFS, type Tier } from "@/lib/tier-logic";
import type { AppUser } from "@/lib/types";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { DeleteEditorButton } from "@/components/DeleteEditorButton";
import { addEditor, setEditorActive } from "@/app/actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";

export default async function EditorsPage() {
  const me = await getCurrentUser();
  if (me.role !== "management" && me.role !== "pm") {
    redirect(homePathForRole(me.role));
  }

  const supabase = createClient();
  const thisMonth = firstOfMonth();

  let execQuery = supabase
    .from("users")
    .select("id, name, email, current_tier, active, avatar_url")
    .eq("role", "executive")
    .order("active", { ascending: false })
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
    "id" | "name" | "email" | "current_tier" | "active" | "avatar_url"
  >[];

  const monthTotals = new Map<string, number>();
  for (const e of (entriesRes.data ?? []) as { user_id: string; credits: number }[]) {
    monthTotals.set(e.user_id, (monthTotals.get(e.user_id) ?? 0) + e.credits);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={orgName} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {/* Add editor */}
        <Card title="Add an editor" subtitle="Creates a login for a new executive">
          <form action={addEditor} className="grid gap-2 sm:grid-cols-4">
            <input name="name" placeholder="Full name" required className={`${inputCls} sm:col-span-1`} />
            <input name="email" type="email" placeholder="Email" required className={`${inputCls} sm:col-span-1`} />
            <input name="password" placeholder="Temp password" required minLength={6} className={`${inputCls} sm:col-span-1`} />
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Add editor
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            The editor signs in with this email + temp password, then can change their name,
            photo, and password from their Account page.
          </p>
        </Card>

        {/* Roster */}
        <Card title="Editors" subtitle={`${execs.filter((e) => e.active).length} active · click a name to open the profile`}>
          {execs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No editors yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {execs.map((ex) => (
                <li key={ex.id} className={`flex items-center gap-3 py-3 ${ex.active ? "" : "opacity-50"}`}>
                  <Avatar name={ex.name} url={ex.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/users/${ex.id}`} className="truncate text-sm font-medium text-slate-900 hover:underline">
                      {ex.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {ex.email}
                      {!ex.active && " · removed"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{TIER_DEFS[ex.current_tier as Tier].label}</span>
                  <span className="w-10 text-right text-sm font-semibold text-slate-800">
                    {monthTotals.get(ex.id) ?? 0}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <form action={setEditorActive}>
                      <input type="hidden" name="user_id" value={ex.id} />
                      <input type="hidden" name="active" value={(!ex.active).toString()} />
                      <button
                        className={`rounded-md border px-2 py-1 text-xs transition ${
                          ex.active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {ex.active ? "Remove" : "Restore"}
                      </button>
                    </form>
                    {!ex.active && <DeleteEditorButton userId={ex.id} name={ex.name} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
