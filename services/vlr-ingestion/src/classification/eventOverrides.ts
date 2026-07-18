import type { EventClassification } from "./eventFamily";
import { ALL_EVENT_CLASSIFICATIONS } from "./eventFamily";

/**
 * Manual override registry for event classification — see TASK-041
 * requirement 4 ("manual override registry must be supported") and
 * requirement 9 ("maintain an optional authoritative override registry for
 * event-family classification"). Overrides are keyed by the VLR provider
 * event ID and always win over any automatic classification, because a
 * human has verified the mapping. They never invent an event ID — every
 * entry must reference an ID that already appeared in discovered or fixture
 * data.
 */
export interface EventClassificationOverride {
  readonly providerEventId: string;
  readonly classification: EventClassification;
  /** Why a human overrode automatic classification, for future audit. */
  readonly reason: string;
}

export interface OverrideConflict {
  readonly providerEventId: string;
  readonly conflicting: readonly EventClassificationOverride[];
}

export interface OverrideValidationResult {
  readonly valid: boolean;
  readonly conflicts: readonly OverrideConflict[];
  readonly invalidEntries: readonly { entry: EventClassificationOverride; reasons: readonly string[] }[];
}

function validateEntry(entry: EventClassificationOverride): string[] {
  const reasons: string[] = [];
  if (!entry.providerEventId || entry.providerEventId.trim().length === 0) {
    reasons.push("providerEventId must be a non-empty string.");
  }
  if (!(ALL_EVENT_CLASSIFICATIONS as readonly string[]).includes(entry.classification)) {
    reasons.push(`classification "${entry.classification}" is not a recognized classification value.`);
  }
  if (!entry.reason || entry.reason.trim().length === 0) {
    reasons.push("reason must be a non-empty string documenting why the override exists.");
  }
  return reasons;
}

/**
 * Validates a registry of overrides. Two entries for the same
 * `providerEventId` that disagree on classification are a conflict and fail
 * validation — the registry must never leave classification ambiguous.
 */
export function validateOverrideRegistry(entries: readonly EventClassificationOverride[]): OverrideValidationResult {
  const invalidEntries: { entry: EventClassificationOverride; reasons: readonly string[] }[] = [];
  for (const entry of entries) {
    const reasons = validateEntry(entry);
    if (reasons.length > 0) invalidEntries.push({ entry, reasons });
  }

  const byEventId = new Map<string, EventClassificationOverride[]>();
  for (const entry of entries) {
    const bucket = byEventId.get(entry.providerEventId);
    if (bucket) bucket.push(entry);
    else byEventId.set(entry.providerEventId, [entry]);
  }

  const conflicts: OverrideConflict[] = [];
  for (const [providerEventId, group] of byEventId) {
    const distinctClassifications = new Set(group.map((entry) => entry.classification));
    if (distinctClassifications.size > 1) {
      conflicts.push({ providerEventId, conflicting: group });
    }
  }

  return { valid: invalidEntries.length === 0 && conflicts.length === 0, conflicts, invalidEntries };
}

/**
 * Builds a lookup map from a validated registry. Callers must validate
 * first — this function does not re-validate and assumes no conflicts.
 */
export function buildOverrideLookup(entries: readonly EventClassificationOverride[]): ReadonlyMap<string, EventClassificationOverride> {
  const lookup = new Map<string, EventClassificationOverride>();
  for (const entry of entries) {
    lookup.set(entry.providerEventId, entry);
  }
  return lookup;
}

/**
 * Initial override registry. Left empty: TASK-041 must not invent VLR event
 * IDs, and no verified overrides were available from approved fixtures at
 * foundation time. Populate via `validateOverrideRegistry` +
 * `buildOverrideLookup` once TASK-042 discovers and verifies real event IDs.
 */
export const INITIAL_EVENT_CLASSIFICATION_OVERRIDES: readonly EventClassificationOverride[] = [];
