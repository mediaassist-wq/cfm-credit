import type { Tier } from "@/lib/tier-logic";

const TIER_STYLES: Record<Tier, string> = {
  D: "bg-slate-100 text-slate-700 ring-slate-300",
  C: "bg-blue-100 text-blue-700 ring-blue-300",
  B: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  A: "bg-amber-100 text-amber-700 ring-amber-300",
  S: "bg-pink-100 text-pink-700 ring-pink-300",
};

export function TierBadge({ tier, size = "md" }: { tier: Tier; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-7 w-7 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-16 w-16 text-3xl",
  } as const;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl font-bold ring-1 ${TIER_STYLES[tier]} ${sizes[size]}`}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}
