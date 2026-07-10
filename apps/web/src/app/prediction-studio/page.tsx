"use client";

import { Container, Section } from "@repo/ui";
import { ScenarioBuilder } from "../../features/prediction-studio/ScenarioBuilder";
import { PredictionResultPreview } from "../../features/prediction-studio/PredictionResultPreview";
import { usePrediction } from "../../hooks/usePrediction";
import { mockTeams } from "../../lib/mock/teams";
import { mockMaps } from "../../lib/mock/maps";

export default function PredictionStudioPage() {
  const { status, result, error, requestPrediction } = usePrediction();

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
          teams={mockTeams}
          maps={mockMaps}
          isSubmitting={status === "loading"}
          onSubmit={requestPrediction}
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {result ? <PredictionResultPreview result={result} teams={mockTeams} /> : null}
      </Container>
    </Section>
  );
}
