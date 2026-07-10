import type { Team, TeamDna } from "@repo/shared";
import { Badge, Card } from "@repo/ui";

export interface TeamDnaCardProps {
  team: Team;
  dna: TeamDna;
  accentColor: string;
}

export function TeamDnaCard({ team, dna, accentColor }: TeamDnaCardProps) {
  const strongest = [...dna.dimensions].sort((a, b) => b.value - a.value).slice(0, 2);

  return (
    <Card className="flex flex-col gap-xs">
      <div className="flex items-center gap-2xs">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span className="font-medium text-foreground">{team.name}</span>
      </div>
      <p className="text-sm text-muted-foreground">Defined by {strongest.map((d) => d.label.toLowerCase()).join(" and ")}.</p>
      <div className="flex flex-wrap gap-2xs">
        {strongest.map((dimension) => (
          <Badge key={dimension.key} tone="brand">
            {dimension.label} · {dimension.value}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
