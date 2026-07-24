import type { CurrentPredictionResponse } from "@repo/shared";
import { Badge, Card, Meter, RadarChart } from "@repo/ui";
import { buildRealMatchupProfile, buildRealTeamStateAxisRows, buildRealTeamStateRadar } from "./realViewModels";

export interface RealTeamStateSectionProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
}

function RealTeamStateCard({
  teamName,
  accentColor,
  rows,
  isTeamA,
}: {
  teamName: string;
  accentColor: string;
  rows: ReturnType<typeof buildRealTeamStateAxisRows>;
  isTeamA: boolean;
}) {
  const strongest = [...rows].sort((a, b) => (isTeamA ? b.teamADisplay - a.teamADisplay : b.teamBDisplay - a.teamBDisplay)).slice(0, 2);

  return (
    <Card className="flex flex-col gap-xs">
      <div className="flex items-center gap-2xs">
        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        <span className="font-medium text-foreground">{teamName}</span>
      </div>
      <p className="text-sm text-muted-foreground">Strongest real metrics: {strongest.map((row) => row.label.toLowerCase()).join(" and ")}.</p>
      <div className="flex flex-wrap gap-2xs">
        {strongest.map((row) => (
          <Badge key={row.key} tone="brand">
            {row.label} &middot; {Math.round(isTeamA ? row.teamADisplay : row.teamBDisplay)}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

/**
 * Real Model equivalent of the synthetic "Match DNA" full section (below the
 * Interactive Breakdown) — real "Team State" radar plus per-team strongest-
 * metric cards plus a real "Matchup Profile" (never called "Team DNA" or
 * "playstyle similarity", since no real playstyle data exists — see
 * `realViewModels.ts#buildRealMatchupProfile`).
 */
export function RealTeamStateSection({ result, teamAName, teamBName }: RealTeamStateSectionProps) {
  const rows = buildRealTeamStateAxisRows(result);
  const { axes, series } = buildRealTeamStateRadar(result, teamAName, teamBName);
  const profile = buildRealMatchupProfile(result);

  return (
    <div className="flex flex-col gap-md">
      <h3>Real Team State</h3>
      <Card className="flex justify-center">
        <RadarChart axes={axes} series={series} />
      </Card>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <RealTeamStateCard teamName={teamAName} accentColor="var(--team-a)" rows={rows} isTeamA />
        <RealTeamStateCard teamName={teamBName} accentColor="var(--team-b)" rows={rows} isTeamA={false} />
      </div>

      <Card className="flex flex-col gap-md">
        <Meter label="Matchup Profile Similarity" value={profile.similarityScore} />
        <p className="text-xs text-muted-foreground">
          How often these two teams&apos; real supporting metrics point the same direction. Not a playstyle
          measure: no real playstyle data exists in the ingested feature set.
        </p>
        {profile.strongestAlignment ? (
          <div className="flex flex-col gap-2xs">
            <span className="text-sm font-medium text-foreground">Strongest Alignment</span>
            <Badge tone="success">{profile.strongestAlignment.label}</Badge>
          </div>
        ) : null}
        {profile.strongestConflict ? (
          <div className="flex flex-col gap-2xs">
            <span className="text-sm font-medium text-foreground">Strongest Conflict</span>
            {/* Real Model 1.0-scoped override of `tone="danger"`'s text color —
                the default `--badge-danger-text` (#f87171 in dark theme) is
                compliant at rest (~6:1) but this badge sits inside the same
                motion-safe entrance transition as the rest of this result
                panel (see `RealModelContributionsTab.tsx`'s equivalent note),
                so a brighter, higher-margin red (~9:1 at rest) keeps it
                comfortably clear of 4.5:1 without touching the shared
                `--badge-danger-*` tokens every other danger badge in the app
                also uses. */}
            <Badge tone="danger" className="text-[#fca5a5]">
              {profile.strongestConflict.label}
            </Badge>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
