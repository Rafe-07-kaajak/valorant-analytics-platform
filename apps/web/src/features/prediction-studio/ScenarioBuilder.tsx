"use client";

import { useMemo, useState } from "react";
import { SERIES_MAP_LIMITS, type GameMap, type Scenario, type TournamentTier } from "@repo/shared";
import { Button, Card, Spinner } from "@repo/ui";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { getTeamById } from "../../constants/vct";
import { VctTeamSideSelector, type SideSelection } from "./VctTeamSideSelector";
import { MapSelector } from "./MapSelector";
import { MatchContextCore } from "./MatchContextCore";
import { PredictionModeToggle } from "./PredictionModeToggle";
import { MatchTierToggle } from "./MatchTierToggle";
import { RealModel2Badge } from "./RealModel2Badge";
import { AnalyticsContextLinks } from "../../components/AnalyticsContextLinks";
import { useCanonicalUrlState } from "../../hooks/useCanonicalUrlState";
import {
  EMPTY_CANONICAL_URL_STATE,
  withFormat,
  withMaps,
  withMode,
  withRegionA,
  withRegionB,
  withTeamA,
  withTeamB,
  type CanonicalFieldKey,
  type CanonicalUrlState,
} from "../../lib/urlState";

export interface RealMatchSubmission {
  readonly teamAId: string;
  readonly teamBId: string;
  readonly seriesFormat: string;
  readonly tournamentTier: TournamentTier;
}

export interface ScenarioBuilderProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  isSubmitting: boolean;
  onSubmit: (scenario: Scenario) => void;
  /** Real-model integration task: a wholly separate submit path from `onSubmit` — never invoked as a fallback for the other. */
  isSubmittingReal: boolean;
  onSubmitReal: (request: RealMatchSubmission) => void;
  /** TASK-039: server-parsed from the initial request's search params. Defaults to empty so existing callers (tests) don't need to pass it. */
  initialUrlState?: CanonicalUrlState;
  /** TASK-039: once a prediction result exists, its own result-scoped links (fed by the result's authoritative scenario, not this draft) take over — the draft's own links hide to avoid two simultaneously visible, potentially divergent link sets. */
  hasResult?: boolean;
  /** Prediction Studio mode-correction task — fires whenever the mode toggle changes, so the parent can clear the other mode's stale result state. Team/region/format/map selections are deliberately NOT cleared (they live in `urlState`, untouched by this). */
  onModeChange?: (mode: "synthetic" | "real") => void;
}

const PREDICTION_STUDIO_FIELDS: readonly CanonicalFieldKey[] = ["regionA", "teamA", "regionB", "teamB", "maps", "format", "mode"];

export function ScenarioBuilder({
  regions,
  teams,
  maps,
  isSubmitting,
  onSubmit,
  isSubmittingReal,
  onSubmitReal,
  initialUrlState = EMPTY_CANONICAL_URL_STATE,
  hasResult = false,
  onModeChange,
}: ScenarioBuilderProps) {
  const validMapIds = useMemo(() => new Set(maps.map((map) => map.id)), [maps]);
  const [urlState, setUrlState] = useCanonicalUrlState(initialUrlState, PREDICTION_STUDIO_FIELDS, validMapIds);
  // Not part of the canonical URL contract (only `mode` itself needs to persist there) — a fresh, low-stakes default each visit is fine for an "assumed context" control.
  const [tier, setTier] = useState<TournamentTier>("league");

  const mode = urlState.mode ?? "synthetic";
  const teamASelection: SideSelection = { regionId: urlState.regionA, teamId: urlState.teamA };
  const teamBSelection: SideSelection = { regionId: urlState.regionB, teamId: urlState.teamB };
  const seriesFormat = urlState.format ?? "BO3";
  const mapIds = urlState.maps;

  const maxSelectable = SERIES_MAP_LIMITS[seriesFormat];
  const selectedMapNames = useMemo(
    () => mapIds.map((mapId) => maps.find((map) => map.id === mapId)?.name).filter((name): name is string => Boolean(name)),
    [mapIds, maps],
  );

  const regionMismatch =
    tier === "league" &&
    Boolean(teamASelection.teamId) &&
    Boolean(teamBSelection.teamId) &&
    getTeamById(teamASelection.teamId!)?.region !== getTeamById(teamBSelection.teamId!)?.region;

  const validationError = useMemo(() => {
    if (!teamASelection.teamId || !teamBSelection.teamId) return "Select both teams to continue.";
    if (teamASelection.teamId === teamBSelection.teamId) return "Team A and Team B must be different.";
    if (mode === "synthetic" && mapIds.length === 0) return "Select at least one map.";
    if (mode === "real" && regionMismatch) return "These teams are in different real VCT regions: select International, or pick two teams from the same region.";
    return null;
  }, [teamASelection.teamId, teamBSelection.teamId, mapIds, mode, regionMismatch]);

  function handleSeriesFormatChange(next: typeof seriesFormat) {
    setUrlState((current) => withFormat(current, next));
  }

  function handleModeChange(next: "synthetic" | "real") {
    setUrlState((current) => withMode(current, next));
    onModeChange?.(next);
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
    if (mode === "real") {
      onSubmitReal({ teamAId: teamASelection.teamId, teamBId: teamBSelection.teamId, seriesFormat, tournamentTier: tier });
      return;
    }
    onSubmit({ teamAId: teamASelection.teamId, teamBId: teamBSelection.teamId, seriesFormat, mapIds });
  }

  return (
    <Card className="flex flex-col gap-lg">
      <PredictionModeToggle mode={mode} onModeChange={handleModeChange} />

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
          showMapSummary={mode === "synthetic"}
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

      {mode === "synthetic" ? (
        <MapSelector
          maps={maps}
          selectedMapIds={mapIds}
          maxSelectable={maxSelectable}
          onToggle={toggleMap}
        />
      ) : (
        <MatchTierToggle tier={tier} onTierChange={setTier} />
      )}

      {mode === "synthetic" ? <RealModel2Badge /> : null}

      {validationError ? (
        <p role="alert" className="text-sm text-danger">
          {validationError}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={Boolean(validationError) || (mode === "synthetic" ? isSubmitting : isSubmittingReal)}
        onClick={handleSubmit}
      >
        {(mode === "synthetic" ? isSubmitting : isSubmittingReal) ? (
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
