"use client";

import { useMemo } from "react";
import { SERIES_MAP_LIMITS, type GameMap, type Scenario } from "@repo/shared";
import { Button, Card, Spinner } from "@repo/ui";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { VctTeamSideSelector, type SideSelection } from "./VctTeamSideSelector";
import { MapSelector } from "./MapSelector";
import { MatchContextCore } from "./MatchContextCore";
import { SyntheticScenarioBadge } from "./SyntheticScenarioBadge";
import { AnalyticsContextLinks } from "../../components/AnalyticsContextLinks";
import { useCanonicalUrlState } from "../../hooks/useCanonicalUrlState";
import {
  EMPTY_CANONICAL_URL_STATE,
  withFormat,
  withMaps,
  withRegionA,
  withRegionB,
  withTeamA,
  withTeamB,
  type CanonicalFieldKey,
  type CanonicalUrlState,
} from "../../lib/urlState";

export interface ScenarioBuilderProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  /** Simulated-data disclosure text (TASK-031's `VCT_PROFILE_DISCLOSURE`), passed down from the server component rather than imported here — importing `@repo/prediction-engine` from a client component would pull its Node-only modules (e.g. `node:crypto`) into the browser bundle. */
  disclosure: string;
  isSubmitting: boolean;
  onSubmit: (scenario: Scenario) => void;
  /** TASK-039: server-parsed from the initial request's search params. Defaults to empty so existing callers (tests) don't need to pass it. */
  initialUrlState?: CanonicalUrlState;
  /** TASK-039: once a prediction result exists, its own result-scoped links (fed by the result's authoritative scenario, not this draft) take over — the draft's own links hide to avoid two simultaneously visible, potentially divergent link sets. */
  hasResult?: boolean;
}

const PREDICTION_STUDIO_FIELDS: readonly CanonicalFieldKey[] = ["regionA", "teamA", "regionB", "teamB", "maps", "format"];

export function ScenarioBuilder({
  regions,
  teams,
  maps,
  disclosure,
  isSubmitting,
  onSubmit,
  initialUrlState = EMPTY_CANONICAL_URL_STATE,
  hasResult = false,
}: ScenarioBuilderProps) {
  const validMapIds = useMemo(() => new Set(maps.map((map) => map.id)), [maps]);
  const [urlState, setUrlState] = useCanonicalUrlState(initialUrlState, PREDICTION_STUDIO_FIELDS, validMapIds);

  const teamASelection: SideSelection = { regionId: urlState.regionA, teamId: urlState.teamA };
  const teamBSelection: SideSelection = { regionId: urlState.regionB, teamId: urlState.teamB };
  const seriesFormat = urlState.format ?? "BO3";
  const mapIds = urlState.maps;

  const maxSelectable = SERIES_MAP_LIMITS[seriesFormat];
  const selectedMapNames = useMemo(
    () => mapIds.map((mapId) => maps.find((map) => map.id === mapId)?.name).filter((name): name is string => Boolean(name)),
    [mapIds, maps],
  );

  const validationError = useMemo(() => {
    if (!teamASelection.teamId || !teamBSelection.teamId) return "Select both teams to continue.";
    if (teamASelection.teamId === teamBSelection.teamId) return "Team A and Team B must be different.";
    if (mapIds.length === 0) return "Select at least one map.";
    return null;
  }, [teamASelection.teamId, teamBSelection.teamId, mapIds]);

  function handleSeriesFormatChange(next: typeof seriesFormat) {
    setUrlState((current) => withFormat(current, next));
  }

  function toggleMap(mapId: string) {
    setUrlState((current) => {
      const currentMaps = current.maps;
      const nextMaps = currentMaps.includes(mapId)
        ? currentMaps.filter((id) => id !== mapId)
        : currentMaps.length >= maxSelectable
          ? currentMaps
          : [...currentMaps, mapId];
      return withMaps(current, nextMaps, validMapIds);
    });
  }

  function handleSubmit() {
    if (validationError || !teamASelection.teamId || !teamBSelection.teamId) return;
    onSubmit({ teamAId: teamASelection.teamId, teamBId: teamBSelection.teamId, seriesFormat, mapIds });
  }

  return (
    <Card className="flex flex-col gap-lg">
      <div className="flex flex-col gap-lg lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-md">
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

        <MatchContextCore
          seriesFormat={seriesFormat}
          onSeriesFormatChange={handleSeriesFormatChange}
          selectedMapNames={selectedMapNames}
          maxSelectable={maxSelectable}
          teamAReady={Boolean(teamASelection.teamId)}
          teamBReady={Boolean(teamBSelection.teamId)}
        />

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

      {!hasResult ? <AnalyticsContextLinks currentFeature="prediction-studio" state={urlState} placement="compact" /> : null}

      <MapSelector
        maps={maps}
        selectedMapIds={mapIds}
        maxSelectable={maxSelectable}
        onToggle={toggleMap}
      />

      <SyntheticScenarioBadge disclosure={disclosure} />

      {validationError ? (
        <p role="alert" className="text-sm text-danger">
          {validationError}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={Boolean(validationError) || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Spinner size={16} className="text-white" />
            Generating Prediction…
          </>
        ) : (
          "Generate Prediction"
        )}
      </Button>
    </Card>
  );
}
