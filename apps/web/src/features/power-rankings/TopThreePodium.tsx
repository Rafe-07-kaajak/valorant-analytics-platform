import { StaggerGroup, StaggerItem, cn } from "@repo/ui";
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
 * Desktop (`sm:` and up) visual order is #2 (left), #1 (center, elevated),
 * #3 (right) — unchanged from before. Mobile (below `sm:`) visual order is
 * #1, #2, #3 top-to-bottom. Both are achieved purely with the CSS `order`
 * property: the underlying `entries` array, DOM order, and each card's fixed
 * rank are never reordered, so `StaggerGroup`'s stagger sequence (which
 * follows JSX/render order) is identical to before at every breakpoint —
 * only the visual box order changes on mobile.
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
    { entry: second, elevated: false, mobileOrder: "order-2 sm:order-none" },
    { entry: first, elevated: true, mobileOrder: "order-1 sm:order-none" },
    { entry: third, elevated: false, mobileOrder: "order-3 sm:order-none" },
  ];

  return (
    <StaggerGroup className="grid grid-cols-1 items-end gap-md sm:grid-cols-3" stagger={0.1}>
      {podiumOrder.map(({ entry, elevated, mobileOrder }) => {
        const primaryRank = useRegionalRank ? entry.regionalRank : entry.globalRank;
        const secondaryRankLabel = useRegionalRank ? `Global #${entry.globalRank}` : undefined;

        return (
          <StaggerItem key={entry.team.id} className={cn(mobileOrder, elevated ? "sm:scale-105" : undefined)}>
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
