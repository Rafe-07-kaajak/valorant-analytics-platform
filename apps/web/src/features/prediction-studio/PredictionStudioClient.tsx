"use client";

import { useMemo } from "react";
import type { GameMap } from "@repo/shared";
import { Container, Section } from "@repo/ui";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { PredictionResultExperience } from "./PredictionResultExperience";
import { usePrediction } from "../../hooks/usePrediction";
import { getTeamById, type VctRegion, type VctTeam, type VctTeamId } from "../../constants/vct";
import { toPredictionTeam } from "../../lib/toPredictionTeam";
import { AnalyticsContextLinks } from "../../components/AnalyticsContextLinks";
import { EMPTY_CANONICAL_URL_STATE, scenarioToCanonicalState, type CanonicalUrlState } from "../../lib/urlState";

export interface PredictionStudioClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  disclosure: string;
  /** TASK-039: server-parsed from the initial request's search params. Defaults to empty so existing callers (tests) don't need to pass it. */
  initialUrlState?: CanonicalUrlState;
}

export function PredictionStudioClient({
  regions,
  teams,
  maps,
  disclosure,
  initialUrlState = EMPTY_CANONICAL_URL_STATE,
}: PredictionStudioClientProps) {
  const { status, result, error, requestPrediction } = usePrediction();

  const resultTeamA = result ? getTeamById(result.scenario.teamAId as VctTeamId) : undefined;
  const resultTeamB = result ? getTeamById(result.scenario.teamBId as VctTeamId) : undefined;

  // Authoritative for the cross-feature links once a result exists — the
  // result's own scenario, never the draft controls, the What-if Simulator,
  // or the breakdown tabs, none of which this depends on.
  const resultUrlState = useMemo(() => (result ? scenarioToCanonicalState(result.scenario) : null), [result]);

  return (
    <Section>
      <Container className="flex flex-col gap-lg">
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
          disclosure={disclosure}
          isSubmitting={status === "loading"}
          onSubmit={requestPrediction}
          initialUrlState={initialUrlState}
          hasResult={Boolean(result)}
        />

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error} Adjust the scenario above and try again.
          </p>
        ) : null}

        {result && resultTeamA && resultTeamB && resultUrlState ? (
          <>
            <AnalyticsContextLinks currentFeature="prediction-studio" state={resultUrlState} placement="result" />
            <PredictionResultExperience
              result={result}
              teamA={toPredictionTeam(resultTeamA)}
              teamB={toPredictionTeam(resultTeamB)}
              maps={maps}
            />
          </>
        ) : null}
      </Container>
    </Section>
  );
}
