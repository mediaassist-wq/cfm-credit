"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/dates";
import { updateCreditEntry, deleteCreditEntry } from "@/app/actions";

export interface LedgerRow {
  id: string;
  month: string;
  category: string;
  subcategory: string | null;
  credits: number;
  note: string | null;
}

const inp =
  "rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";

export function LedgerEditor({
  entries,
  userId,
  canManage,
}: {
  entries: LedgerRow[];
  userId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="py-4 text-sm text-slate-400">No entries yet.</p>;
  }

  return (
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {entries.map((e) =>
        editing === e.id ? (
          <form
            key={e.id}
            action={async (fd) => {
              await updateCreditEntry(fd);
              setEditing(null);
              router.refresh();
            }}
            className="space-y-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200"
          >
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="user_id" value={userId} />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{monthLabel(e.month)}</span>
              <span className="capitalize">{e.category}</span>
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-500">Item</label>
              <input name="subcategory" defaultValue={e.subcategory ?? ""} placeholder="item" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-500">Note (optional)</label>
              <input name="note" defaultValue={e.note ?? ""} placeholder="note" className={`${inp} w-full`} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Credits</label>
              <input name="credits" type="number" defaultValue={e.credits} className={`${inp} w-24`} />
              <div className="ml-auto flex gap-1">
                <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
            <span className="w-20 shrink-0 text-xs text-slate-500">{monthLabel(e.month)}</span>
            <span className="hidden w-24 shrink-0 text-xs capitalize text-slate-600 sm:block">{e.category}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              {e.subcategory ?? "—"}
              {e.note && <span className="text-slate-400"> · {e.note}</span>}
            </span>
            <span className={`w-12 shrink-0 text-right text-sm font-medium ${e.credits < 0 ? "text-red-600" : "text-slate-800"}`}>
              {e.credits > 0 ? "+" : ""}
              {e.credits}
            </span>
            {canManage && (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(e.id)}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-white"
                >
                  Edit
                </button>
                <form
                  action={async (fd) => {
                    await deleteCreditEntry(fd);
                    router.refresh();
                  }}
                  onSubmit={(ev) => {
                    if (!confirm("Delete this ledger entry?")) ev.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="user_id" value={userId} />
                  <button className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
