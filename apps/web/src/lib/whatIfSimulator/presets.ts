import type { AttributeControlKey, TeamDraftAdjustment } from "./types";

export interface SimulationPreset {
  id: string;
  label: string;
  /** Neutral, scenario-analysis framing — never a claim of roster transfer, injury recovery, coaching change, or guaranteed improvement. */
  description: string;
  deltas: Partial<Record<AttributeControlKey, number>>;
}

/**
 * TASK-038 presets — fixed, documented deltas, applied to one team only.
 * Every preset is a hypothetical modeling exercise, never a forecast; none
 * claims a guaranteed outcome. Some deltas target fields the current
 * prediction formula doesn't read (see `types.ts`'s `affectsPrediction`) —
 * included anyway because they're the same real, trackable profile fields a
 * single attribute control would touch, and the UI is explicit about which
 * ones can move the headline probability.
 */
export const SIMULATION_PRESETS: readonly SimulationPreset[] = [
  {
    id: "improved-form",
    label: "Improved Form",
    description: "Models a team on a stronger current run: Recent Form +10, Consistency +5.",
    deltas: { recentFormIndex: 10, consistency: 5 },
  },
  {
    id: "stronger-defense",
    label: "Stronger Defense",
    description: "Models tighter defensive execution: Defense Strength +8, Map Control +6, Utility Efficiency +4.",
    deltas: { defenseStrength: 8, mapControl: 6, utilityEfficiency: 4 },
  },
  {
    id: "better-economy",
    label: "Better Economy",
    description: "Models more efficient utility/economy usage: Economy Efficiency +8, Utility Efficiency +8.",
    deltas: { economyEfficiency: 8, utilityEfficiency: 8 },
  },
  {
    id: "clutch-boost",
    label: "Clutch Boost",
    description: "Models stronger clutch-round conversion: Clutch Ability +8, Clutch Performance +8.",
    deltas: { clutchAbility: 8, clutchPerformance: 8 },
  },
  {
    id: "aggressive-style",
    label: "Aggressive Style",
    description: "Models a more aggressive playstyle, with a small adaptability tradeoff: Aggression +8, Tempo +6, Attack Strength +6, Adaptability -3.",
    deltas: { aggression: 8, tempo: 6, attackStrength: 6, adaptability: -3 },
  },
  {
    id: "balanced-upgrade",
    label: "Balanced Upgrade",
    description: "Models a small, uniform improvement across every Team DNA dimension: +3 to each.",
    deltas: { aggression: 3, tempo: 3, mapControl: 3, utilityEfficiency: 3, adaptability: 3, clutchAbility: 3 },
  },
];

/**
 * Real Model 2.0 presets — same hypothetical-modeling framing, applied to
 * `RealAxisKey` deltas instead of synthetic profile fields. `elo-swing` is
 * the only one that can move the headline probability (`eloStrength`
 * `affectsPrediction: true`); the rest are real supporting-context
 * shortcuts, same as the synthetic presets' non-`affectsPrediction` deltas.
 */
export const REAL_SIMULATION_PRESETS: readonly SimulationPreset[] = [
  {
    id: "elo-swing",
    label: "Elo Swing",
    description: "Models a hypothetical Elo rating shift: Elo Strength +10.",
    deltas: { eloStrength: 10 },
  },
  {
    id: "stronger-recent-form",
    label: "Stronger Recent Form",
    description: "Models a team on a stronger recent run: Recent Form +10.",
    deltas: { recentForm: 10 },
  },
  {
    id: "tougher-schedule",
    label: "Tougher Schedule Read",
    description: "Models the team having faced tougher recent opposition: Opponent-Adjusted Strength +8.",
    deltas: { opponentAdjustedStrength: 8 },
  },
  {
    id: "broader-map-pool",
    label: "Broader Map Pool",
    description: "Models a wider proven map pool: Map Pool Breadth +8.",
    deltas: { mapPoolBreadth: 8 },
  },
  {
    id: "more-rest",
    label: "More Rest",
    description: "Models a fresher team coming off more rest: Activity & Rest +8.",
    deltas: { activityRest: 8 },
  },
  {
    id: "deeper-experience",
    label: "Deeper Experience",
    description: "Models a more internationally experienced roster: Competition Experience +8.",
    deltas: { competitionExperience: 8 },
  },
];

export function getSimulationPreset(presetId: string): SimulationPreset | undefined {
  return [...SIMULATION_PRESETS, ...REAL_SIMULATION_PRESETS].find((preset) => preset.id === presetId);
}

/**
 * Applying a preset merges its deltas into the current draft — fields the
 * preset names are replaced with its fixed value, every other field the
 * user already adjusted is left exactly as it was. Presets never stack with
 * themselves: applying the same preset twice produces the same result as
 * applying it once.
 */
export function applyPresetToDraft(draft: TeamDraftAdjustment, preset: SimulationPreset): TeamDraftAdjustment {
  return { ...draft, ...preset.deltas };
}
