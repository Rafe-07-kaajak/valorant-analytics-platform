import type { NormalizedEvent } from "../normalize/normalizedSchemas";

const DAY_MS = 86_400_000;

/** Tracks per-event match timestamps to derive a leakage-safe congestion signal — TASK-044 requirement 10. */
export class EventCongestionRegistry {
  private readonly timestampsByEvent = new Map<string, number[]>();

  matchesInLast3Days(eventInternalId: string, nowMs: number): number {
    const list = this.timestampsByEvent.get(eventInternalId) ?? [];
    return list.filter((t) => t <= nowMs && nowMs - t <= 3 * DAY_MS).length;
  }

  /** Must only be called after every row in the current timestamp group has been snapshotted. */
  recordMatch(eventInternalId: string, timestampMs: number): void {
    const list = this.timestampsByEvent.get(eventInternalId) ?? [];
    list.push(timestampMs);
    this.timestampsByEvent.set(eventInternalId, list);
  }
}

export interface EventContextFeatures {
  readonly eventRegion: string;
  readonly eventStage: string;
  readonly seasonYear: number;
  readonly matchMonth: number;
  readonly isInternationalEvent: boolean;
  readonly isRegionalLeague: boolean;
  readonly isMastersOrChampions: boolean;
}

const MASTERS_CHAMPIONS_FAMILIES: ReadonlySet<string> = new Set(["masters", "champions"]);

/**
 * Derives event/regional context features directly from the event record
 * and the match's own scheduled timestamp — every value here is known at
 * scheduling time, strictly before kickoff, so there is no leakage risk.
 * Team-level region/home-market indicators are deliberately not derived
 * here — see docs/32-vlr-feature-engineering.md ("Region/Team Metadata
 * Policy") for why no per-team region evidence exists in the curated
 * dataset.
 */
export function deriveEventContextFeatures(event: NormalizedEvent, scheduledAtIso: string): EventContextFeatures {
  const scheduledDate = new Date(scheduledAtIso);
  return {
    eventRegion: event.region ?? "unknown",
    eventStage: event.stage ?? "unknown",
    seasonYear: scheduledDate.getUTCFullYear(),
    matchMonth: scheduledDate.getUTCMonth() + 1,
    isInternationalEvent: event.tournamentLevel === "international",
    isRegionalLeague: event.tournamentLevel === "league",
    isMastersOrChampions: MASTERS_CHAMPIONS_FAMILIES.has(event.eventFamily),
  };
}
