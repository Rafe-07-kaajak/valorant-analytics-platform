import type { DnaDimensionKey } from "@repo/shared";

/**
 * Feature Registry — see docs/07-feature-platform.md ("Feature Registry",
 * "Feature Metadata", "Engineering Rules") and docs/00a-ubiquitous-language.md
 * ("Feature Platform"). This is the single source of truth for every Team
 * DNA feature's metadata; docs/07-feature-platform.md states a feature
 * missing any required metadata cannot enter production.
 *
 * This is a minimal, typed, in-memory catalog rather than the full
 * lifecycle/monitoring platform docs/07-feature-platform.md describes as the
 * long-term target — that scope is explicitly out of Version 1.
 */

export type FeatureStatus = "Experimental" | "Validated" | "Production" | "Deprecated" | "Archived";

export interface FeatureRegistryEntry {
  /** Unique identifier, e.g. "TEAM_DNA_AGGRESSION". */
  id: string;
  /** Stable key shared with the TeamDna contract in @repo/shared. */
  key: DnaDimensionKey;
  /** Human-readable name, used as the dimension's display label. */
  name: string;
  /** Business meaning of the feature. */
  description: string;
  /** Feature Platform category, per docs/07-feature-platform.md. */
  category: string;
  /** Responsible engineering component. */
  owner: string;
  /** Which normalized aggregate field(s) this feature is computed from. */
  source: string;
  /** Implementation-independent, human-readable formula description. */
  formula: string;
  /** How to interpret higher vs. lower values. */
  direction: string;
  /** Relative contribution weight used when combining features (TASK-016). */
  weight: number;
  /** Current production version. */
  version: string;
  status: FeatureStatus;
  consumers: string[];
}

const TEAM_DNA_FEATURES: FeatureRegistryEntry[] = [
  {
    id: "TEAM_DNA_AGGRESSION",
    key: "aggression",
    name: "Aggression",
    description:
      "How often a team secures the opening kill of a round, reflecting its willingness to take early space and initiate fights.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized entrySuccessRate (team first kills ÷ total rounds played across all matches).",
    formula: "Aggression = Entry Success Rate × 100, clamped to 0-100.",
    direction: "Higher values indicate a more aggressive, opening-duel-focused team.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
  {
    id: "TEAM_DNA_TEMPO",
    key: "tempo",
    name: "Tempo",
    description:
      "How decisively a team's matches tend to be settled, used as a proxy for pacing in the absence of round-length data.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized averageRoundDifferential (average round differential across all matches).",
    formula: "Tempo = 50 + |average round differential| × 4, clamped to 0-100.",
    direction: "Higher values indicate matches that swing more decisively either way; 50 is an even average.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
  {
    id: "TEAM_DNA_MAP_CONTROL",
    key: "mapControl",
    name: "Map Control",
    description: "A team's overall command of individual rounds across its match history.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized roundWinRate (total rounds won ÷ total rounds played across all matches).",
    formula: "Map Control = Round Win Rate × 100, clamped to 0-100.",
    direction: "Higher values indicate a team that wins a larger share of the rounds it plays.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
  {
    id: "TEAM_DNA_UTILITY_EFFICIENCY",
    key: "utilityEfficiency",
    name: "Utility Efficiency",
    description:
      "How efficiently a team converts fully-equipped rounds into wins — the closest available proxy for utility/equipment execution quality, since individual utility usage is not tracked.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized economyOutcomeRates.fullBuy (full-buy round win rate across all matches).",
    formula: "Utility Efficiency = Full-Buy Round Win Rate × 100, clamped to 0-100.",
    direction: "Higher values indicate more effective execution when fully equipped.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
  {
    id: "TEAM_DNA_ADAPTABILITY",
    key: "adaptability",
    name: "Adaptability",
    description: "How consistently a team performs across different maps rather than relying on a narrow map pool.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized mapPerformance win rates (per-map win rate breakdown).",
    formula:
      "Adaptability = 100 - (standard deviation of per-map win rates × 200), clamped to 0-100; requires at least 2 maps with recorded results.",
    direction: "Higher values indicate a win rate that stays consistent across the team's map pool.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
  {
    id: "TEAM_DNA_CLUTCH_ABILITY",
    key: "clutchAbility",
    name: "Clutch Ability",
    description: "How often a team converts disadvantageous late-round situations into round wins.",
    category: "Team DNA",
    owner: "Prediction Engine",
    source: "Normalized clutchConversionRate (clutch situations won ÷ clutch situations faced across all matches).",
    formula: "Clutch Ability = Clutch Conversion Rate × 100, clamped to 0-100.",
    direction: "Higher values indicate a team that wins a larger share of the clutch situations it faces.",
    weight: 1,
    version: "v1",
    status: "Production",
    consumers: ["Prediction Engine"],
  },
];

/**
 * Read accessor for the Feature Registry. Returns the same entries every
 * call — this is a static, in-memory catalog, not a mutable store.
 */
export function getFeatureRegistry(): FeatureRegistryEntry[] {
  return TEAM_DNA_FEATURES;
}
