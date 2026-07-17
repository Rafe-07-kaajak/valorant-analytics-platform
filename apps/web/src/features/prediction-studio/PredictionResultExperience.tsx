import type { PredictionResult, Team } from "@repo/shared";
import { PredictionSummary } from "./PredictionSummary";
import { ResultTimeline } from "./ResultTimeline";
import { MatchDnaSection } from "../match-dna/MatchDnaSection";
import { ExplanationCard } from "../insights/ExplanationCard";
import { FeatureContribution } from "../insights/FeatureContribution";
import { KeyFactorsList } from "../insights/KeyFactorsList";
import { InsightsList } from "../insights/InsightsList";

export interface PredictionResultExperienceProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function PredictionResultExperience({ result, teamA, teamB }: PredictionResultExperienceProps) {
  return (
    <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
      <PredictionSummary result={result} teamA={teamA} teamB={teamB} />
      <MatchDnaSection result={result} teamA={teamA} teamB={teamB} />
      <ExplanationCard explanation={result.explanation} />
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
