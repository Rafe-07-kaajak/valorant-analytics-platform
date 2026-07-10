import type { PredictionResult, Team } from "@repo/shared";
import { PredictionSummary } from "./PredictionSummary";
import { ResultTimeline } from "./ResultTimeline";
import { MatchDnaSection } from "../match-dna/MatchDnaSection";
import { ExplanationCard } from "../insights/ExplanationCard";
import { KeyFactorsList } from "../insights/KeyFactorsList";
import { InsightsList } from "../insights/InsightsList";

export interface PredictionResultExperienceProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function PredictionResultExperience({ result, teamA, teamB }: PredictionResultExperienceProps) {
  return (
    <div className="flex flex-col gap-lg">
      <PredictionSummary result={result} teamA={teamA} teamB={teamB} />
      <MatchDnaSection result={result} teamA={teamA} teamB={teamB} />
      <ExplanationCard explanation={result.explanation} />
      <KeyFactorsList factors={result.keyFactors} />
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
