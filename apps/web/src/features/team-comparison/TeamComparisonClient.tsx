"use client";

import { useMemo } from "react";
import type { GameMap } from "@repo/shared";
import { Card, Container, Section, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { AmbientSectionBackground } from "../../components/effects/AmbientSectionBackground";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { VctTeamSideSelector, type SideSelection } from "../prediction-studio/VctTeamSideSelector";
import { SyntheticScenarioBadge } from "../prediction-studio/SyntheticScenarioBadge";
import { toPredictionTeam } from "../../lib/toPredictionTeam";
import {
  adaptDisclosureForComparison,
  buildComparisonViewModel,
  compareDnaDimensions,
  type VctTeamProfile,
} from "../../lib/teamComparison";
import { AnalyticsContextLinks } from "../../components/AnalyticsContextLinks";
import { useCanonicalUrlState } from "../../hooks/useCanonicalUrlState";
import { EMPTY_CANONICAL_URL_STATE, withRegionA, withRegionB, withTeamA, withTeamB, type CanonicalFieldKey, type CanonicalUrlState } from "../../lib/urlState";
import { ComparisonEmptyState } from "./ComparisonEmptyState";
import { TeamComparisonHeader } from "./TeamComparisonHeader";
import { ComparisonCore } from "./ComparisonCore";
import { ComparisonHero } from "./ComparisonHero";
import { OverviewTab } from "./OverviewTab";
import { TeamDnaTab } from "./TeamDnaTab";
import { MapsTab } from "./MapsTab";
import { FactorsTab } from "./FactorsTab";

export interface TeamComparisonClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  profiles: readonly VctTeamProfile[];
  maps: GameMap[];
  /** TASK-031's `VCT_PROFILE_DISCLOSURE`, resolved server-side and adapted for this page's wording. */
  disclosure: string;
  /** TASK-039: server-parsed from the initial request's search params. Defaults to empty so existing callers (tests) don't need to pass it. */
  initialUrlState?: CanonicalUrlState;
}

const TEAM_COMPARISON_FIELDS: readonly CanonicalFieldKey[] = ["regionA", "teamA", "regionB", "teamB"];

export function TeamComparisonClient({
  regions,
  teams,
  profiles,
  maps,
  disclosure,
  initialUrlState = EMPTY_CANONICAL_URL_STATE,
}: TeamComparisonClientProps) {
  const validMapIds = useMemo(() => new Set(maps.map((map) => map.id)), [maps]);
  const [urlState, setUrlState] = useCanonicalUrlState(initialUrlState, TEAM_COMPARISON_FIELDS, validMapIds);

  const teamASelection: SideSelection = { regionId: urlState.regionA, teamId: urlState.teamA };
  const teamBSelection: SideSelection = { regionId: urlState.regionB, teamId: urlState.teamB };

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.teamId, profile])), [profiles]);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const comparisonDisclosure = useMemo(() => adaptDisclosureForComparison(disclosure), [disclosure]);

  const selectedTeamA = teamASelection.teamId ? teamById.get(teamASelection.teamId) : undefined;
  const selectedTeamB = teamBSelection.teamId ? teamById.get(teamBSelection.teamId) : undefined;
  const profileA = teamASelection.teamId ? profileById.get(teamASelection.teamId) : undefined;
  const profileB = teamBSelection.teamId ? profileById.get(teamBSelection.teamId) : undefined;

  const hasMissingProfile = Boolean(
    (teamASelection.teamId && !profileA) || (teamBSelection.teamId && !profileB),
  );

  // Recomputed only when the selected pair actually changes — not on tab
  // switches or any other unrelated rerender.
  const viewModel = useMemo(() => {
    if (!selectedTeamA || !selectedTeamB || !profileA || !profileB) return null;
    return buildComparisonViewModel(profileA, profileB, selectedTeamA.name, selectedTeamB.name, maps);
  }, [selectedTeamA, selectedTeamB, profileA, profileB, maps]);

  const dnaRows = useMemo(() => {
    if (!profileA || !profileB) return null;
    return compareDnaDimensions(profileA.dna, profileB.dna);
  }, [profileA, profileB]);

  const bothSelected = Boolean(teamASelection.teamId && teamBSelection.teamId);

  return (
    <Section className="relative overflow-hidden">
      <AmbientSectionBackground
        wash="var(--gradient-comparison-lab-ambient)"
        texture={{ src: "/assets/redesign/textures/tactical-grid.png", opacity: 0.05 }}
      />

      <Container className="relative flex flex-col gap-lg">
        <TeamComparisonHeader />

        <Card className="flex flex-col gap-lg">
          <div className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)_minmax(0,1fr)] lg:items-start lg:gap-md">
            <div className="min-w-0 rounded-lg border border-team-a/20 bg-[image:linear-gradient(180deg,color-mix(in_oklab,var(--team-a)_8%,transparent),transparent_60%)] p-sm">
              <VctTeamSideSelector
                side="A"
                regions={regions}
                teams={teams}
                regionId={teamASelection.regionId}
                teamId={teamASelection.teamId}
                opposingTeamId={teamBSelection.teamId}
                onRegionChange={(regionId) => setUrlState((current) => withRegionA(current, regionId))}
                onTeamChange={(teamId) => setUrlState((current) => withTeamA(current, teamId))}
              />
            </div>

            <ComparisonCore ready={bothSelected} />

            <div className="min-w-0 rounded-lg border border-team-b/20 bg-[image:linear-gradient(180deg,color-mix(in_oklab,var(--team-b)_8%,transparent),transparent_60%)] p-sm">
              <VctTeamSideSelector
                side="B"
                regions={regions}
                teams={teams}
                regionId={teamBSelection.regionId}
                teamId={teamBSelection.teamId}
                opposingTeamId={teamASelection.teamId}
                onRegionChange={(regionId) => setUrlState((current) => withRegionB(current, regionId))}
                onTeamChange={(teamId) => setUrlState((current) => withTeamB(current, teamId))}
              />
            </div>
          </div>

          <SyntheticScenarioBadge disclosure={comparisonDisclosure} />
        </Card>

        <AnalyticsContextLinks currentFeature="team-comparison" state={urlState} placement="compact" />

        {hasMissingProfile ? (
          <p role="alert" className="text-sm text-danger">
            We couldn&apos;t load the modeled profile for one of the selected teams. Try selecting a
            different team.
          </p>
        ) : viewModel && selectedTeamA && selectedTeamB && dnaRows ? (
          <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
            <ComparisonHero
              teamAName={selectedTeamA.name}
              teamBName={selectedTeamB.name}
              summary={viewModel.summary}
              headlineMetric={viewModel.metrics[0]!}
              topFactor={viewModel.factors[0]}
              strongestA={viewModel.strongestA}
              strongestB={viewModel.strongestB}
            />

            <Tabs defaultValue="overview">
              <TabsList aria-label="Comparison views">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="dna">Team DNA</TabsTrigger>
                <TabsTrigger value="maps">Maps</TabsTrigger>
                <TabsTrigger value="factors">Factors</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-md">
                <OverviewTab
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  metrics={viewModel.metrics}
                  strongestA={viewModel.strongestA}
                  weakestA={viewModel.weakestA}
                  strongestB={viewModel.strongestB}
                  weakestB={viewModel.weakestB}
                />
              </TabsContent>

              <TabsContent value="dna" className="pt-md">
                <TeamDnaTab
                  teamA={toPredictionTeam(selectedTeamA)}
                  teamADna={profileA!.dna}
                  teamB={toPredictionTeam(selectedTeamB)}
                  teamBDna={profileB!.dna}
                  dimensionRows={dnaRows}
                />
              </TabsContent>

              <TabsContent value="maps" className="pt-md">
                <MapsTab
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  rows={viewModel.mapRows}
                  mostEvenMap={viewModel.mostEvenMap}
                  largestGapMap={viewModel.largestGapMap}
                  strongestA={viewModel.strongestA}
                  weakestA={viewModel.weakestA}
                  strongestB={viewModel.strongestB}
                  weakestB={viewModel.weakestB}
                />
              </TabsContent>

              <TabsContent value="factors" className="pt-md">
                <FactorsTab
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  factors={viewModel.factors}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <ComparisonEmptyState
            stage={selectedTeamA || selectedTeamB ? "partial" : "none"}
            selectedTeamName={selectedTeamA?.name ?? selectedTeamB?.name}
            selectedSide={selectedTeamA ? "A" : selectedTeamB ? "B" : undefined}
          />
        )}
      </Container>
    </Section>
  );
}
