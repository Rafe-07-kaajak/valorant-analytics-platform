import type { DnaDimensionKey, DnaDimensionScore, TeamDna } from "@repo/shared";
import { seededRatio } from "./seededRatio";

const DIMENSIONS: { key: DnaDimensionKey; label: string }[] = [
  { key: "aggression", label: "Aggression" },
  { key: "tempo", label: "Tempo" },
  { key: "mapControl", label: "Map Control" },
  { key: "utilityEfficiency", label: "Utility Efficiency" },
  { key: "adaptability", label: "Adaptability" },
  { key: "clutchAbility", label: "Clutch Ability" },
];

export function generateTeamDna(teamId: string): TeamDna {
  const dimensions: DnaDimensionScore[] = DIMENSIONS.map(({ key, label }) => ({
    key,
    label,
    value: Math.round(30 + seededRatio(`dna:${teamId}:${key}`) * 65),
  }));

  return { teamId, dimensions };
}

export { DIMENSIONS as DNA_DIMENSIONS };
