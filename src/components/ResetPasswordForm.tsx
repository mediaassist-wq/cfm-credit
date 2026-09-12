"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { resetEditorPassword } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
    >
      {pending ? "Setting…" : "Set password"}
    </button>
  );
}

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setError(null);
        setDone(null);
        try {
          await resetEditorPassword(fd);
          setDone(String(fd.get("password")));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not reset the password.");
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">New password</label>
          <input
            name="password"
            type="text"
            minLength={6}
            required
            placeholder="at least 6 characters"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <SubmitButton />
      </div>

      {done && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Done. Give {name} this password: <span className="font-semibold">{done}</span> — they can
          change it later from their Account page.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <p className="text-xs text-slate-400">
        Use this when an editor forgets their password. It replaces their old one immediately.
      </p>
    </form>
  );
}
