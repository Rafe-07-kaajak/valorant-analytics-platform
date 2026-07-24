import { StaggerGroup, StaggerItem } from "@repo/ui";
import type { VctTeamId } from "../../constants/vct";
import { RankingTeamCard } from "./RankingTeamCard";
import type { PowerRankingEntry } from "./rankingTypes";

export interface RankingBoardProps {
  /** Ranks 4+ (Global) or ranks 4-8 (Regional) — the Top 3 podium renders separately. */
  entries: readonly PowerRankingEntry[];
  scopeLabel: string;
  useRegionalRank: boolean;
  onOpenDossier: (teamId: VctTeamId) => void;
}

/**
 * Visible ranking rows, never sealed. Mirrors `MapsTab`'s existing
 * `role="list"` convention. `role="list"`/`aria-label` live on a plain outer
 * `<div>` rather than on `StaggerGroup` itself, since `StaggerGroup` doesn't
 * forward arbitrary props to its rendered element. The generic (roleless)
 * `StaggerGroup`/`StaggerItem` wrapper elements in between don't break the
 * list/listitem relationship for assistive tech, which prunes roleless
 * containers when walking the accessibility tree.
 */
export function RankingBoard({ entries, scopeLabel, useRegionalRank, onOpenDossier }: RankingBoardProps) {
  return (
    <div role="list" aria-label={`${scopeLabel} power ranking, rank 4 and below`}>
      <StaggerGroup className="flex flex-col gap-sm">
        {entries.map((entry) => {
          const primaryRank = useRegionalRank ? entry.regionalRank : entry.globalRank;
          const secondaryRankLabel = useRegionalRank ? `Global #${entry.globalRank}` : undefined;

          return (
            <StaggerItem key={entry.team.id} distance={12}>
              <RankingTeamCard
                entry={entry}
                primaryRank={primaryRank}
                secondaryRankLabel={secondaryRankLabel}
                onOpenDossier={() => onOpenDossier(entry.team.id)}
              />
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
}
