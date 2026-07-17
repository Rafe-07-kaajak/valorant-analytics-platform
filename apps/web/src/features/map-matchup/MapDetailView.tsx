import { Card, SplitBar } from "@repo/ui";
import { AdvantageBadge } from "../team-comparison/AdvantageBadge";
import type { MapRankingRow, SupportingMetric } from "../../lib/mapMatchup";

export interface MapDetailViewProps {
  teamAName: string;
  teamBName: string;
  activeRow: MapRankingRow | null;
  explanation: string | null;
  supportingMetrics: SupportingMetric[];
}

/**
 * A focused single-map panel — deliberately not a repeat of TASK-035's
 * Team DNA tab (no radar chart here, just the paired metrics relevant to
 * this one map's modeled gap).
 */
export function MapDetailView({
  teamAName,
  teamBName,
  activeRow,
  explanation,
  supportingMetrics,
}: MapDetailViewProps) {
  if (!activeRow) {
    return (
      <Card className="flex flex-col gap-2xs">
        <p className="font-medium text-foreground">No map to show yet.</p>
        <p className="text-sm text-muted-foreground">
          Select both teams above, then choose a map from the Map Ranking view.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <Card className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h2 className="text-lg font-semibold text-foreground">{activeRow.mapName}</h2>
          <AdvantageBadge
            advantage={activeRow.advantage}
            tier={activeRow.tier}
            teamAName={teamAName}
            teamBName={teamBName}
          />
        </div>

        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="flex items-center gap-2xs text-foreground">
            <span className="inline-block size-2 rounded-full bg-team-a" aria-hidden="true" />
            {teamAName}: {Math.round(activeRow.scoreA)}
          </span>
          <span className="text-muted-foreground">Modeled gap: {activeRow.magnitude}</span>
          <span className="flex items-center gap-2xs text-foreground">
            <span className="inline-block size-2 rounded-full bg-team-b" aria-hidden="true" />
            {teamBName}: {Math.round(activeRow.scoreB)}
          </span>
        </div>

        {explanation ? <p className="text-sm text-muted-foreground">{explanation}</p> : null}

        <p className="text-sm text-foreground">
          {activeRow.selected
            ? "This map is included in your selected pool."
            : "This map is not currently in your selected pool."}
        </p>
      </Card>

      <div className="flex flex-col gap-md">
        <span className="text-sm font-medium text-foreground">Supporting profile metrics</span>
        {supportingMetrics.map((metric) => (
          <div key={metric.key} className="flex flex-col gap-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2xs">
              <span className="text-sm font-medium text-foreground">
                {metric.label.charAt(0).toUpperCase() + metric.label.slice(1)}
              </span>
              <AdvantageBadge
                advantage={metric.advantage}
                tier={metric.tier}
                teamAName={teamAName}
                teamBName={teamBName}
              />
            </div>
            <SplitBar
              segments={[
                { id: "a", label: teamAName, value: metric.valueA, color: "var(--team-a)" },
                { id: "b", label: teamBName, value: metric.valueB, color: "var(--team-b)" },
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
