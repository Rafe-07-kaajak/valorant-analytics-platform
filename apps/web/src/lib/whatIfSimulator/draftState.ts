import {
  SIMULATION_DELTA_MAX,
  SIMULATION_DELTA_MIN,
  type DnaDimensionKey,
  type VctProfileAdjustment,
  type VctProfileScalarField,
} from "@repo/shared";
import { ALL_ATTRIBUTE_CONTROLS, type AttributeControlKey, type MapDraftAdjustment, type TeamDraftAdjustment } from "./types";

export function clampDeltaValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(SIMULATION_DELTA_MAX, Math.max(SIMULATION_DELTA_MIN, Math.round(value)));
}

export function createEmptyTeamDraft(): TeamDraftAdjustment {
  const draft = {} as TeamDraftAdjustment;
  for (const control of ALL_ATTRIBUTE_CONTROLS) draft[control.key] = 0;
  return draft;
}

export function createEmptyMapDraft(mapIds: readonly string[]): MapDraftAdjustment {
  const draft: MapDraftAdjustment = {};
  for (const mapId of mapIds) draft[mapId] = 0;
  return draft;
}

export function setAttributeDelta(
  draft: TeamDraftAdjustment,
  key: AttributeControlKey,
  value: number,
): TeamDraftAdjustment {
  return { ...draft, [key]: clampDeltaValue(value) };
}

export function resetAttributeDelta(draft: TeamDraftAdjustment, key: AttributeControlKey): TeamDraftAdjustment {
  return { ...draft, [key]: 0 };
}

export function setMapDelta(draft: MapDraftAdjustment, mapId: string, value: number): MapDraftAdjustment {
  return { ...draft, [mapId]: clampDeltaValue(value) };
}

export function resetMapDelta(draft: MapDraftAdjustment, mapId: string): MapDraftAdjustment {
  return { ...draft, [mapId]: 0 };
}

export function teamDraftHasAdjustments(draft: TeamDraftAdjustment): boolean {
  return Object.values(draft).some((value) => value !== 0);
}

export function mapDraftHasAdjustments(draft: MapDraftAdjustment): boolean {
  return Object.values(draft).some((value) => value !== 0);
}

export function hasAnyAdjustments(
  teamADraft: TeamDraftAdjustment,
  teamBDraft: TeamDraftAdjustment,
  mapADraft: MapDraftAdjustment,
  mapBDraft: MapDraftAdjustment,
): boolean {
  return (
    teamDraftHasAdjustments(teamADraft) ||
    teamDraftHasAdjustments(teamBDraft) ||
    mapDraftHasAdjustments(mapADraft) ||
    mapDraftHasAdjustments(mapBDraft)
  );
}

/**
 * Converts a flat 12-key UI draft plus a per-map draft into the wire
 * `VctProfileAdjustment` shape, omitting every zero entry — an absent key
 * means "no hypothetical change", keeping the request payload minimal and
 * matching what the server's allowlist validator expects.
 */
export function toProfileAdjustment(draft: TeamDraftAdjustment, mapDraft: MapDraftAdjustment): VctProfileAdjustment {
  const scalar: Partial<Record<VctProfileScalarField, number>> = {};
  const dna: Partial<Record<DnaDimensionKey, number>> = {};

  for (const control of ALL_ATTRIBUTE_CONTROLS) {
    const delta = draft[control.key];
    if (delta === 0) continue;
    if (control.kind === "scalar") scalar[control.key as VctProfileScalarField] = delta;
    else dna[control.key as DnaDimensionKey] = delta;
  }

  const mapStrength: Record<string, number> = {};
  for (const [mapId, delta] of Object.entries(mapDraft)) {
    if (delta !== 0) mapStrength[mapId] = delta;
  }

  return { scalar, dna, mapStrength };
}

/** Inverse of `toProfileAdjustment` — turns an applied wire-shape `VctProfileAdjustment` back into a full, zero-filled UI draft (real or synthetic keys alike, since both live in `.dna`/`.scalar` generically), so already-applied adjustments can reuse the same display/summary helpers as live draft state. */
export function fromProfileAdjustment(adjustment: VctProfileAdjustment): TeamDraftAdjustment {
  const draft = createEmptyTeamDraft();
  for (const [key, delta] of Object.entries(adjustment.scalar)) {
    if (typeof delta === "number") draft[key as AttributeControlKey] = delta;
  }
  for (const [key, delta] of Object.entries(adjustment.dna)) {
    if (typeof delta === "number") draft[key as AttributeControlKey] = delta;
  }
  return draft;
}
