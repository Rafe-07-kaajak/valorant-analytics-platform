import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@repo/ui";
import type { DnaDimensionKey } from "@repo/shared";
import type { ContributionRow } from "../../../lib/predictionBreakdown";
import type { BreakdownController } from "./useBreakdownState";
import { dimensionRowHandlers } from "./useDimensionRowHandlers";

export interface FeatureContributionChartProps {
  rows: ContributionRow[];
  teamAName: string;
  teamBName: string;
  breakdown: BreakdownController;
}

/**
 * TASK-037 interactive upgrade — `FeatureContribution.tsx` (the original
 * static `Meter`-list primitive) is left completely unmodified and still
 * exported/reused elsewhere; this is a new, separate component. Each row is
 * a real keyboard-reachable `<button>` with a single accessible name
 * carrying everything a screen reader needs (label, direction, signed
 * value, share of total) — no information is hover-only.
 */
export function FeatureContributionChart({ rows, teamAName, teamBName, breakdown }: FeatureContributionChartProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No single tracked dimension differs enough between these teams to stand out as a distinct
        contribution. The prediction leans on the aggregate profile instead.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-sm" aria-label="Feature contributions ranked by magnitude">
      {rows.map((row) => (
        <ContributionBarRow
          key={row.id}
          row={row}
          teamAName={teamAName}
          teamBName={teamBName}
          breakdown={breakdown}
        />
      ))}
    </ul>
  );
}

function ContributionBarRow({
  row,
  teamAName,
  teamBName,
  breakdown,
}: {
  row: ContributionRow;
  teamAName: string;
  teamBName: string;
  breakdown: BreakdownController;
}) {
  const dimensionKey = row.id as DnaDimensionKey;
  const isSelected = breakdown.selectedDimensionKey === dimensionKey;
  const isActive = breakdown.activeDimensionKey === dimensionKey;
  const directionTeam = row.direction === "A" ? teamAName : row.direction === "B" ? teamBName : null;
  const sign = row.magnitude > 0 && row.direction !== "neutral" ? (row.direction === "A" ? "+" : "−") : "";

  const accessibleName = directionTeam
    ? `${row.label}: favors ${directionTeam}, ${sign}${Math.round(row.magnitude)}, ${row.shareOfTotal}% of total contribution`
    : `${row.label}: neutral, no measurable edge`;

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected}
        {...dimensionRowHandlers(dimensionKey, breakdown)}
        aria-label={accessibleName}
        className={cn(
          "pointer-glow group flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
          "motion-safe:transition-[transform,border-color,box-shadow,opacity] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
          "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          isSelected
            ? "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]"
            : isActive
              ? "border-brand-400/70"
              : "border-surface-border",
          // Unrelated rows dim only slightly while another row is active/selected.
          !isActive && !isSelected && breakdown.activeDimensionKey ? "opacity-70" : "opacity-100",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          <span className="font-medium text-foreground">{row.label}</span>
          {directionTeam ? (
            <span className="flex items-center gap-3xs text-sm text-muted-foreground">
              {row.direction === "A" ? (
                <ArrowLeft className="size-3.5 text-team-a" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-3.5 text-team-b" aria-hidden="true" />
              )}
              Favors {directionTeam} · {sign}
              {Math.round(row.magnitude)} · {row.shareOfTotal}%
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Neutral</span>
          )}
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-border" aria-hidden="true">
          <div
            className={cn(
              "absolute inset-y-0 rounded-full motion-safe:transition-[width] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
              row.direction === "A" ? "right-1/2 bg-team-a" : row.direction === "B" ? "left-1/2 bg-team-b" : "left-1/2 w-0",
            )}
            style={{ width: `${Math.min(50, Math.abs(row.magnitude) / 2)}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground">{row.description}</p>
      </button>
    </li>
  );
}
