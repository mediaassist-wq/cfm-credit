import { TIERS, TIER_DEFS, tierRank, type Tier } from "@/lib/tier-logic";

/**
 * Progress bar from the current tier's threshold to the next tier's threshold,
 * based on this month's credit total.
 */
export function TierProgress({ tier, monthCredits }: { tier: Tier; monthCredits: number }) {
  const rank = tierRank(tier);
  const nextTier: Tier | null = rank < TIERS.length - 1 ? TIERS[rank + 1] : null;

  const base = TIER_DEFS[tier].minCredits;
  const target = nextTier ? TIER_DEFS[nextTier].minCredits : base;

  const pct = nextTier
    ? Math.max(0, Math.min(100, ((monthCredits - base) / (target - base)) * 100))
    : 100;

  const remaining = nextTier ? Math.max(0, target - monthCredits) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">
          {monthCredits} credits this month
        </span>
        {nextTier ? (
          <span className="text-slate-500">
            {remaining > 0
              ? `${remaining} to Tier ${nextTier}`
              : `Tier ${nextTier} threshold met`}
          </span>
        ) : (
          <span className="text-slate-500">Top tier</span>
        )}
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>Tier {tier} · {base}</span>
        {nextTier && <span>Tier {nextTier} · {target}</span>}
      </div>
      {nextTier && TIER_DEFS[nextTier].extraConditions.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Note: Tier {nextTier} also requires — {TIER_DEFS[nextTier].extraConditions.join("; ")}.
        </p>
      )}
    </div>
  );
}
