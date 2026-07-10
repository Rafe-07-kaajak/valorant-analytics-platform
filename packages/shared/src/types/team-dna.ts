export type DnaDimensionKey =
  | "aggression"
  | "tempo"
  | "mapControl"
  | "utilityEfficiency"
  | "adaptability"
  | "clutchAbility";

export interface DnaDimensionScore {
  key: DnaDimensionKey;
  label: string;
  value: number;
}

export interface TeamDna {
  teamId: string;
  dimensions: DnaDimensionScore[];
}

export interface MatchDna {
  similarityScore: number;
  complementaryTraits: DnaDimensionKey[];
  conflictingTraits: DnaDimensionKey[];
  decisiveTrait: DnaDimensionKey;
}
