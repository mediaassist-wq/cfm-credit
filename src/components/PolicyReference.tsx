"use client";

import { useMemo, useState } from "react";
import { PRODUCTION_TYPES, BONUS_TYPES, PENALTIES, PENALTY_LABELS, type PenaltyKey } from "@/lib/credit-rules";
import { TIERS, TIER_DEFS } from "@/lib/tier-logic";
import { Card } from "@/components/Card";

interface Row {
  label: string;
  value: string;
  detail?: string;
}

export function PolicyReference() {
  const [q, setQ] = useState("");

  const sections = useMemo(() => {
    const production: Row[] = PRODUCTION_TYPES.map((p) => ({
      label: p.label,
      value: p.credits == null ? "PM assigned" : `+${p.credits}`,
    }));
    const bonus: Row[] = BONUS_TYPES.map((b) => ({
      label: b.label,
      value: b.isMax ? `up to +${b.credits}` : `+${b.credits}`,
      detail: b.condition,
    }));
    const penalties: Row[] = (Object.keys(PENALTIES) as PenaltyKey[]).map((k) => ({
      label: PENALTY_LABELS[k],
      value: `${PENALTIES[k]}`,
    }));
    const attendance: Row[] = [
      { label: "0 late days, 0 absences", value: "5 / 5" },
      { label: "1–5 informed late days", value: "2 / 5" },
      { label: "More than 5 late days", value: "0 (flag disciplinary action)" },
    ];
    const tiers: Row[] = TIERS.map((t) => ({
      label: `Tier ${t}`,
      value: `${TIER_DEFS[t].minCredits}/mo`,
      detail: TIER_DEFS[t].extraConditions.join("; ") || "No extra conditions",
    }));
    const cycle: Row[] = [
      { label: "Cycle length", value: "2 consecutive months" },
      { label: "Both months rule", value: "Each month must individually meet the threshold — never averaged" },
      { label: "Promotion", value: "Both months meet a higher tier + its conditions → promote next cycle" },
      { label: "Demotion", value: "Either month below current tier → demote to the tier actually met" },
      { label: "Tier D floor", value: "Below D in either month → management review (no auto-demote below D)" },
      { label: "Tier S", value: "Never auto-promoted — explicit Management approval required" },
    ];
    const pmBonus: Row[] = [
      { label: "Per block of 6 perfect long-form videos", value: "+৳4,000" },
      { label: "Per video with PM-attributable mistakes", value: "−৳4,000" },
      { label: "Net bonus floor", value: "৳0 (never negative)" },
      { label: "Formula", value: "max(0, floor(perfect / 6) × 4000 − mistakes × 4000)" },
    ];

    return [
      { title: "§4.1 Production credits", rows: production },
      { title: "§4.2 Bonus credits", rows: bonus },
      { title: "§4.3 Penalties", rows: penalties },
      { title: "§4.4 Attendance scale", rows: attendance },
      { title: "§4.5 Tier thresholds", rows: tiers },
      { title: "§4.6 Evaluation cycle", rows: cycle },
      { title: "§4.7 PM monthly bonus", rows: pmBonus },
    ];
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = sections
    .map((s) => ({
      ...s,
      rows: needle
        ? s.rows.filter(
            (r) =>
              r.label.toLowerCase().includes(needle) ||
              r.value.toLowerCase().includes(needle) ||
              (r.detail?.toLowerCase().includes(needle) ?? false) ||
              s.title.toLowerCase().includes(needle),
          )
        : s.rows,
    }))
    .filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Policy reference</h1>
        <p className="text-sm text-slate-500">
          CFM-SOP-EXEC-001 (v4.0) — credit, tier &amp; bonus rules. Read-only.
        </p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search rules… (e.g. yellow, tier B, attendance)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
      />

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">No rules match “{q}”.</p>
      )}

      {filtered.map((s) => (
        <Card key={s.title} title={s.title}>
          <ul className="divide-y divide-slate-100">
            {s.rows.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2">
                <div>
                  <p className="text-sm text-slate-800">{r.label}</p>
                  {r.detail && <p className="text-xs text-slate-500">{r.detail}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{r.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
