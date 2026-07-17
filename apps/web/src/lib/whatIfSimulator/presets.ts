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

export function getSimulationPreset(presetId: string): SimulationPreset | undefined {
  return SIMULATION_PRESETS.find((preset) => preset.id === presetId);
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
