"use client";

import { useMemo } from "react";
import type { PredictionResult, Team } from "@repo/shared";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { BreakdownController } from "./useBreakdownState";
import { ContributionsTab } from "./ContributionsTab";
import { MatchDnaTab } from "./MatchDnaTab";
import { KeyFactorsTab } from "./KeyFactorsTab";
import { PipelineTab } from "./PipelineTab";
import {
  buildContributionRows,
  buildDnaGapRows,
  buildPipelineStageViews,
  explainLargestGaps,
} from "../../../lib/predictionBreakdown";

export interface InteractivePredictionBreakdownProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
  /** Owned by the caller (`PredictionResultExperience`) so the same cross-highlight state can also drive `ExplanationCard`. */
  breakdown: BreakdownController;
}

/**
 * TASK-037. A pure presentation layer over the already-computed
 * `PredictionResult` — every value rendered here is derived from `result`
 * via the pure helpers in `lib/predictionBreakdown`, never recomputed or
 * altered.
 */
export function InteractivePredictionBreakdown({ result, teamA, teamB, breakdown }: InteractivePredictionBreakdownProps) {
  const [teamADna, teamBDna] = result.teamDna;

  const contributions = useMemo(
    () => buildContributionRows(result.keyFactors, result.predictedWinnerId, teamA.id),
    [result.keyFactors, result.predictedWinnerId, teamA.id],
  );

  const dnaGapRows = useMemo(() => buildDnaGapRows(teamADna, teamBDna), [teamADna, teamBDna]);

  const largestGapExplanation = useMemo(
    () => explainLargestGaps(dnaGapRows, teamA.name, teamB.name),
    [dnaGapRows, teamA.name, teamB.name],
  );

  const pipelineStageViews = useMemo(() => buildPipelineStageViews(result.pipeline), [result.pipeline]);

  if (result.keyFactors.length === 0 && dnaGapRows.length === 0 && pipelineStageViews.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-md">
      <h3>Interactive Prediction Breakdown</h3>
      <p className="text-sm text-muted-foreground">
        Explore how each modeled factor shaped this prediction. Nothing here changes the prediction itself.
        It&apos;s the same result, viewed from four angles.
      </p>

      <Tabs defaultValue="contributions">
        {/* Longer tab labels than the other Tabs instances in this repo (e.g.
            "Key Factors" vs "Maps") overflow a 375px viewport if the shared
            `TabsList` is left to its default `inline-flex` — this wrapper is
            local to this one section, not a change to the shared primitive. */}
        <div className="overflow-x-auto">
          <TabsList aria-label="Prediction breakdown views">
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="match-dna">Match DNA</TabsTrigger>
            <TabsTrigger value="key-factors">Key Factors</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contributions" className="pt-md">
          <ContributionsTab rows={contributions} teamAName={teamA.name} teamBName={teamB.name} breakdown={breakdown} />
        </TabsContent>

        <TabsContent value="match-dna" className="pt-md">
          <MatchDnaTab
            teamA={teamA}
            teamB={teamB}
            teamADna={teamADna}
            teamBDna={teamBDna}
            rows={dnaGapRows}
            largestGapExplanation={largestGapExplanation}
            breakdown={breakdown}
          />
        </TabsContent>

        <TabsContent value="key-factors" className="pt-md">
          <KeyFactorsTab
            keyFactors={result.keyFactors}
            contributions={contributions}
            dnaGapRows={dnaGapRows}
            teamAName={teamA.name}
            teamBName={teamB.name}
            breakdown={breakdown}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="pt-md">
          <PipelineTab stages={pipelineStageViews} breakdown={breakdown} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
