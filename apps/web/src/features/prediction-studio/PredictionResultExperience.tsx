"use client";

import { useMemo } from "react";
import type { GameMap, PredictionResult, Team } from "@repo/shared";
import { PredictionSummary } from "./PredictionSummary";
import { ResultTimeline } from "./ResultTimeline";
import { InteractivePredictionBreakdown } from "./breakdown/InteractivePredictionBreakdown";
import { useBreakdownState } from "./breakdown/useBreakdownState";
import { WhatIfSimulator, type WhatIfSimulatorProps } from "./simulator/WhatIfSimulator";
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
  maps: GameMap[];
  /**
   * Prediction Studio mode-correction task — optional What-if Simulator
   * engine overrides. Omitted (the default), the simulator behaves exactly
   * as before (synthetic HTTP baseline fetch + `/api/simulate-prediction`).
   * Real Model 2.0 passes its own real-data baseline/recompute here instead.
   */
  simulatorOverrides?: Pick<WhatIfSimulatorProps, "simulatorMapIds" | "getBaseline" | "runSimulation" | "controls" | "presets">;
}

/** Identical shape to the engine's own `scenarioCacheKey` — used only to remount `WhatIfSimulator` when the underlying scenario genuinely changes, never for caching. */
function scenarioKey(result: PredictionResult): string {
  const { teamAId, teamBId, seriesFormat, mapIds } = result.scenario;
  return [teamAId, teamBId, seriesFormat, [...mapIds].sort().join(",")].join("|");
}

export function PredictionResultExperience({ result, teamA, teamB, maps, simulatorOverrides }: PredictionResultExperienceProps) {
  const breakdown = useBreakdownState();
  const explanationFragments = useMemo(() => splitExplanationFragments(result), [result]);

  return (
    <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
      <PredictionSummary result={result} teamA={teamA} teamB={teamB} />
      <InteractivePredictionBreakdown result={result} teamA={teamA} teamB={teamB} breakdown={breakdown} />
      <WhatIfSimulator key={scenarioKey(result)} result={result} teamA={teamA} teamB={teamB} maps={maps} {...simulatorOverrides} />
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
