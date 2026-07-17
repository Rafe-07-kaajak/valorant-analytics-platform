import type { ReactNode } from "react";
import { Card } from "@repo/ui";
import { AdvantageBadge } from "../team-comparison/AdvantageBadge";
import type { MapComparisonRow, PoolAggregate } from "../../lib/mapMatchup";

export interface SelectedPoolViewProps {
  teamAName: string;
  teamBName: string;
  aggregate: PoolAggregate | null;
  summary: string | null;
  poolRows: MapComparisonRow[];
}

/**
 * Static summary/highlight cards throughout — no lift, no card-local
 * spotlight (per requirement 13, "static summary cards must not lift or
 * glow like buttons"), since nothing here is clickable.
 */
export function SelectedPoolView({ teamAName, teamBName, aggregate, summary, poolRows }: SelectedPoolViewProps) {
  if (!aggregate || !summary) {
    return (
      <Card className="flex flex-col gap-2xs">
        <p className="font-medium text-foreground">No maps selected yet.</p>
        <p className="text-sm text-muted-foreground">
          Select one or more maps in the pool above to see an aggregate modeled picture across them.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <Card>
        <p className="text-foreground">{summary}</p>
      </Card>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <StatCard label="Average modeled strength">
          <div className="flex items-center justify-between gap-sm text-sm">
            <span className="flex items-center gap-2xs text-foreground">
              <span className="inline-block size-2 rounded-full bg-team-a" aria-hidden="true" />
              {teamAName}: {aggregate.averageA}
            </span>
            <span className="flex items-center gap-2xs text-foreground">
              <span className="inline-block size-2 rounded-full bg-team-b" aria-hidden="true" />
              {teamBName}: {aggregate.averageB}
            </span>
          </div>
        </StatCard>

        <StatCard label="Aggregate advantage">
          <AdvantageBadge
            advantage={aggregate.advantage}
            tier={aggregate.tier}
            teamAName={teamAName}
            teamBName={teamBName}
          />
        </StatCard>

        <StatCard label="Maps by side">
          <dl className="flex flex-col gap-3xs text-sm">
            <Row label={`Favoring ${teamAName}`} value={aggregate.favoringA} />
            <Row label={`Favoring ${teamBName}`} value={aggregate.favoringB} />
            <Row label="Close/even" value={aggregate.close} />
          </dl>
        </StatCard>

        <StatCard label="Pool size">
          <span className="text-sm text-foreground">
            {aggregate.mapCount} {aggregate.mapCount === 1 ? "map" : "maps"} selected
          </span>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <HighlightCard label={`Strongest for ${teamAName}`} row={aggregate.strongestA} />
        <HighlightCard label={`Strongest for ${teamBName}`} row={aggregate.strongestB} />
        <HighlightCard label="Closest matchup" row={aggregate.closest} />
        <HighlightCard label="Largest modeled gap" row={aggregate.largestGap} />
      </div>

      <div className="flex flex-col gap-2xs">
        <span className="text-sm font-medium text-foreground">Maps in this pool</span>
        <ul className="flex flex-col gap-2xs" aria-label="Selected map pool">
          {poolRows.map((row) => (
            <li
              key={row.mapId}
              className="flex items-center justify-between gap-sm rounded-md border border-surface-border bg-surface p-2xs text-sm"
            >
              <span className="text-foreground">{row.mapName}</span>
              <span className="text-muted-foreground">
                {teamAName} {Math.round(row.scoreA)} · {teamBName} {Math.round(row.scoreB)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2xs">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function HighlightCard({ label, row }: { label: string; row: MapComparisonRow | null }) {
  return (
    <Card className="flex flex-col gap-2xs">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{row ? row.mapName : "Not available"}</span>
      {row ? <span className="text-sm text-muted-foreground">Modeled gap: {row.magnitude}</span> : null}
    </Card>
  );
}
