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

const cellInput =
  "w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500";

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
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="py-1.5">Month</th>
            <th>Category</th>
            <th>Item</th>
            <th className="text-right">Credits</th>
            {canManage && <th className="w-24 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((e) =>
            editing === e.id ? (
              <tr key={e.id} className="bg-amber-50">
                <td className="py-1.5 align-top text-slate-500">{monthLabel(e.month)}</td>
                <td className="align-top capitalize text-slate-600">{e.category}</td>
                <td className="align-top">
                  <form
                    id={`edit-${e.id}`}
                    action={async (fd) => {
                      await updateCreditEntry(fd);
                      setEditing(null);
                      router.refresh();
                    }}
                    className="space-y-1"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="user_id" value={userId} />
                    <input
                      name="subcategory"
                      defaultValue={e.subcategory ?? ""}
                      placeholder="item"
                      className={cellInput}
                    />
                    <input
                      name="note"
                      defaultValue={e.note ?? ""}
                      placeholder="note (optional)"
                      className={cellInput}
                    />
                  </form>
                </td>
                <td className="align-top text-right">
                  <input
                    form={`edit-${e.id}`}
                    name="credits"
                    type="number"
                    defaultValue={e.credits}
                    className={`${cellInput} w-20 text-right`}
                  />
                </td>
                <td className="align-top text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      form={`edit-${e.id}`}
                      type="submit"
                      className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={e.id}>
                <td className="py-1.5 text-slate-500">{monthLabel(e.month)}</td>
                <td className="capitalize text-slate-600">{e.category}</td>
                <td className="text-slate-700">
                  {e.subcategory ?? "—"}
                  {e.note && <span className="text-slate-400"> · {e.note}</span>}
                </td>
                <td className={`text-right font-medium ${e.credits < 0 ? "text-red-600" : "text-slate-800"}`}>
                  {e.credits > 0 ? "+" : ""}
                  {e.credits}
                </td>
                {canManage && (
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(e.id)}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
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
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
