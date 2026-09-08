import Link from "next/link";
import { TierBadge } from "@/components/TierBadge";
import type { Tier } from "@/lib/tier-logic";

export interface LeaderboardRow {
  userId: string;
  name: string;
  tier: Tier;
  total6mo: number;
  thisMonth: number;
  monthsActive: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * 6-month cumulative credit leaderboard (PRD §5.4 — Best Executive Award).
 * Ranked by total credits over the trailing 6 months.
 */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No executives to rank yet.</p>;
  }

  const max = Math.max(...rows.map((r) => r.total6mo), 1);

  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const isNominee = i === 0 && r.total6mo > 0;
        return (
          <li
            key={r.userId}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
              isNominee
                ? "bg-amber-50 ring-amber-200"
                : "bg-slate-50 ring-slate-100"
            }`}
          >
            <span className="w-7 text-center text-sm font-semibold text-slate-500">
              {i < 3 ? MEDAL[i] : i + 1}
            </span>
            <TierBadge tier={r.tier} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/users/${r.userId}`} className="truncate text-sm font-medium text-slate-900 hover:underline">
                  {r.name}
                </Link>
                {isNominee && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Award nominee
                  </span>
                )}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-800"
                  style={{ width: `${(r.total6mo / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{r.total6mo}</p>
              <p className="text-[11px] text-slate-400">
                6-mo · {r.monthsActive > 0 ? Math.round(r.total6mo / r.monthsActive) : 0}/mo avg
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
