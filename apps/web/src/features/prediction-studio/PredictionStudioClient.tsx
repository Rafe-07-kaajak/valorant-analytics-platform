"use client";

import { useMemo, useRef } from "react";
import type { GameMap, Scenario } from "@repo/shared";
import { Button, Container, Section } from "@repo/ui";
import { FeatureAmbientBackground } from "../../components/effects/FeatureAmbientBackground";
import { MEDIA_ASSETS } from "../../constants/media";
import { AMBIENT_VIDEO_LOOP_CONFIG } from "../../constants/ambientVideoLoopConfig";
import { ScenarioBuilder, type RealMatchSubmission } from "./ScenarioBuilder";
import { PredictionResultExperience } from "./PredictionResultExperience";
import { RealCurrentPredictionResult } from "./RealCurrentPredictionResult";
import { HistoricalReplaySection } from "./historical/HistoricalReplaySection";
import { useRealModel2Prediction } from "../../hooks/useRealModel2Prediction";
import { useCurrentRealPrediction } from "../../hooks/useCurrentRealPrediction";
import { getTeamById, type VctRegion, type VctTeam, type VctTeamId } from "../../constants/vct";
import { AnalyticsContextLinks } from "../../components/AnalyticsContextLinks";
import { toPredictionTeam } from "../../lib/toPredictionTeam";
import { EMPTY_CANONICAL_URL_STATE, scenarioToCanonicalState, type CanonicalUrlState } from "../../lib/urlState";
import { REAL_ATTRIBUTE_CONTROLS, REAL_SIMULATION_PRESETS } from "../../lib/whatIfSimulator";
import { buildRealSimulatorBaseline, createRealRunSimulation } from "../../lib/realModel2/simulatorAdapters";

export interface PredictionStudioClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  /** TASK-039: server-parsed from the initial request's search params. Defaults to empty so existing callers (tests) don't need to pass it. */
  initialUrlState?: CanonicalUrlState;
}

export function PredictionStudioClient({
  regions,
  teams,
  maps,
  initialUrlState = EMPTY_CANONICAL_URL_STATE,
}: PredictionStudioClientProps) {
  // "Real Model 2.0" — the former Synthetic Scenario UI, now backed end to
  // end by the real ingested-data pipeline (see `useRealModel2Prediction`).
  const { status, result, rawResponse, error, requestPrediction, reset: resetPrediction } = useRealModel2Prediction();
  // "Real Model 1.0" — unchanged from before this task.
  const {
    status: realStatus,
    result: realResult,
    error: realError,
    requestPrediction: requestRealPrediction,
    reset: resetRealPrediction,
  } = useCurrentRealPrediction();

  // Section 16: switching modes must clear the other mode's stale result —
  // the two hooks' state is otherwise fully independent (by design, so a
  // failure in one never falls back to the other), so nothing else would
  // ever clear it on its own.
  const handleModeChange = () => {
    resetPrediction();
    resetRealPrediction();
  };

  const lastScenarioRef = useRef<Scenario | null>(null);
  const handleSubmit = (scenario: Scenario) => {
    lastScenarioRef.current = scenario;
    const teamA = getTeamById(scenario.teamAId as VctTeamId);
    const teamB = getTeamById(scenario.teamBId as VctTeamId);
    if (!teamA || !teamB) return;
    // No tournament-tier control exists in this mode's scenario builder (it
    // keeps the map-selection UI instead) — the real backend still requires
    // one, so it's derived directly from the two teams' own real regions,
    // never guessed: same region -> a real regional-league assumption,
    // different regions -> international.
    const tournamentTier = teamA.region === teamB.region ? "league" : "international";
    requestPrediction({
      scenario,
      teamAName: teamA.name,
      teamBName: teamB.name,
      tournamentTier,
      eventRegion: tournamentTier === "league" ? teamA.region : undefined,
    });
  };
  const retryPrediction = () => {
    if (lastScenarioRef.current) handleSubmit(lastScenarioRef.current);
  };

  // Remembers only the last submitted real-mode request, purely so a
  // failed submission can be retried without requiring the user to
  // re-select anything in the form above — never used for anything else.
  const lastRealSubmissionRef = useRef<RealMatchSubmission | null>(null);
  const handleSubmitReal = (request: RealMatchSubmission) => {
    lastRealSubmissionRef.current = request;
    requestRealPrediction(request);
  };
  const retryRealPrediction = () => {
    if (lastRealSubmissionRef.current) requestRealPrediction(lastRealSubmissionRef.current);
  };

  const resultTeamA = result ? getTeamById(result.scenario.teamAId as VctTeamId) : undefined;
  const resultTeamB = result ? getTeamById(result.scenario.teamBId as VctTeamId) : undefined;

  const realResultTeamA = realResult ? getTeamById(realResult.teamAId as VctTeamId) : undefined;
  const realResultTeamB = realResult ? getTeamById(realResult.teamBId as VctTeamId) : undefined;

  // Authoritative for the cross-feature links once a result exists — the
  // result's own scenario, never the draft controls, the What-if Simulator,
  // or the breakdown tabs, none of which this depends on.
  const resultUrlState = useMemo(() => (result ? scenarioToCanonicalState(result.scenario) : null), [result]);

  const realResultUrlState: CanonicalUrlState | null = useMemo(() => {
    if (!realResult || !realResultTeamA || !realResultTeamB) return null;
    return {
      regionA: realResultTeamA.region,
      teamA: realResultTeamA.id,
      regionB: realResultTeamB.region,
      teamB: realResultTeamB.id,
      maps: [],
      format: realResult.seriesFormat as CanonicalUrlState["format"],
      mode: "real",
    };
  }, [realResult, realResultTeamA, realResultTeamB]);

  const simulatorOverrides = useMemo(() => {
    if (!rawResponse || !result || !resultTeamA || !resultTeamB) return undefined;
    return {
      // No real per-map strength baseline exists — the simulator's per-map
      // sliders are omitted for Real Model 2.0 regardless of which maps the
      // scenario itself has selected (those stay in `result.scenario.mapIds`
      // for the map-selection UI/URL state, unaffected by this).
      simulatorMapIds: [],
      getBaseline: async () => buildRealSimulatorBaseline(rawResponse),
      runSimulation: createRealRunSimulation(rawResponse, result, resultTeamA.name, resultTeamB.name),
      controls: REAL_ATTRIBUTE_CONTROLS,
      presets: REAL_SIMULATION_PRESETS,
    };
  }, [rawResponse, result, resultTeamA, resultTeamB]);

  return (
    <>
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />

      <Section className="relative overflow-hidden">
        <Container className="relative flex flex-col gap-lg">
          <div>
            <h1>Prediction Studio</h1>
            <p className="text-muted-foreground">
              Select a region, then a team, for each side, and generate an explainable modeled prediction.
            </p>
          </div>

          <ScenarioBuilder
            regions={regions}
            teams={teams}
            maps={maps}
            isSubmitting={status === "loading"}
            onSubmit={handleSubmit}
            isSubmittingReal={realStatus === "loading"}
            onSubmitReal={handleSubmitReal}
            initialUrlState={initialUrlState}
            hasResult={Boolean(result) || Boolean(realResult)}
            onModeChange={handleModeChange}
          />

          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-sm text-sm text-danger">
              <p>{error} Adjust the scenario above and try again.</p>
              <Button type="button" variant="secondary" size="sm" onClick={retryPrediction} disabled={status === "loading"}>
                Retry
              </Button>
            </div>
          ) : null}

          {realError ? (
            <div role="alert" className="flex flex-wrap items-center gap-sm text-sm text-danger">
              <p>{realError} Adjust the scenario above and try again.</p>
              <Button type="button" variant="secondary" size="sm" onClick={retryRealPrediction} disabled={realStatus === "loading"}>
                Retry
              </Button>
            </div>
          ) : null}

          {result && resultTeamA && resultTeamB && resultUrlState ? (
            <>
              <AnalyticsContextLinks currentFeature="prediction-studio" state={resultUrlState} placement="result" />
              <PredictionResultExperience
                result={result}
                teamA={toPredictionTeam(resultTeamA)}
                teamB={toPredictionTeam(resultTeamB)}
                maps={maps}
                simulatorOverrides={simulatorOverrides}
              />
            </>
          ) : null}

          {realResult && realResultTeamA && realResultTeamB && realResultUrlState ? (
            <>
              <AnalyticsContextLinks currentFeature="prediction-studio" state={realResultUrlState} placement="result" />
              <RealCurrentPredictionResult result={realResult} teamA={realResultTeamA} teamB={realResultTeamB} />
            </>
          ) : null}

          <HistoricalReplaySection />
        </Container>
      </Section>
    </>
  );
}
