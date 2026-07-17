import type { DnaDimensionKey, KeyFactor } from "@repo/shared";
import { cn } from "@repo/ui";
import { dimensionRowHandlers } from "./useDimensionRowHandlers";
import type { BreakdownController } from "./useBreakdownState";
import { findContributionForFactor, findDnaDimensionForFactor } from "../../../lib/predictionBreakdown";
import type { ContributionRow, DnaGapRow } from "../../../lib/predictionBreakdown";

export interface KeyFactorsTabProps {
  keyFactors: readonly KeyFactor[];
  contributions: ContributionRow[];
  dnaGapRows: DnaGapRow[];
  teamAName: string;
  teamBName: string;
  breakdown: BreakdownController;
}

/**
 * Renders `result.keyFactors` exactly as the engine generated them — no
 * re-ranking, re-filtering, or re-scoring. Selecting a factor cross-highlights
 * its matching Contributions row and Match DNA dimension via the exact-match
 * lookup in `factorLinks.ts`; when no match exists the factor still renders,
 * standalone, with no fabricated relationship.
 */
export function KeyFactorsTab({
  keyFactors,
  contributions,
  dnaGapRows,
  teamAName,
  teamBName,
  breakdown,
}: KeyFactorsTabProps) {
  if (keyFactors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No individual factor stood out enough on its own to be called a key factor for this matchup.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-sm" aria-label="Key factors behind this prediction">
      {keyFactors.map((factor) => (
        <KeyFactorRow
          key={factor.id}
          factor={factor}
          contribution={findContributionForFactor(factor.id, contributions)}
          dnaRow={findDnaDimensionForFactor(factor.id, dnaGapRows)}
          teamAName={teamAName}
          teamBName={teamBName}
          breakdown={breakdown}
        />
      ))}
    </ul>
  );
}

function KeyFactorRow({
  factor,
  contribution,
  dnaRow,
  teamAName,
  teamBName,
  breakdown,
}: {
  factor: KeyFactor;
  contribution: ContributionRow | null;
  dnaRow: DnaGapRow | null;
  teamAName: string;
  teamBName: string;
  breakdown: BreakdownController;
}) {
  const dimensionKey = factor.id as DnaDimensionKey;
  const isSelected = breakdown.selectedDimensionKey === dimensionKey;
  const isActive = breakdown.activeDimensionKey === dimensionKey;
  const leaderName = dnaRow?.advantage === "A" ? teamAName : dnaRow?.advantage === "B" ? teamBName : null;

  const linkedSummary = contribution
    ? `Linked to the "${contribution.label}" contribution (${contribution.shareOfTotal}% of total) and the Match DNA "${dnaRow?.label ?? contribution.label}" dimension.`
    : "No linked Match DNA dimension for this factor.";

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected}
        {...dimensionRowHandlers(dimensionKey, breakdown)}
        aria-label={`${factor.label}: ${factor.description}. ${linkedSummary}`}
        className={cn(
          "flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
          "motion-safe:transition-[border-color,box-shadow,opacity] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          isSelected
            ? "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]"
            : isActive
              ? "border-brand-400/70"
              : "border-surface-border",
          !isActive && !isSelected && breakdown.activeDimensionKey ? "opacity-70" : "opacity-100",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          <span className="font-medium text-foreground">{factor.label}</span>
          {leaderName ? (
            <span className="text-sm text-muted-foreground">Favors {leaderName}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{factor.impact === "positive" ? "Advantage" : "Disadvantage"}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{factor.description}</p>
        {contribution ? (
          <p className="text-xs text-muted-foreground">
            Contribution rank #{contribution.rank} · {contribution.shareOfTotal}% of total modeled gap
          </p>
        ) : null}
      </button>
    </li>
  );
}
