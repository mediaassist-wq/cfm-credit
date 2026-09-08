"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  PRODUCTION_TYPES,
  BONUS_TYPES,
  PM_DISCRETIONARY_MAX,
} from "@/lib/credit-rules";
import { pmNetBonus } from "@/lib/tier-logic";
import {
  addCreditEntry,
  issueFlag,
  recordAttendance,
  logNegativeReview,
  logPmBonus,
} from "@/app/actions";

export interface Member {
  id: string;
  name: string;
  tier: string;
}

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function MemberSelect({ members }: { members: Member[] }) {
  return (
    <div>
      <label className={labelCls}>Executive</label>
      <select name="user_id" required className={inputCls} defaultValue="">
        <option value="" disabled>
          Select…
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · Tier {m.tier}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CreditEntryForm({ members }: { members: Member[] }) {
  const [category, setCategory] = useState<"production" | "bonus" | "adjustment">("production");
  const [subKey, setSubKey] = useState<string>(PRODUCTION_TYPES[0].key);

  const prodType = PRODUCTION_TYPES.find((p) => p.key === subKey);
  const bonusType = BONUS_TYPES.find((b) => b.key === subKey);

  const needsManual =
    category === "adjustment" ||
    (category === "production" && prodType?.credits == null) ||
    (category === "bonus" && bonusType?.key === "pm_discretionary");

  const autoCredits =
    category === "production"
      ? prodType?.credits ?? null
      : category === "bonus"
        ? bonusType?.credits ?? null
        : null;

  return (
    <form action={addCreditEntry} className="space-y-3">
      <MemberSelect members={members} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Category</label>
          <select
            name="category"
            className={inputCls}
            value={category}
            onChange={(e) => {
              const c = e.target.value as typeof category;
              setCategory(c);
              setSubKey(
                c === "production"
                  ? PRODUCTION_TYPES[0].key
                  : c === "bonus"
                    ? BONUS_TYPES[0].key
                    : "",
              );
            }}
          >
            <option value="production">Production</option>
            <option value="bonus">Bonus</option>
            <option value="adjustment">Adjustment / Correction</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Month</label>
          <input type="month" name="month" defaultValue={currentMonth()} className={inputCls} />
        </div>
      </div>

      {category !== "adjustment" && (
        <div>
          <label className={labelCls}>Type</label>
          <select
            name="subcategory"
            className={inputCls}
            value={subKey}
            onChange={(e) => setSubKey(e.target.value)}
          >
            {(category === "production" ? PRODUCTION_TYPES : BONUS_TYPES).map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
                {"credits" in t && t.credits != null
                  ? ` (+${t.credits}${"isMax" in t && t.isMax ? " max" : ""})`
                  : " (PM assigned)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {category === "adjustment" && (
        <div>
          <label className={labelCls}>Label</label>
          <input name="subcategory" placeholder="e.g. correction" className={inputCls} />
        </div>
      )}

      {needsManual ? (
        <div>
          <label className={labelCls}>
            {category === "adjustment"
              ? "Credits (can be negative)"
              : bonusType?.key === "pm_discretionary"
                ? `Credits (0–${PM_DISCRETIONARY_MAX})`
                : "Credits (PM assigned)"}
          </label>
          <input type="number" name="amount" defaultValue={0} className={inputCls} />
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Auto credits: <span className="font-semibold text-slate-800">+{autoCredits}</span> (per SOP)
        </p>
      )}

      <div>
        <label className={labelCls}>Note (optional)</label>
        <input name="note" className={inputCls} />
      </div>

      <SubmitButton>Log credit</SubmitButton>
    </form>
  );
}

export function FlagForm({ members }: { members: Member[] }) {
  return (
    <form action={issueFlag} className="space-y-3">
      <MemberSelect members={members} />
      <div>
        <label className={labelCls}>Flag type</label>
        <select name="type" className={inputCls} defaultValue="yellow">
          <option value="yellow">Yellow (−3)</option>
          <option value="red">Red (−6)</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Reason</label>
        <input name="reason" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Video reference (optional)</label>
        <input name="video_reference" className={inputCls} />
      </div>
      <SubmitButton>Issue flag</SubmitButton>
    </form>
  );
}

export function AttendanceForm({ members }: { members: Member[] }) {
  return (
    <form action={recordAttendance} className="space-y-3">
      <MemberSelect members={members} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls}>Month</label>
          <input type="month" name="month" defaultValue={currentMonth()} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Late days</label>
          <input type="number" name="late_days" defaultValue={0} min={0} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Unexcused</label>
          <input type="number" name="unexcused_absences" defaultValue={0} min={0} className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Credit is auto-computed: 0 late &amp; 0 absent → +5; 1–5 late → +2; &gt;5 late → 0. Each
        unexcused absence also deducts −3.
      </p>
      <SubmitButton>Record attendance</SubmitButton>
    </form>
  );
}

export function NegativeReviewForm({ members }: { members: Member[] }) {
  return (
    <form action={logNegativeReview} className="space-y-3">
      <MemberSelect members={members} />
      <div>
        <label className={labelCls}>Month</label>
        <input type="month" name="month" defaultValue={currentMonth()} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Note (optional)</label>
        <input name="note" className={inputCls} />
      </div>
      <p className="text-xs text-slate-500">Applies a −4 penalty (§4.3).</p>
      <SubmitButton>Log negative review</SubmitButton>
    </form>
  );
}

export function PmBonusForm({ pmId, defaults }: { pmId: string; defaults?: { perfect: number; mistakes: number } }) {
  const [perfect, setPerfect] = useState(defaults?.perfect ?? 0);
  const [mistakes, setMistakes] = useState(defaults?.mistakes ?? 0);
  const { grossBonus, deduction, netBonus } = pmNetBonus(perfect, mistakes);

  return (
    <form action={logPmBonus} className="space-y-3">
      <input type="hidden" name="pm_id" value={pmId} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls}>Month</label>
          <input type="month" name="month" defaultValue={currentMonth()} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Perfect videos</label>
          <input
            type="number"
            name="perfect_videos"
            min={0}
            value={perfect}
            onChange={(e) => setPerfect(Math.max(0, Number(e.target.value)))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Mistake videos</label>
          <input
            type="number"
            name="mistake_videos"
            min={0}
            value={mistakes}
            onChange={(e) => setMistakes(Math.max(0, Number(e.target.value)))}
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-sm">
        <div>
          <p className="text-xs text-slate-500">Gross</p>
          <p className="font-semibold text-slate-800">৳{grossBonus.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Deduction</p>
          <p className="font-semibold text-red-600">−৳{deduction.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Net</p>
          <p className="font-bold text-slate-900">৳{netBonus.toLocaleString()}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        ৳4,000 per complete block of 6 perfect videos; −৳4,000 per mistake video; floor ৳0 (§4.7).
      </p>
      <SubmitButton>Save bonus log</SubmitButton>
    </form>
  );
}
