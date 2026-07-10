import type { Team } from "@repo/shared";
import { Badge } from "@repo/ui";

export interface ResultHeaderProps {
  winner: Team;
  loser: Team;
  confidence: number;
}

export function ResultHeader({ winner, loser, confidence }: ResultHeaderProps) {
  return (
    <div className="flex flex-col gap-2xs">
      <div className="flex items-center gap-2xs">
        <Badge tone="brand">Predicted Winner</Badge>
        {confidence >= 80 ? <Badge tone="success">High Confidence</Badge> : null}
      </div>
      <h2>{winner.name}</h2>
      <p className="text-muted-foreground">
        favored over {loser.name} — {winner.region} vs {loser.region}
      </p>
    </div>
  );
}
