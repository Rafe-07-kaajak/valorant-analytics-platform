"use client";

import Image from "next/image";
import type { PredictionResult, Team } from "@repo/shared";
import { Card } from "@repo/ui";
import { DnaComparisonRadar } from "./DnaComparisonRadar";
import { TeamDnaCard } from "./TeamDnaCard";
import { MatchDnaSummary } from "./MatchDnaSummary";
import { TacticalBlueprintGrid } from "../../components/effects/TacticalBlueprintGrid";
import { usePointerGlow } from "../../hooks/usePointerGlow";
import { MEDIA_ASSETS } from "../../constants/media";

export interface MatchDnaSectionProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function MatchDnaSection({ result, teamA, teamB }: MatchDnaSectionProps) {
  const [teamADna, teamBDna] = result.teamDna;
  const { matchDna } = MEDIA_ASSETS;
  const glow = usePointerGlow<HTMLDivElement>();

  return (
    <div
      className="tactical-grid-glow-host relative flex flex-col gap-md overflow-hidden rounded-lg"
      onPointerEnter={glow.onPointerEnter}
      onPointerMove={glow.onPointerMove}
      onPointerLeave={glow.onPointerLeave}
    >
      <TacticalBlueprintGrid interactive />
      <div className="relative flex flex-col gap-md">
        <div className="relative aspect-[2816/1536] w-full overflow-hidden rounded-lg border border-surface-border">
          <Image
            src={matchDna.path}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            loading="lazy"
            className="object-cover"
          />
        </div>
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
    </div>
  );
}
