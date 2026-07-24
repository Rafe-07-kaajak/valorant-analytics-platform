/**
 * TASK-038 What-if Simulator — shared pure types.
 *
 * `VctTeamProfile` actually stores 12 named numbers per team, but only 7 are
 * independent: 6 Team DNA dimensions plus `recentFormIndex`. `attackStrength`,
 * `defenseStrength`, `economyEfficiency`, `clutchPerformance`, and
 * `consistency` are pre-computed aliases/composites of those same 6
 * dimensions at profile-generation time (see
 * `services/prediction-engine/src/lib/vctTeamProfiles.ts`) — but
 * `computeVctPredictionFromProfiles` only ever reads `profile.dna` and
 * `profile.recentFormIndex`. Every one of the 12 attributes below is a real,
 * independently adjustable field on the simulated profile (never silently
 * merged or dropped), but only `affectsPrediction: true` fields can move the
 * headline probability/confidence/trust/key factors — the other five are
 * genuinely tracked (visible in the Change Breakdown / adjustment summary)
 * but currently inert with respect to the modeled outcome, and the Controls
 * tab says so rather than implying a false causal effect.
 */
import type { DnaDimensionKey, VctProfileScalarField } from "@repo/shared";

export type AttributeControlKey =
  | DnaDimensionKey
  | VctProfileScalarField;

export interface AttributeControlDefinition {
  key: AttributeControlKey;
  label: string;
  kind: "dna" | "scalar";
  /** Whether the current prediction formula reads this field at all. */
  affectsPrediction: boolean;
}

export const ATTRIBUTE_CONTROLS: readonly AttributeControlDefinition[] = [
  { key: "attackStrength", label: "Attack Strength", kind: "scalar", affectsPrediction: false },
  { key: "defenseStrength", label: "Defense Strength", kind: "scalar", affectsPrediction: false },
  { key: "economyEfficiency", label: "Economy Efficiency", kind: "scalar", affectsPrediction: false },
  { key: "clutchPerformance", label: "Clutch Performance", kind: "scalar", affectsPrediction: false },
  { key: "consistency", label: "Consistency", kind: "scalar", affectsPrediction: false },
  { key: "recentFormIndex", label: "Recent Form Index", kind: "scalar", affectsPrediction: true },
  { key: "aggression", label: "Aggression", kind: "dna", affectsPrediction: true },
  { key: "tempo", label: "Tempo", kind: "dna", affectsPrediction: true },
  { key: "mapControl", label: "Map Control", kind: "dna", affectsPrediction: true },
  { key: "utilityEfficiency", label: "Utility Efficiency", kind: "dna", affectsPrediction: true },
  { key: "adaptability", label: "Adaptability", kind: "dna", affectsPrediction: true },
  { key: "clutchAbility", label: "Clutch Ability", kind: "dna", affectsPrediction: true },
];

/**
 * Real Model 2.0's controls — every key is a real `RealAxisKey` (see
 * `@repo/shared`'s `team-dna.ts`), each backed by a real ingested feature.
 * `eloStrength` is the only one the deployed `elo-baseline` estimator
 * consumes (`affectsPrediction: true`); the rest are real supporting
 * context, tracked and visible in the Change Breakdown but inert on the
 * headline probability — the same `affectsPrediction` mechanism the
 * synthetic controls already use, applied honestly to real data instead.
 */
export const REAL_ATTRIBUTE_CONTROLS: readonly AttributeControlDefinition[] = [
  { key: "eloStrength", label: "Elo Strength", kind: "dna", affectsPrediction: true },
  { key: "recentForm", label: "Recent Form", kind: "dna", affectsPrediction: false },
  { key: "opponentAdjustedStrength", label: "Opponent-Adjusted Strength", kind: "dna", affectsPrediction: false },
  { key: "mapPoolBreadth", label: "Map Pool Breadth", kind: "dna", affectsPrediction: false },
  { key: "scheduleStrength", label: "Strength of Schedule", kind: "dna", affectsPrediction: false },
  { key: "activityRest", label: "Activity & Rest", kind: "dna", affectsPrediction: false },
  { key: "competitionExperience", label: "Competition Experience", kind: "dna", affectsPrediction: false },
];

/**
 * Every control key from every engine, combined — used only to seed a draft
 * with a zero-filled entry per key (`createEmptyTeamDraft`) and to iterate
 * when converting a draft to/from its wire shape (`toProfileAdjustment`/
 * `fromProfileAdjustment`), so those pure helpers stay engine-agnostic. A
 * mounted `TeamControlsPanel` only ever renders the one engine-appropriate
 * subset (via its own `controls` prop) — this combined list is never
 * rendered directly.
 */
export const ALL_ATTRIBUTE_CONTROLS: readonly AttributeControlDefinition[] = [...ATTRIBUTE_CONTROLS, ...REAL_ATTRIBUTE_CONTROLS];

/** Every attribute's hypothetical delta for one team, always fully populated (0 = untouched, matching the baseline). */
export type TeamDraftAdjustment = Record<AttributeControlKey, number>;

/** Every scenario-selected map's hypothetical strength delta for one team, keyed by map id. */
export type MapDraftAdjustment = Record<string, number>;

export type SimulatorStatus = "idle" | "loading" | "success" | "error";
