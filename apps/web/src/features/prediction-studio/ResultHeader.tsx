import type { Team } from "@repo/shared";
import { Badge } from "@repo/ui";
import { MediaBackground } from "../../components/media/MediaBackground";
import { MEDIA_ASSETS } from "../../constants/media";

export interface ResultHeaderProps {
  winner: Team;
  loser: Team;
  confidence: number;
}

export function ResultHeader({ winner, loser, confidence }: ResultHeaderProps) {
  return (
    <div data-theme="dark" className="relative flex flex-col gap-2xs overflow-hidden rounded-lg p-md">
      <MediaBackground asset={MEDIA_ASSETS.cinematicTransitionLoop} scrim="full" />
      <div className="relative flex items-center gap-2xs">
        <Badge tone="brand">Predicted Winner</Badge>
        {confidence >= 80 ? <Badge tone="success">High Confidence</Badge> : null}
      </div>
      <h2 className="relative text-foreground">{winner.name}</h2>
      <p className="relative text-muted-foreground">
        favored over {loser.name}, {winner.region} vs {loser.region}
      </p>
    </div>
  );
}
