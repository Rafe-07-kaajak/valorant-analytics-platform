import { SplitBar } from "@repo/ui";
import { AdvantageBadge } from "./AdvantageBadge";
import { MapHighlightCard } from "./MapHighlightCard";
import type { MapComparisonRow, MapHighlight } from "../../lib/teamComparison";

export interface MapsTabProps {
  teamAName: string;
  teamBName: string;
  rows: MapComparisonRow[];
  mostEvenMap: MapComparisonRow | null;
  largestGapMap: MapComparisonRow | null;
  strongestA: MapHighlight | null;
  weakestA: MapHighlight | null;
  strongestB: MapHighlight | null;
  weakestB: MapHighlight | null;
}

/**
 * Full-roster map overview only — no map-selection controls here (that's
 * TASK-036). Every row shows both teams' modeled map strength, never framed
 * as an official win rate.
 */
export function MapsTab({
  teamAName,
  teamBName,
  rows,
  mostEvenMap,
  largestGapMap,
  strongestA,
  weakestA,
  strongestB,
  weakestB,
}: MapsTabProps) {
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <MapHighlightCard teamName={teamAName} accent="team-a" strongest={strongestA} weakest={weakestA} />
        <MapHighlightCard teamName={teamBName} accent="team-b" strongest={strongestB} weakest={weakestB} />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="rounded-md border border-surface-border bg-surface p-sm text-sm">
          <span className="font-medium text-foreground">Most evenly matched map</span>
          <p className="text-muted-foreground">
            {mostEvenMap ? `${mostEvenMap.mapName}: modeled gap of ${mostEvenMap.magnitude}` : "Not available"}
          </p>
        </div>
        <div className="rounded-md border border-surface-border bg-surface p-sm text-sm">
          <span className="font-medium text-foreground">Largest modeled gap</span>
          <p className="text-muted-foreground">
            {largestGapMap ? `${largestGapMap.mapName}: modeled gap of ${largestGapMap.magnitude}` : "Not available"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-sm" role="list" aria-label="Modeled map strength by map">
        {rows.map((row) => (
          <div
            key={row.mapId}
            role="listitem"
            className="flex flex-col gap-2xs rounded-md p-2xs transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:bg-surface-border/30 focus-within:bg-surface-border/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2xs">
              <span className="text-sm font-medium text-foreground">{row.mapName}</span>
              <AdvantageBadge advantage={row.advantage} tier={row.tier} teamAName={teamAName} teamBName={teamBName} />
            </div>
            <SplitBar
              segments={[
                { id: "a", label: teamAName, value: row.scoreA, color: "var(--team-a)" },
                { id: "b", label: teamBName, value: row.scoreB, color: "var(--team-b)" },
              ]}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Map strength is a modeled estimate per map, not an official win rate.
      </p>
    </div>
  );
}
