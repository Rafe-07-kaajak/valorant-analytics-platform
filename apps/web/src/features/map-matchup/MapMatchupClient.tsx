"use client";

import { useMemo, useState } from "react";
import type { GameMap } from "@repo/shared";
import { Card, Container, Section, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { VctTeamSideSelector, EMPTY_SIDE_SELECTION, type SideSelection } from "../prediction-studio/VctTeamSideSelector";
import { ComparisonEmptyState } from "../team-comparison/ComparisonEmptyState";
import {
  adaptDisclosureForComparison,
  compareMaps,
  type VctTeamProfile,
} from "../../lib/teamComparison";
import {
  buildSupportingMetrics,
  clearMapSelection,
  computePoolAggregate,
  explainMapMatchup,
  generatePoolSummary,
  rankMaps,
  resolveActiveMap,
  selectAllMaps,
  selectCloseMaps,
  toggleMapSelection,
  type SortMode,
} from "../../lib/mapMatchup";
import { MapPoolControls } from "./MapPoolControls";
import { MapRankingView } from "./MapRankingView";
import { SelectedPoolView } from "./SelectedPoolView";
import { MapDetailView } from "./MapDetailView";

export interface MapMatchupClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  profiles: readonly VctTeamProfile[];
  maps: GameMap[];
  disclosure: string;
}

export function MapMatchupClient({ regions, teams, profiles, maps, disclosure }: MapMatchupClientProps) {
  const [teamASelection, setTeamASelection] = useState<SideSelection>(EMPTY_SIDE_SELECTION);
  const [teamBSelection, setTeamBSelection] = useState<SideSelection>(EMPTY_SIDE_SELECTION);
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("largest-gap");
  const [activeMapId, setActiveMapId] = useState<string | null>(null);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.teamId, profile])), [profiles]);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const explorerDisclosure = useMemo(() => adaptDisclosureForComparison(disclosure), [disclosure]);

  const selectedTeamA = teamASelection.teamId ? teamById.get(teamASelection.teamId) : undefined;
  const selectedTeamB = teamBSelection.teamId ? teamById.get(teamBSelection.teamId) : undefined;
  const profileA = teamASelection.teamId ? profileById.get(teamASelection.teamId) : undefined;
  const profileB = teamBSelection.teamId ? profileById.get(teamBSelection.teamId) : undefined;

  const hasMissingProfile = Boolean(
    (teamASelection.teamId && !profileA) || (teamBSelection.teamId && !profileB),
  );

  // Derived once per selected pair, not per render or per tab switch.
  const mapRows = useMemo(() => {
    if (!profileA || !profileB) return null;
    return compareMaps(profileA, profileB, maps);
  }, [profileA, profileB, maps]);

  const closeMapIds = useMemo(() => (mapRows ? selectCloseMaps(mapRows) : []), [mapRows]);

  const rankedRows = useMemo(() => {
    if (!mapRows) return null;
    return rankMaps(mapRows, selectedMapIds, sortMode);
  }, [mapRows, selectedMapIds, sortMode]);

  const activeRow = useMemo(() => {
    if (!rankedRows) return null;
    return resolveActiveMap(rankedRows, activeMapId);
  }, [rankedRows, activeMapId]);

  const explanation = useMemo(() => {
    if (!activeRow || !profileA || !profileB || !selectedTeamA || !selectedTeamB) return null;
    return explainMapMatchup(activeRow, profileA, profileB, selectedTeamA.name, selectedTeamB.name);
  }, [activeRow, profileA, profileB, selectedTeamA, selectedTeamB]);

  const supportingMetrics = useMemo(() => {
    if (!profileA || !profileB) return [];
    return buildSupportingMetrics(profileA, profileB);
  }, [profileA, profileB]);

  const poolAggregate = useMemo(() => {
    if (!mapRows) return null;
    return computePoolAggregate(mapRows, selectedMapIds);
  }, [mapRows, selectedMapIds]);

  const poolSummaryText = useMemo(() => {
    if (!poolAggregate || !selectedTeamA || !selectedTeamB) return null;
    return generatePoolSummary(selectedTeamA.name, selectedTeamB.name, poolAggregate);
  }, [poolAggregate, selectedTeamA, selectedTeamB]);

  const poolRows = useMemo(
    () => (mapRows ? mapRows.filter((row) => selectedMapIds.includes(row.mapId)) : []),
    [mapRows, selectedMapIds],
  );

  const hasBothTeams = Boolean(selectedTeamA && selectedTeamB && profileA && profileB && mapRows && rankedRows);

  return (
    <Section>
      <Container className="flex flex-col gap-lg">
        <div>
          <h1>Map Matchup Explorer</h1>
          <p className="text-muted-foreground">
            Select any two of the 32 VCT Stage 1 teams and inspect their modeled matchup across every
            supported map.
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

          <p className="text-xs text-muted-foreground">{explorerDisclosure}</p>
        </Card>

        {hasMissingProfile ? (
          <p role="alert" className="text-sm text-danger">
            We couldn&apos;t load the modeled profile for one of the selected teams. Try selecting a
            different team.
          </p>
        ) : hasBothTeams && rankedRows && selectedTeamA && selectedTeamB ? (
          <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
            <MapPoolControls
              maps={maps}
              selectedMapIds={selectedMapIds}
              closeMapCount={closeMapIds.length}
              onToggle={(mapId) => setSelectedMapIds((current) => toggleMapSelection(current, mapId))}
              onSelectAll={() => setSelectedMapIds(selectAllMaps(maps))}
              onClear={() => setSelectedMapIds(clearMapSelection())}
              onSelectClose={() => setSelectedMapIds(closeMapIds)}
            />

            <Tabs defaultValue="ranking">
              <TabsList aria-label="Map matchup views">
                <TabsTrigger value="ranking">Map Ranking</TabsTrigger>
                <TabsTrigger value="pool">Selected Pool</TabsTrigger>
                <TabsTrigger value="detail">Map Detail</TabsTrigger>
              </TabsList>

              <TabsContent value="ranking" className="pt-md">
                <MapRankingView
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  rankedRows={rankedRows}
                  sortMode={sortMode}
                  onSortModeChange={setSortMode}
                  activeMapId={activeRow?.mapId ?? null}
                  onSetActiveMap={setActiveMapId}
                />
              </TabsContent>

              <TabsContent value="pool" className="pt-md">
                <SelectedPoolView
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  aggregate={poolAggregate}
                  summary={poolSummaryText}
                  poolRows={poolRows}
                />
              </TabsContent>

              <TabsContent value="detail" className="pt-md">
                <MapDetailView
                  teamAName={selectedTeamA.name}
                  teamBName={selectedTeamB.name}
                  activeRow={activeRow}
                  explanation={explanation}
                  supportingMetrics={supportingMetrics}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <ComparisonEmptyState
            stage={selectedTeamA || selectedTeamB ? "partial" : "none"}
            selectedTeamName={selectedTeamA?.name ?? selectedTeamB?.name}
            selectedSide={selectedTeamA ? "A" : selectedTeamB ? "B" : undefined}
            description="The Map Matchup Explorer compares two teams' modeled strength across every supported map — which maps favor which side, which are close, and why — without generating a match prediction first."
          />
        )}
      </Container>
    </Section>
  );
}
