"use client";

import { cn } from "@repo/ui";
import type { TournamentTier } from "@repo/shared";

export interface MatchTierToggleProps {
  tier: TournamentTier;
  onTierChange: (tier: TournamentTier) => void;
}

const TIER_OPTIONS: { value: TournamentTier; label: string }[] = [
  { value: "league", label: "Regional Season" },
  { value: "international", label: "International" },
];

/**
 * Real-model integration task: no match is actually scheduled for a
 * current-matchup real prediction, so the competitive-tier context the
 * real feature row needs is an explicit, visible user choice here — never a
 * silently-assumed default. `eventRegion` itself needs no separate control:
 * for `"league"`, the server derives it from the two selected teams' own
 * real VCT region (see `currentPredictionAdapter.ts`).
 */
export function MatchTierToggle({ tier, onTierChange }: MatchTierToggleProps) {
  return (
    <div className="flex flex-col items-center gap-2xs">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id="match-tier-label">
        Match Context (assumed)
      </span>
      <div role="group" aria-labelledby="match-tier-label" className="inline-flex rounded-md border border-surface-border bg-surface p-[3px]">
        {TIER_OPTIONS.map((option) => {
          const active = option.value === tier;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onTierChange(option.value)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                active ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
