import { Card, cn } from "@repo/ui";
import type { MapHighlight } from "../../lib/teamComparison";

export interface MapHighlightCardProps {
  teamName: string;
  accent: "team-a" | "team-b";
  strongest: MapHighlight | null;
  weakest: MapHighlight | null;
}

/**
 * A static, non-clickable info card (Level 4 per the TASK-033 interaction
 * hierarchy) — no lift, no card-local spotlight, since it never leads to an
 * action.
 */
export function MapHighlightCard({ teamName, accent, strongest, weakest }: MapHighlightCardProps) {
  return (
    <Card className="flex flex-col gap-xs">
      <div className="flex items-center gap-2xs">
        <span
          className={cn("inline-block size-2.5 rounded-full", accent === "team-a" ? "bg-team-a" : "bg-team-b")}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-foreground">{teamName} map range</span>
      </div>
      <dl className="flex flex-col gap-2xs text-sm">
        <div className="flex items-center justify-between gap-sm">
          <dt className="text-muted-foreground">Strongest map</dt>
          <dd className="font-medium text-foreground">
            {strongest ? `${strongest.mapName} · ${Math.round(strongest.score)}` : "Not available"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-sm">
          <dt className="text-muted-foreground">Weakest map</dt>
          <dd className="font-medium text-foreground">
            {weakest ? `${weakest.mapName} · ${Math.round(weakest.score)}` : "Not available"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
