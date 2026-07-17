import type { Team } from "@repo/shared";
import { cn } from "@repo/ui";
import { DnaComparisonRadar } from "../../match-dna/DnaComparisonRadar";
import { dimensionRowHandlers } from "./useDimensionRowHandlers";
import type { BreakdownController } from "./useBreakdownState";
import type { DnaGapRow } from "../../../lib/predictionBreakdown";

export interface MatchDnaTabProps {
  teamA: Team;
  teamB: Team;
  teamADna: Parameters<typeof DnaComparisonRadar>[0]["teamADna"];
  teamBDna: Parameters<typeof DnaComparisonRadar>[0]["teamBDna"];
  rows: DnaGapRow[];
  largestGapExplanation: string;
  breakdown: BreakdownController;
}

/**
 * `RadarChart`'s data points remain fully static and unmodified (no radar
 * value changes, no rewrite of the shared chart primitive) — the
 * interactive surface here is the paired-metric table beside/below it,
 * which also doubles as the radar's required full text alternative.
 */
export function MatchDnaTab({
  teamA,
  teamB,
  teamADna,
  teamBDna,
  rows,
  largestGapExplanation,
  breakdown,
}: MatchDnaTabProps) {
  return (
    <div className="flex flex-col gap-lg lg:grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start lg:gap-lg">
      <div className="flex justify-center">
        <DnaComparisonRadar teamA={teamA} teamADna={teamADna} teamB={teamB} teamBDna={teamBDna} />
      </div>

      <div className="flex flex-col gap-md">
        <p className="text-sm text-muted-foreground">{largestGapExplanation}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <caption className="sr-only">
              Team DNA dimension comparison for {teamA.name} and {teamB.name} — a text alternative to the
              radar chart, and the interactive surface for highlighting a dimension.
            </caption>
            <thead>
              <tr className="border-b border-surface-border text-left text-muted-foreground">
                <th scope="col" className="py-2xs pr-sm font-medium">
                  Dimension
                </th>
                <th scope="col" className="py-2xs pr-sm font-medium">
                  {teamA.name}
                </th>
                <th scope="col" className="py-2xs pr-sm font-medium">
                  {teamB.name}
                </th>
                <th scope="col" className="py-2xs font-medium">
                  Gap
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = breakdown.selectedDimensionKey === row.key;
                const isActive = breakdown.activeDimensionKey === row.key;
                const leaderName = row.advantage === "A" ? teamA.name : row.advantage === "B" ? teamB.name : null;

                return (
                  <tr
                    key={row.key}
                    tabIndex={0}
                    role="button"
                    aria-current={isSelected}
                    aria-label={
                      leaderName
                        ? `${row.label}: ${leaderName} leads, gap of ${row.magnitude}`
                        : `${row.label}: balanced, gap of ${row.magnitude}`
                    }
                    {...dimensionRowHandlers(row.key, breakdown)}
                    className={cn(
                      "cursor-pointer border-b border-surface-border/60 last:border-0",
                      "motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                      isSelected ? "bg-brand-400/10" : isActive ? "bg-surface-border/40" : "",
                      !isActive && !isSelected && breakdown.activeDimensionKey ? "opacity-70" : "opacity-100",
                    )}
                  >
                    <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                      {row.label}
                    </th>
                    <td className="py-2xs pr-sm text-foreground">{Math.round(row.valueA)}</td>
                    <td className="py-2xs pr-sm text-foreground">{Math.round(row.valueB)}</td>
                    <td className="py-2xs text-foreground">
                      {leaderName ? `${leaderName} +${row.magnitude}` : "Balanced"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
