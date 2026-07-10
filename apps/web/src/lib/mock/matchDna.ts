import type { DnaDimensionKey, MatchDna, TeamDna } from "@repo/shared";

export function generateMatchDna(teamADna: TeamDna, teamBDna: TeamDna): MatchDna {
  const diffs = teamADna.dimensions.map((dimension) => {
    const opposing = teamBDna.dimensions.find((d) => d.key === dimension.key);
    const diff = Math.abs(dimension.value - (opposing?.value ?? dimension.value));
    return { key: dimension.key, diff, average: (dimension.value + (opposing?.value ?? 0)) / 2 };
  });

  const averageDiff = diffs.reduce((sum, d) => sum + d.diff, 0) / diffs.length;
  const similarityScore = Math.round(Math.max(0, 100 - averageDiff * 1.4));

  const conflictingTraits: DnaDimensionKey[] = diffs
    .filter((d) => d.diff >= 20)
    .sort((a, b) => b.diff - a.diff)
    .map((d) => d.key);

  const complementaryTraits: DnaDimensionKey[] = diffs
    .filter((d) => d.diff < 12 && d.average >= 55)
    .map((d) => d.key);

  const decisiveTrait = [...diffs].sort((a, b) => b.diff - a.diff)[0]!.key;

  return { similarityScore, complementaryTraits, conflictingTraits, decisiveTrait };
}
