import Image from "next/image";
import { Card, SplitBar } from "@repo/ui";
import { AdvantageBadge } from "../team-comparison/AdvantageBadge";
import { getMapArtworkPath } from "../prediction-studio/mapArtwork";
import { AttackDefenseSplit } from "./AttackDefenseSplit";
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
 *
 * TASK-058 — the map name/score/explanation block is now a real-artwork
 * "spatial core" hero (this feature's primary visual anchor: no per-map
 * position/route data exists anywhere in the codebase, so the artwork plus
 * this truthful textual summary stands in for a heatmap rather than
 * fabricating one). `attackStrength`/`defenseStrength` are pulled out of
 * `supportingMetrics` into `AttackDefenseSplit`; the remaining metrics
 * render as a card grid instead of an equal-weight stacked list.
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

  const artworkPath = getMapArtworkPath(activeRow.mapId);
  const attackMetric = supportingMetrics.find((metric) => metric.key === "attackStrength");
  const defenseMetric = supportingMetrics.find((metric) => metric.key === "defenseStrength");
  const otherMetrics = supportingMetrics.filter(
    (metric) => metric.key !== "attackStrength" && metric.key !== "defenseStrength",
  );

  return (
    <div className="flex flex-col gap-lg">
      <div className="relative flex min-h-[220px] flex-col justify-end gap-md overflow-hidden rounded-lg border border-accent-cyan/30 p-md shadow-[0_0_28px_-10px_var(--color-accent-cyan)] md:min-h-[280px]">
        {artworkPath ? (
          <Image
            src={artworkPath}
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover"
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-md">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <h2 className="text-2xl font-semibold text-foreground">{activeRow.mapName}</h2>
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

          {explanation ? <p className="text-sm text-foreground">{explanation}</p> : null}

          <p className="text-sm text-muted-foreground">
            {activeRow.selected
              ? "This map is included in your selected pool."
              : "This map is not currently in your selected pool."}
          </p>
        </div>
      </div>

      <AttackDefenseSplit teamAName={teamAName} teamBName={teamBName} attack={attackMetric} defense={defenseMetric} />

      <div className="flex flex-col gap-sm">
        <span className="text-sm font-medium text-foreground">Supporting profile metrics</span>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {otherMetrics.map((metric) => (
            <Card key={metric.key} variant="metric" className="flex flex-col gap-2xs">
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
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
