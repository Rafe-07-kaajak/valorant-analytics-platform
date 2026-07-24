import type { GameMap } from "@repo/shared";
import { Badge, buttonVariants, Drawer } from "@repo/ui";
import Link from "next/link";
import { MapHighlightCard } from "../team-comparison/MapHighlightCard";
import { EMPTY_CANONICAL_URL_STATE, buildFeatureHref } from "../../lib/urlState";
import { RankMovementBadge } from "./RankMovementBadge";
import { PowerScoreBreakdown } from "./PowerScoreBreakdown";
import { DataConfidenceBadge } from "./DataConfidenceBadge";
import { TeamLogo } from "../../components/TeamLogo";
import { strongestMapForProfile, weakestMapForProfile, type RankingMapHighlight } from "./rankingModel";
import type { PowerRankingEntry } from "./rankingTypes";

const REGION_BADGE_TONE = {
  americas: "regionAmericas",
  emea: "regionEmea",
  pacific: "regionPacific",
  china: "regionChina",
} as const;

export interface TeamDossierProps {
  entry: PowerRankingEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Global #4" or "Pacific #2 (Global #11)". */
  contextLabel: string;
  maps: readonly GameMap[];
}

/**
 * The Team Dossier detail panel, built on the shared `Drawer` (its only
 * consumer so far besides mobile nav) widened via `className` for the
 * richer content here — no edit to `Drawer.tsx` itself, since `cn()`'s
 * tailwind-merge already resolves the conflicting `w-*` utility correctly.
 * An overlay drawer keeps the board visible (dimmed) underneath and gets
 * Radix's focus trap/`Escape`/scroll-lock for free, rather than a bespoke
 * split-panel layout.
 *
 * The synthetic path (`entry.profile` present) keeps its original
 * strongest/weakest per-map highlight card. The real-data path
 * (`entry.profile` absent — see `rankingTypes.ts`) shows a single honest map
 * depth aggregate instead: the real ingested feature set has no per-map
 * breakdown to draw a strongest/weakest comparison from, and fabricating one
 * would misrepresent the data's actual granularity.
 */
export function TeamDossier({ entry, open, onOpenChange, contextLabel, maps }: TeamDossierProps) {
  if (!entry) return null;

  const isRealData = entry.profile === undefined;
  const mapNameById = new Map(maps.map((map) => [map.id, map.name]));

  const toHighlight = (highlight: RankingMapHighlight | null) =>
    highlight ? { mapId: highlight.mapId, mapName: mapNameById.get(highlight.mapId) ?? highlight.mapId, score: highlight.score } : null;

  const strongest = entry.profile ? strongestMapForProfile(entry.profile) : null;
  const weakest = entry.profile ? weakestMapForProfile(entry.profile) : null;

  const crossFeatureState = { ...EMPTY_CANONICAL_URL_STATE, teamA: entry.team.id, regionA: entry.team.region };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel={`${entry.team.name} ranking dossier`}
      className="w-[min(24rem,100%)] overflow-y-auto md:w-[min(30rem,100%)] lg:w-[min(38rem,100%)]"
    >
      <div className="flex items-center gap-sm border-b border-surface-border pb-sm">
        <TeamLogo team={entry.team} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{entry.team.name}</p>
          <div className="flex flex-wrap items-center gap-2xs">
            <Badge tone={REGION_BADGE_TONE[entry.team.region]}>{entry.team.region.toUpperCase()}</Badge>
            <span className="text-xs text-muted-foreground">{contextLabel}</span>
            {entry.dataConfidence ? <DataConfidenceBadge confidence={entry.dataConfidence} seriesCountInWindow={entry.seriesCountInWindow} /> : null}
          </div>
        </div>
      </div>

      <PowerScoreBreakdown profile={entry.profile} explainability={entry.explainability} mapDepthScore={entry.mapDepthScore} powerScore={entry.powerScore} />

      <RankMovementBadge />

      {isRealData ? (
        <div className="flex flex-col gap-3xs rounded-md border border-surface-border bg-surface p-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Map depth</span>
          <p className="text-sm text-foreground">Aggregate map-depth score: {entry.mapDepthScore.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">
            A per-map strongest/weakest breakdown isn&apos;t available for real match data yet: only an aggregate across the team&apos;s map history is shown, never a fabricated per-map value.
          </p>
        </div>
      ) : (
        <MapHighlightCard teamName={entry.team.name} accent="team-a" strongest={toHighlight(strongest)} weakest={toHighlight(weakest)} />
      )}

      <div className="mt-auto flex flex-col gap-2xs border-t border-surface-border pt-sm">
        <Link
          href={buildFeatureHref("prediction-studio", crossFeatureState)}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Predict {entry.team.name}&apos;s next match
        </Link>
        <Link
          href={buildFeatureHref("team-comparison", crossFeatureState)}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Compare {entry.team.name}
        </Link>
        <Link
          href={buildFeatureHref("map-matchup", crossFeatureState)}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Explore {entry.team.name}&apos;s maps
        </Link>
      </div>
    </Drawer>
  );
}
