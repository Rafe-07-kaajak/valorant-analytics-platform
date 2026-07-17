"use client";

import type { GameMap } from "@repo/shared";
import { Container, Section } from "@repo/ui";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { PredictionResultExperience } from "./PredictionResultExperience";
import { usePrediction } from "../../hooks/usePrediction";
import { getTeamById, type VctRegion, type VctTeam, type VctTeamId } from "../../constants/vct";
import { toPredictionTeam } from "../../lib/toPredictionTeam";

export interface PredictionStudioClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  disclosure: string;
}

export function PredictionStudioClient({ regions, teams, maps, disclosure }: PredictionStudioClientProps) {
  const { status, result, error, requestPrediction } = usePrediction();

  const resultTeamA = result ? getTeamById(result.scenario.teamAId as VctTeamId) : undefined;
  const resultTeamB = result ? getTeamById(result.scenario.teamBId as VctTeamId) : undefined;

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
        />

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error} Adjust the scenario above and try again.
          </p>
        ) : null}

        {result && resultTeamA && resultTeamB ? (
          <PredictionResultExperience
            result={result}
            teamA={toPredictionTeam(resultTeamA)}
            teamB={toPredictionTeam(resultTeamB)}
            maps={maps}
          />
        ) : null}
      </Container>
    </Section>
  );
}
