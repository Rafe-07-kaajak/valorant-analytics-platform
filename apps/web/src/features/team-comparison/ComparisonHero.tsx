import { Card, cn } from "@repo/ui";
import { AdvantageBadge } from "./AdvantageBadge";
import { MapThumbnail } from "./MapThumbnail";
import type { ComparisonFactor, ComparisonMetric, MapHighlight } from "../../lib/teamComparison";

export interface ComparisonHeroProps {
  teamAName: string;
  teamBName: string;
  summary: string;
  /** Always "Overall Rating" — the first entry in `OVERVIEW_METRIC_DEFINITIONS`. */
  headlineMetric: ComparisonMetric;
  /** Already sorted most-significant-first by `deriveFactors`; the top entry is the largest modeled advantage. */
  topFactor: ComparisonFactor | undefined;
  strongestA: MapHighlight | null;
  strongestB: MapHighlight | null;
}

/**
 * TASK-057 — the result's entry point, replacing the single plain-text
 * summary card. Composed entirely from fields `buildComparisonViewModel`
 * already computes (no new derivation): the headline Overall Rating metric,
 * the top-ranked factor, each team's strongest map, and the existing neutral
 * summary sentence. Ordered per the task's hierarchy — overall result,
 * largest advantage, strongest area per team, context — with the
 * detailed per-metric breakdown left to the tabs below.
 */
export function ComparisonHero({
  teamAName,
  teamBName,
  summary,
  headlineMetric,
  topFactor,
  strongestA,
  strongestB,
}: ComparisonHeroProps) {
  return (
    <Card variant="result" className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          {/* Deliberately not `headlineMetric.label` itself ("Overall Rating") —
              the Overview tab below renders that exact row at the same time
              (Overview is the default tab), and Playwright's `getByText` matches
              by substring, not just exact text, so any wording containing it
              would collide with that row under a single-result query. */}
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Headline comparison
          </span>
          <AdvantageBadge
            advantage={headlineMetric.advantage}
            tier={headlineMetric.tier}
            teamAName={teamAName}
            teamBName={teamBName}
          />
        </div>
        <div className="flex items-center justify-between gap-md">
          {/* Colored dot, not colored text — text-team-a/text-team-b fails WCAG AA at
              typical sizes against the surface background (see SelectedTeamSummary). */}
          <span className="flex items-center gap-2xs text-2xl font-semibold text-foreground">
            <span className="inline-block size-2.5 rounded-full bg-team-a" aria-hidden="true" />
            {Math.round(headlineMetric.valueA)}
          </span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="flex items-center gap-2xs text-2xl font-semibold text-foreground">
            {Math.round(headlineMetric.valueB)}
            <span className="inline-block size-2.5 rounded-full bg-team-b" aria-hidden="true" />
          </span>
        </div>
      </div>

      <p className="text-foreground">{summary}</p>

      {topFactor ? (
        <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm">
          <div className="flex flex-wrap items-center justify-between gap-2xs">
            <span className="text-sm font-medium text-foreground">Largest modeled difference: {topFactor.title}</span>
            <AdvantageBadge
              advantage={topFactor.advantage}
              tier={topFactor.tier}
              teamAName={teamAName}
              teamBName={teamBName}
            />
          </div>
          <p className="text-sm text-muted-foreground">{topFactor.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <StrongestMapChip teamName={teamAName} accent="team-a" highlight={strongestA} />
        <StrongestMapChip teamName={teamBName} accent="team-b" highlight={strongestB} />
      </div>
    </Card>
  );
}

function StrongestMapChip({
  teamName,
  accent,
  highlight,
}: {
  teamName: string;
  accent: "team-a" | "team-b";
  highlight: MapHighlight | null;
}) {
  if (!highlight) return null;

  return (
    <div className="flex items-center gap-2xs rounded-md border border-surface-border bg-surface p-2xs">
      <MapThumbnail mapId={highlight.mapId} />
      <div className="flex min-w-0 flex-col gap-3xs">
        <span className="flex items-center gap-3xs text-xs font-medium text-muted-foreground">
          <span className={cn("inline-block size-2 rounded-full", accent === "team-a" ? "bg-team-a" : "bg-team-b")} aria-hidden="true" />
          {teamName} strongest
        </span>
        <span className="truncate text-sm font-medium text-foreground">
          {highlight.mapName} · {Math.round(highlight.score)}
        </span>
      </div>
    </div>
  );
}
