import Image from "next/image";
import type { Team, TeamDna } from "@repo/shared";
import { Badge, Card } from "@repo/ui";
import { MEDIA_ASSETS } from "../../constants/media";

export interface TeamDnaCardProps {
  team: Team;
  dna: TeamDna;
  accentColor: string;
}

export function TeamDnaCard({ team, dna, accentColor }: TeamDnaCardProps) {
  const strongest = [...dna.dimensions].sort((a, b) => b.value - a.value).slice(0, 2);
  const { teamDna } = MEDIA_ASSETS;

  return (
    <Card className="relative flex flex-col gap-xs overflow-hidden">
      <Image
        src={teamDna.path}
        alt=""
        aria-hidden="true"
        fill
        sizes="(min-width: 640px) 24rem, 100vw"
        loading="lazy"
        className="object-cover opacity-[0.05]"
      />
      <div className="relative flex items-center gap-2xs">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span className="font-medium text-foreground">{team.name}</span>
      </div>
      <p className="relative text-sm text-muted-foreground">
        Defined by {strongest.map((d) => d.label.toLowerCase()).join(" and ")}.
      </p>
      <div className="relative flex flex-wrap gap-2xs">
        {strongest.map((dimension) => (
          <Badge key={dimension.key} tone="brand">
            {dimension.label} · {dimension.value}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
