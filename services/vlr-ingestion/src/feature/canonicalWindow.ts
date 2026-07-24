import { IngestionError } from "../errors";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import type { CuratedMatch } from "../curate/curatedExport";

const DEFAULT_WINDOW_EVENT_NAME = "Valorant Masters Toronto 2025";

/**
 * The canonical eligibility window for training/ranking/replay exposure —
 * derived at runtime from the real curated dataset (never a hardcoded
 * literal date), per the requirement that the window boundary be
 * traceable back to its source event rather than trusted from memory.
 * Feature computation itself (Elo/form state) still replays the FULL
 * curated history regardless of this window — only row *eligibility* for
 * downstream splitting/ranking is restricted by it, so a team's real
 * rating entering the window is warmed up correctly rather than reset.
 */
export interface CanonicalWindow {
  readonly windowStartIso: string;
  readonly sourceEventInternalId: string;
  readonly sourceEventName: string;
}

/**
 * Finds `eventName` among the curated events, takes the earliest
 * `scheduledAt.iso` among that event's own matches as the window start.
 * Throws rather than silently falling back to a guessed date if the event
 * or a match for it can't be found — an empty/wrong window would silently
 * corrupt every downstream training/ranking decision.
 */
export function deriveCanonicalWindow(
  events: readonly NormalizedEvent[],
  matches: readonly CuratedMatch[],
  eventName: string = DEFAULT_WINDOW_EVENT_NAME,
): CanonicalWindow {
  const sourceEvent = events.find((event) => event.name === eventName);
  if (!sourceEvent) {
    throw new IngestionError("checkpoint_failure", `Canonical window anchor event "${eventName}" was not found in the curated events dataset.`);
  }

  const eventMatches = matches.filter((match) => match.eventId === sourceEvent.internalId);
  if (eventMatches.length === 0) {
    throw new IngestionError("checkpoint_failure", `Canonical window anchor event "${eventName}" (${sourceEvent.internalId}) has no curated matches to derive a start timestamp from.`);
  }

  // A match with an unresolvably ambiguous timezone has `scheduledAt.iso ===
  // null` (see NormalizedTimestamp's doc comment — never fabricated). Such
  // a match can't anchor the window boundary; only matches with a genuine
  // UTC timestamp are considered.
  const resolvedTimestamps = eventMatches.map((match) => match.scheduledAt.iso).filter((iso): iso is string => iso !== null);
  if (resolvedTimestamps.length === 0) {
    throw new IngestionError("checkpoint_failure", `Canonical window anchor event "${eventName}" (${sourceEvent.internalId}) has no match with a resolvable UTC timestamp.`);
  }

  const windowStartIso = resolvedTimestamps.reduce((earliest, iso) => (iso < earliest ? iso : earliest));

  return { windowStartIso, sourceEventInternalId: sourceEvent.internalId, sourceEventName: sourceEvent.name };
}

/** Inclusive: a match scheduled exactly at the window's start timestamp is eligible. */
export function isEligibleForCanonicalWindow(scheduledAtIso: string, window: CanonicalWindow): boolean {
  return scheduledAtIso >= window.windowStartIso;
}
