import type { Team, TeamDna } from "@repo/shared";
import { RadarChart, type RadarAxis } from "@repo/ui";

export interface DnaComparisonRadarProps {
  teamA: Team;
  teamADna: TeamDna;
  teamB: Team;
  teamBDna: TeamDna;
}

export function DnaComparisonRadar({ teamA, teamADna, teamB, teamBDna }: DnaComparisonRadarProps) {
  const axes: RadarAxis[] = teamADna.dimensions.map((dimension) => ({
    key: dimension.key,
    label: dimension.label,
  }));

  const toValues = (dna: TeamDna) =>
    Object.fromEntries(dna.dimensions.map((dimension) => [dimension.key, dimension.value]));

  return (
    <RadarChart
      axes={axes}
      series={[
        { id: teamA.id, label: teamA.name, color: "var(--team-a)", values: toValues(teamADna) },
        { id: teamB.id, label: teamB.name, color: "var(--team-b)", values: toValues(teamBDna) },
      ]}
    />
  );
}
