import { RadarChart, cn } from "@repo/ui";
import type { CurrentPredictionResponse } from "@repo/shared";
import { buildRealTeamStateAxisRows, buildRealTeamStateRadar } from "./realViewModels";
import { realFactorRowHandlers } from "./useRealFactorRowHandlers";
import type { RealBreakdownController } from "./useRealBreakdownState";

export interface RealTeamStateTabProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
  breakdown: RealBreakdownController;
}

/**
 * Real Model equivalent of the synthetic breakdown's Match DNA tab — same
 * radar-plus-paired-metric-table shape (the table is also the radar's
 * required text alternative), but every axis is a real, honest metric (see
 * `realViewModels.ts#buildRealTeamStateAxisRows`), never synthetic Team DNA
 * vocabulary. The radar itself reuses the shared `RadarChart` primitive
 * unmodified.
 */
export function RealTeamStateTab({ result, teamAName, teamBName, breakdown }: RealTeamStateTabProps) {
  const rows = buildRealTeamStateAxisRows(result);
  const { axes, series } = buildRealTeamStateRadar(result, teamAName, teamBName);

  return (
    <div className="flex flex-col gap-lg lg:grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start lg:gap-lg">
      <div className="flex justify-center">
        <RadarChart axes={axes} series={series} />
      </div>

      <div className="flex flex-col gap-md">
        <p className="text-sm text-muted-foreground">
          Every axis below is a real metric read directly from ingested match data, scaled to a common 0-100
          chart range. Raw values and their scaling are shown in the table.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <caption className="sr-only">
              Real team state comparison for {teamAName} and {teamBName}, a text alternative to the radar
              chart, and the interactive surface for highlighting an axis.
            </caption>
            <thead>
              <tr className="border-b border-surface-border text-left text-muted-foreground">
                <th scope="col" className="py-2xs pr-sm font-medium">
                  Metric
                </th>
                <th scope="col" className="py-2xs pr-sm font-medium">
                  {teamAName} (raw)
                </th>
                <th scope="col" className="py-2xs pr-sm font-medium">
                  {teamBName} (raw)
                </th>
                <th scope="col" className="py-2xs font-medium">
                  Chart scale (0-100)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = breakdown.selectedFactorId === row.key;
                const isActive = breakdown.activeFactorId === row.key;

                return (
                  <tr
                    key={row.key}
                    tabIndex={0}
                    role="button"
                    aria-current={isSelected}
                    aria-label={`${row.label}: ${teamAName} ${row.teamARaw.toFixed(2)}, ${teamBName} ${row.teamBRaw.toFixed(2)}. ${row.explanation}`}
                    {...realFactorRowHandlers(row.key, breakdown)}
                    className={cn(
                      "cursor-pointer border-b border-surface-border/60 last:border-0",
                      "motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                      isSelected ? "bg-brand-400/10" : isActive ? "bg-surface-border/40" : "",
                      !isActive && !isSelected && breakdown.activeFactorId ? "opacity-70" : "opacity-100",
                    )}
                  >
                    <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                      {row.label}
                    </th>
                    <td className="py-2xs pr-sm text-foreground">{row.teamARaw.toFixed(2)}</td>
                    <td className="py-2xs pr-sm text-foreground">{row.teamBRaw.toFixed(2)}</td>
                    <td className="py-2xs text-foreground">
                      {Math.round(row.teamADisplay)} / {Math.round(row.teamBDisplay)}
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
