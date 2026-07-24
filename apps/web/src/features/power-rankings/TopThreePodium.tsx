import { StaggerGroup, StaggerItem } from "@repo/ui";
import type { VctTeamId } from "../../constants/vct";
import { SealedRankingCard } from "./SealedRankingCard";
import type { PowerRankingEntry } from "./rankingTypes";

export interface TopThreePodiumProps {
  /** Exactly 3 entries, already sliced by the caller. */
  entries: readonly PowerRankingEntry[];
  scopeLabel: string;
  /** true in Regional mode: rank 1 is the region's own #1, with "Global #N" as secondary context. */
  useRegionalRank: boolean;
  revealedTeamIds: ReadonlySet<VctTeamId>;
  onReveal: (teamId: VctTeamId) => void;
  onOpenDossier: (teamId: VctTeamId) => void;
}

/**
 * The podium's visual order is #2 (left), #1 (center, elevated), #3 (right) —
 * only the layout position changes; the underlying `entries` array (and thus
 * each card's fixed rank) is never reordered.
 */
export function TopThreePodium({
  entries,
  scopeLabel,
  useRegionalRank,
  revealedTeamIds,
  onReveal,
  onOpenDossier,
}: TopThreePodiumProps) {
  const [first, second, third] = entries;
  if (!first || !second || !third) return null;

  const podiumOrder = [
    { entry: second, elevated: false },
    { entry: first, elevated: true },
    { entry: third, elevated: false },
  ];

  return (
    <StaggerGroup className="grid grid-cols-1 items-end gap-md sm:grid-cols-3" stagger={0.1}>
      {podiumOrder.map(({ entry, elevated }) => {
        const primaryRank = useRegionalRank ? entry.regionalRank : entry.globalRank;
        const secondaryRankLabel = useRegionalRank ? `Global #${entry.globalRank}` : undefined;

        return (
          <StaggerItem key={entry.team.id} className={elevated ? "sm:scale-105" : undefined}>
            <SealedRankingCard
              entry={entry}
              primaryRank={primaryRank}
              secondaryRankLabel={secondaryRankLabel}
              scopeLabel={scopeLabel}
              revealed={revealedTeamIds.has(entry.team.id)}
              onReveal={() => onReveal(entry.team.id)}
              onOpenDossier={() => onOpenDossier(entry.team.id)}
            />
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}
