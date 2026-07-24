import type { VctTeamId } from "../../constants/vct";
import { TopThreePodium } from "./TopThreePodium";
import { RankingBoard } from "./RankingBoard";
import type { PowerRankingEntry } from "./rankingTypes";

export interface GlobalRankingViewProps {
  /** All 32 entries, globally sorted. */
  entries: readonly PowerRankingEntry[];
  revealedTeamIds: ReadonlySet<VctTeamId>;
  onReveal: (teamId: VctTeamId) => void;
  onOpenDossier: (teamId: VctTeamId) => void;
}

export function GlobalRankingView({ entries, revealedTeamIds, onReveal, onOpenDossier }: GlobalRankingViewProps) {
  return (
    <div className="flex flex-col gap-lg">
      <TopThreePodium
        entries={entries.slice(0, 3)}
        scopeLabel="Global"
        useRegionalRank={false}
        revealedTeamIds={revealedTeamIds}
        onReveal={onReveal}
        onOpenDossier={onOpenDossier}
      />
      <RankingBoard
        entries={entries.slice(3)}
        scopeLabel="Global"
        useRegionalRank={false}
        onOpenDossier={onOpenDossier}
      />
    </div>
  );
}
