"use client";

import { useMemo } from "react";
import type { PredictionResult, Team } from "@repo/shared";
import { PredictionSummary } from "./PredictionSummary";
import { ResultTimeline } from "./ResultTimeline";
import { InteractivePredictionBreakdown } from "./breakdown/InteractivePredictionBreakdown";
import { useBreakdownState } from "./breakdown/useBreakdownState";
import { MatchDnaSection } from "../match-dna/MatchDnaSection";
import { ExplanationCard } from "../insights/ExplanationCard";
import { FeatureContribution } from "../insights/FeatureContribution";
import { KeyFactorsList } from "../insights/KeyFactorsList";
import { InsightsList } from "../insights/InsightsList";
import { splitExplanationFragments } from "../../lib/predictionBreakdown";

export interface PredictionResultExperienceProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function PredictionResultExperience({ result, teamA, teamB }: PredictionResultExperienceProps) {
  const breakdown = useBreakdownState();
  const explanationFragments = useMemo(() => splitExplanationFragments(result), [result]);

  return (
    <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
      <PredictionSummary result={result} teamA={teamA} teamB={teamB} />
      <InteractivePredictionBreakdown result={result} teamA={teamA} teamB={teamB} breakdown={breakdown} />
      <MatchDnaSection result={result} teamA={teamA} teamB={teamB} />
      <ExplanationCard
        explanation={result.explanation}
        fragments={explanationFragments}
        activeDimensionKey={breakdown.activeDimensionKey}
        selectedDimensionKey={breakdown.selectedDimensionKey}
        onHoverDimension={breakdown.hoverDimension}
        onSelectDimension={breakdown.selectDimension}
      />
      <KeyFactorsList factors={result.keyFactors} />
      <FeatureContribution factors={result.keyFactors} />
      <InsightsList insights={result.insights} />
      <ResultTimeline stages={result.pipeline} />

      {result.warnings.map((warning) => (
        <p key={warning} className="text-sm text-warning">
          {warning}
        </p>
      ))}
    </div>
  );
}
