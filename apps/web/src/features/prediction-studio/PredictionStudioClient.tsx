"use client";

import type { GameMap, Team } from "@repo/shared";
import { Container, Section } from "@repo/ui";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { PredictionResultExperience } from "./PredictionResultExperience";
import { usePrediction } from "../../hooks/usePrediction";

export interface PredictionStudioClientProps {
  teams: Team[];
  maps: GameMap[];
}

export function PredictionStudioClient({ teams, maps }: PredictionStudioClientProps) {
  const { status, result, error, requestPrediction } = usePrediction();

  const teamA = result ? teams.find((team) => team.id === result.scenario.teamAId) : undefined;
  const teamB = result ? teams.find((team) => team.id === result.scenario.teamBId) : undefined;

  return (
    <Section>
      <Container className="flex flex-col gap-lg">
        <div>
          <h1>Prediction Studio</h1>
          <p className="text-muted-foreground">
            Select two teams and a scenario to generate an explainable prediction.
          </p>
        </div>

        <ScenarioBuilder
          teams={teams}
          maps={maps}
          isSubmitting={status === "loading"}
          onSubmit={requestPrediction}
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {result && teamA && teamB ? (
          <PredictionResultExperience result={result} teamA={teamA} teamB={teamB} />
        ) : null}
      </Container>
    </Section>
  );
}
