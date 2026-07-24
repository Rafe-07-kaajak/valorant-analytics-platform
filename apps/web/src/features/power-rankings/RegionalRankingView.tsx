import type { VctRegion, VctRegionId, VctTeamId } from "../../constants/vct";
import { RegionRankingTabs } from "./RegionRankingTabs";
import { TopThreePodium } from "./TopThreePodium";
import { RankingBoard } from "./RankingBoard";
import type { PowerRankingEntry } from "./rankingTypes";

export interface RegionalRankingViewProps {
  regions: readonly VctRegion[];
  /** From `groupEntriesByRegion`, computed once upstream. */
  entriesByRegion: Record<VctRegionId, PowerRankingEntry[]>;
  selectedRegion: VctRegionId;
  onRegionChange: (region: VctRegionId) => void;
  onOpenDossier: (teamId: VctTeamId) => void;
}

/**
 * Regional Rankings never hide a team — the user already went through the
 * sealed-reveal moment in Global mode, so no second reveal interaction is
 * needed here (spec section 13). `TopThreePodium` is still reused for the
 * premium podium layout, but every card in this view is passed as already
 * "revealed" (a no-op `onReveal`), so `SealedRankingCard` always renders its
 * face-up back face here, regardless of what's been revealed in Global mode.
 */
export function RegionalRankingView({
  regions,
  entriesByRegion,
  selectedRegion,
  onRegionChange,
  onOpenDossier,
}: RegionalRankingViewProps) {
  return (
    <RegionRankingTabs regions={regions} selectedRegion={selectedRegion} onRegionChange={onRegionChange}>
      {(regionId) => {
        const regionEntries = entriesByRegion[regionId] ?? [];
        const region = regions.find((candidate) => candidate.id === regionId);
        const alwaysRevealedIds = new Set(regionEntries.map((entry) => entry.team.id));

        return (
          <div className="flex flex-col gap-lg">
            <TopThreePodium
              entries={regionEntries.slice(0, 3)}
              scopeLabel={region?.name ?? regionId}
              useRegionalRank
              revealedTeamIds={alwaysRevealedIds}
              onReveal={() => {}}
              onOpenDossier={onOpenDossier}
            />
            <RankingBoard
              entries={regionEntries.slice(3)}
              scopeLabel={region?.name ?? regionId}
              useRegionalRank
              onOpenDossier={onOpenDossier}
            />
          </div>
        );
      }}
    </RegionRankingTabs>
  );
}
