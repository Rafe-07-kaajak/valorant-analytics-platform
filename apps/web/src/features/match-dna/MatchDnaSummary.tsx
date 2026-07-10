import type { DnaDimensionScore, MatchDna } from "@repo/shared";
import { Badge, Card, Meter } from "@repo/ui";

export interface MatchDnaSummaryProps {
  matchDna: MatchDna;
  dimensionReference: DnaDimensionScore[];
}

export function MatchDnaSummary({ matchDna, dimensionReference }: MatchDnaSummaryProps) {
  const labelFor = (key: string) => dimensionReference.find((d) => d.key === key)?.label ?? key;

  return (
    <Card className="flex flex-col gap-md">
      <Meter label="Playstyle Similarity" value={matchDna.similarityScore} />

      {matchDna.complementaryTraits.length > 0 ? (
        <div className="flex flex-col gap-2xs">
          <span className="text-sm font-medium text-foreground">Shared Strengths</span>
          <div className="flex flex-wrap gap-2xs">
            {matchDna.complementaryTraits.map((trait) => (
              <Badge key={trait} tone="success">
                {labelFor(trait)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {matchDna.conflictingTraits.length > 0 ? (
        <div className="flex flex-col gap-2xs">
          <span className="text-sm font-medium text-foreground">Stylistic Conflicts</span>
          <div className="flex flex-wrap gap-2xs">
            {matchDna.conflictingTraits.map((trait) => (
              <Badge key={trait} tone="danger">
                {labelFor(trait)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
