import type { PredictionResult, Team } from "@repo/shared";
import { Card } from "@repo/ui";
import { DnaComparisonRadar } from "./DnaComparisonRadar";
import { TeamDnaCard } from "./TeamDnaCard";
import { MatchDnaSummary } from "./MatchDnaSummary";

export interface MatchDnaSectionProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function MatchDnaSection({ result, teamA, teamB }: MatchDnaSectionProps) {
  const [teamADna, teamBDna] = result.teamDna;

  return (
    <div className="flex flex-col gap-md">
      <h3>Match DNA</h3>
      <Card className="flex justify-center">
        <DnaComparisonRadar teamA={teamA} teamADna={teamADna} teamB={teamB} teamBDna={teamBDna} />
      </Card>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TeamDnaCard team={teamA} dna={teamADna} accentColor="var(--team-a)" />
        <TeamDnaCard team={teamB} dna={teamBDna} accentColor="var(--team-b)" />
      </div>
      <MatchDnaSummary matchDna={result.matchDna} dimensionReference={teamADna.dimensions} />
    </div>
  );
}
