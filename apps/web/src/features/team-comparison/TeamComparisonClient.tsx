"use client";

import { useMemo, useState } from "react";
import type { GameMap } from "@repo/shared";
import { Card, Container, Section, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { VctTeamSideSelector, EMPTY_SIDE_SELECTION, type SideSelection } from "../prediction-studio/VctTeamSideSelector";
import { toPredictionTeam } from "../../lib/toPredictionTeam";
import {
  adaptDisclosureForComparison,
  buildComparisonViewModel,
  compareDnaDimensions,
  type VctTeamProfile,
} from "../../lib/teamComparison";
import { ComparisonEmptyState } from "./ComparisonEmptyState";
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
}

export function TeamComparisonClient({ regions, teams, profiles, maps, disclosure }: TeamComparisonClientProps) {
  const [teamASelection, setTeamASelection] = useState<SideSelection>(EMPTY_SIDE_SELECTION);
  const [teamBSelection, setTeamBSelection] = useState<SideSelection>(EMPTY_SIDE_SELECTION);

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

  return (
    <Section>
      <Container className="flex flex-col gap-lg">
        <div>
          <h1>Team Comparison Lab</h1>
          <p className="text-muted-foreground">
            Select any two of the 32 VCT Stage 1 teams to compare their modeled profiles side by side —
            no match prediction required.
          </p>
        </div>

        <Card className="flex flex-col gap-lg">
          <div className="flex flex-col gap-lg lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-md">
            <VctTeamSideSelector
              side="A"
              regions={regions}
              teams={teams}
              regionId={teamASelection.regionId}
              teamId={teamASelection.teamId}
              opposingTeamId={teamBSelection.teamId}
              onRegionChange={(regionId) => setTeamASelection({ regionId, teamId: null })}
              onTeamChange={(teamId) => setTeamASelection((current) => ({ ...current, teamId }))}
            />

            <div
              aria-hidden="true"
              className="flex items-center justify-center text-sm font-semibold uppercase tracking-wide text-muted-foreground lg:h-full"
            >
              VS
            </div>

            <VctTeamSideSelector
              side="B"
              regions={regions}
              teams={teams}
              regionId={teamBSelection.regionId}
              teamId={teamBSelection.teamId}
              opposingTeamId={teamASelection.teamId}
              onRegionChange={(regionId) => setTeamBSelection({ regionId, teamId: null })}
              onTeamChange={(teamId) => setTeamBSelection((current) => ({ ...current, teamId }))}
            />
          </div>

          <p className="text-xs text-muted-foreground">{comparisonDisclosure}</p>
        </Card>

        {hasMissingProfile ? (
          <p role="alert" className="text-sm text-danger">
            We couldn&apos;t load the modeled profile for one of the selected teams. Try selecting a
            different team.
          </p>
        ) : viewModel && selectedTeamA && selectedTeamB && dnaRows ? (
          <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
            <Card>
              <p className="text-foreground">{viewModel.summary}</p>
            </Card>

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
