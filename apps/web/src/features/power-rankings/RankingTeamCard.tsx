import { Badge, Card, Meter } from "@repo/ui";
import { TeamLogo } from "../../components/TeamLogo";
import type { PowerRankingEntry } from "./rankingTypes";
import { resolveRecentFormIndex } from "./rankingModel";
import { RankMovementBadge } from "./RankMovementBadge";

const REGION_BADGE_TONE = {
  americas: "regionAmericas",
  emea: "regionEmea",
  pacific: "regionPacific",
  china: "regionChina",
} as const;

const REGION_DISPLAY_NAME = {
  americas: "Americas",
  emea: "EMEA",
  pacific: "Pacific",
  china: "China",
} as const;

export interface RankingTeamCardProps {
  entry: PowerRankingEntry;
  primaryRank: number;
  secondaryRankLabel?: string;
  onOpenDossier: () => void;
}

/**
 * One visible (never sealed) ranking row, ranks 4+ globally or 1-8
 * regionally. Built on the shared `Card variant="interactive"` — its
 * existing `--lift-card-info` hover lift already matches this row's spec'd
 * 4-7px hover range, so no new lift token is introduced here.
 */
export function RankingTeamCard({ entry, primaryRank, secondaryRankLabel, onOpenDossier }: RankingTeamCardProps) {
  const isRealData = entry.dataConfidence !== undefined;
  const scoreDescriptor = isRealData ? "real-data" : "modeled";

  return (
    <div role="listitem">
      <button
        type="button"
        onClick={onOpenDossier}
        aria-label={`Open dossier for ${entry.team.name}, rank ${primaryRank}, ${scoreDescriptor} Power Score ${entry.powerScore}`}
        className="block w-full text-left"
      >
        <Card
          variant="interactive"
          className="flex items-center gap-sm motion-safe:hover:scale-[1.02] motion-safe:focus-visible:scale-[1.02]"
        >
          <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted-foreground">#{primaryRank}</span>
          <TeamLogo team={entry.team} size={36} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2xs">
              <span className="truncate text-sm font-medium text-foreground">{entry.team.name}</span>
              <Badge tone={REGION_BADGE_TONE[entry.team.region]}>{REGION_DISPLAY_NAME[entry.team.region]}</Badge>
              {secondaryRankLabel ? <span className="text-xs text-muted-foreground">{secondaryRankLabel}</span> : null}
            </div>
            <Meter label={isRealData ? "Recent form" : "Recent form (modeled)"} value={resolveRecentFormIndex(entry)} tone="brand" className="pt-2xs" />
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2xs">
            <span className="text-sm font-semibold text-foreground">{entry.powerScore.toFixed(2)}</span>
            <RankMovementBadge />
          </div>
        </Card>
      </button>
    </div>
  );
}
