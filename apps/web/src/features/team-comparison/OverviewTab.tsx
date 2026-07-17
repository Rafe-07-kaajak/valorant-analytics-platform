import { SplitBar } from "@repo/ui";
import { AdvantageBadge } from "./AdvantageBadge";
import { MapHighlightCard } from "./MapHighlightCard";
import type { ComparisonMetric, MapHighlight } from "../../lib/teamComparison";

export interface OverviewTabProps {
  teamAName: string;
  teamBName: string;
  metrics: ComparisonMetric[];
  strongestA: MapHighlight | null;
  weakestA: MapHighlight | null;
  strongestB: MapHighlight | null;
  weakestB: MapHighlight | null;
}

/**
 * Overview tab: paired 0-100 metrics as split bars (proportional read of two
 * independent scores, not a true part-of-a-whole), the round-differential
 * metric as a compact signed stat card since it can be negative (SplitBar
 * assumes non-negative values), and one map-range card per team.
 */
export function OverviewTab({
  teamAName,
  teamBName,
  metrics,
  strongestA,
  weakestA,
  strongestB,
  weakestB,
}: OverviewTabProps) {
  const roundDifferential = metrics.find((metric) => metric.key === "roundDifferential");
  const barMetrics = metrics.filter((metric) => metric.key !== "roundDifferential");

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-md">
        {barMetrics.map((metric) => (
          <div key={metric.key} className="flex flex-col gap-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2xs">
              <span className="text-sm font-medium text-foreground">{metric.label}</span>
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

      {roundDifferential ? (
        <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm">
          <div className="flex flex-wrap items-center justify-between gap-2xs">
            <span className="text-sm font-medium text-foreground">{roundDifferential.label}</span>
            <AdvantageBadge
              advantage={roundDifferential.advantage}
              tier={roundDifferential.tier}
              teamAName={teamAName}
              teamBName={teamBName}
            />
          </div>
          <div className="flex items-center justify-between gap-sm text-sm">
            <span className="flex items-center gap-2xs text-foreground">
              <span className="inline-block size-2 rounded-full bg-team-a" aria-hidden="true" />
              {teamAName}: {roundDifferential.valueA > 0 ? "+" : ""}
              {roundDifferential.valueA.toFixed(1)}
            </span>
            <span className="flex items-center gap-2xs text-foreground">
              <span className="inline-block size-2 rounded-full bg-team-b" aria-hidden="true" />
              {teamBName}: {roundDifferential.valueB > 0 ? "+" : ""}
              {roundDifferential.valueB.toFixed(1)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <MapHighlightCard teamName={teamAName} accent="team-a" strongest={strongestA} weakest={weakestA} />
        <MapHighlightCard teamName={teamBName} accent="team-b" strongest={strongestB} weakest={weakestB} />
      </div>

      <p className="text-xs text-muted-foreground">
        All values are modeled estimates on a 0-100 scale (round differential excepted), not official statistics.
      </p>
    </div>
  );
}
