import { APPROVED_EVENT_FAMILIES } from "../classification/eventFamily";
import type { ApprovedEventFamily } from "../classification/eventFamily";

/**
 * Provider-neutral backfill scope model — see
 * docs/29-vlr-data-ingestion-foundation.md ("Historical Scope") and
 * TASK-041 requirement 3. This is the single object TASK-042's full
 * historical backfill will construct and pass to the ingestion service;
 * nothing about it is VLR-specific.
 */

export type MatchStatusFilter = "completed" | "scheduled" | "live";

/** Provider-neutral region tags, independent of event-family classification. */
export const BACKFILL_REGIONS = ["americas", "emea", "pacific", "china", "global"] as const;
export type BackfillRegion = (typeof BACKFILL_REGIONS)[number];

/**
 * Tournament level, the second classification axis alongside event family.
 * "international" covers Masters/Champions; "league" covers the four
 * regional VCT leagues. Everything else is excluded by definition.
 */
export const TOURNAMENT_LEVELS = ["international", "league"] as const;
export type TournamentLevel = (typeof TOURNAMENT_LEVELS)[number];

const MAX_EVENTS_CEILING = 2_000;
const MAX_MATCHES_CEILING = 50_000;

export interface BackfillScope {
  readonly startDate: string; // ISO date, "YYYY-MM-DD"
  readonly endDate: string; // ISO date, "YYYY-MM-DD"
  readonly matchStatus: readonly MatchStatusFilter[];
  readonly eventFamilies: readonly ApprovedEventFamily[];
  readonly regions: readonly BackfillRegion[];
  readonly tournamentLevels: readonly TournamentLevel[];
  readonly completedOnly: boolean;
  readonly includeEventIds: readonly string[];
  readonly excludeEventIds: readonly string[];
  readonly maximumEvents: number;
  readonly maximumMatches: number;
  readonly resumeCheckpoint?: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ScopeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed);
}

/**
 * Validates a backfill scope. Never mutates or "corrects" the scope — an
 * invalid scope is reported, not silently repaired, per
 * docs/15-data-architecture.md ("Validation should never invent missing
 * information").
 */
export function validateBackfillScope(scope: BackfillScope): ScopeValidationResult {
  const errors: string[] = [];

  if (!isValidIsoDate(scope.startDate)) errors.push(`startDate "${scope.startDate}" is not a valid ISO date (YYYY-MM-DD).`);
  if (!isValidIsoDate(scope.endDate)) errors.push(`endDate "${scope.endDate}" is not a valid ISO date (YYYY-MM-DD).`);
  if (isValidIsoDate(scope.startDate) && isValidIsoDate(scope.endDate) && scope.startDate > scope.endDate) {
    errors.push(`startDate "${scope.startDate}" must not be after endDate "${scope.endDate}".`);
  }

  if (scope.matchStatus.length === 0) errors.push("matchStatus must include at least one status.");
  if (scope.completedOnly && !scope.matchStatus.includes("completed")) {
    errors.push("completedOnly=true requires matchStatus to include \"completed\".");
  }

  if (scope.eventFamilies.length === 0) errors.push("eventFamilies must include at least one approved family.");
  for (const family of scope.eventFamilies) {
    if (!(APPROVED_EVENT_FAMILIES as readonly string[]).includes(family)) {
      errors.push(`eventFamilies contains unapproved value "${family}".`);
    }
  }

  if (scope.regions.length === 0) errors.push("regions must include at least one region.");
  for (const region of scope.regions) {
    if (!(BACKFILL_REGIONS as readonly string[]).includes(region)) {
      errors.push(`regions contains unrecognized value "${region}".`);
    }
  }

  if (scope.tournamentLevels.length === 0) errors.push("tournamentLevels must include at least one level.");
  for (const level of scope.tournamentLevels) {
    if (!(TOURNAMENT_LEVELS as readonly string[]).includes(level)) {
      errors.push(`tournamentLevels contains unrecognized value "${level}".`);
    }
  }

  const includeSet = new Set(scope.includeEventIds);
  const overlap = scope.excludeEventIds.filter((id) => includeSet.has(id));
  if (overlap.length > 0) errors.push(`includeEventIds and excludeEventIds overlap: ${overlap.join(", ")}.`);

  if (!Number.isInteger(scope.maximumEvents) || scope.maximumEvents <= 0) {
    errors.push("maximumEvents must be a positive integer.");
  } else if (scope.maximumEvents > MAX_EVENTS_CEILING) {
    errors.push(`maximumEvents (${scope.maximumEvents}) exceeds the safe ceiling of ${MAX_EVENTS_CEILING}.`);
  }

  if (!Number.isInteger(scope.maximumMatches) || scope.maximumMatches <= 0) {
    errors.push("maximumMatches must be a positive integer.");
  } else if (scope.maximumMatches > MAX_MATCHES_CEILING) {
    errors.push(`maximumMatches (${scope.maximumMatches}) exceeds the safe ceiling of ${MAX_MATCHES_CEILING}.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Deterministically serializes a scope: object keys in a fixed order and
 * array-valued fields sorted, so the same logical scope always produces the
 * same string regardless of construction order. Used for checkpoint keys
 * and idempotency.
 */
export function serializeBackfillScope(scope: BackfillScope): string {
  const canonical = {
    startDate: scope.startDate,
    endDate: scope.endDate,
    matchStatus: [...scope.matchStatus].sort(),
    eventFamilies: [...scope.eventFamilies].sort(),
    regions: [...scope.regions].sort(),
    tournamentLevels: [...scope.tournamentLevels].sort(),
    completedOnly: scope.completedOnly,
    includeEventIds: [...scope.includeEventIds].sort(),
    excludeEventIds: [...scope.excludeEventIds].sort(),
    maximumEvents: scope.maximumEvents,
    maximumMatches: scope.maximumMatches,
    resumeCheckpoint: scope.resumeCheckpoint ?? null,
  };
  return JSON.stringify(canonical);
}

/**
 * Builds the canonical TASK-042 target scope: completed matches from
 * 2025-01-01 through `asOfDate` (defaults to "now") across the six approved
 * event families. `endDate` is computed at call time so extending the scope
 * to "current date" never requires redesigning this function — see
 * requirement 3 ("compatible with incremental extension beyond the current
 * date").
 */
export function buildCanonicalTargetScope(asOfDate: Date = new Date()): BackfillScope {
  return {
    startDate: "2025-01-01",
    endDate: asOfDate.toISOString().slice(0, 10),
    matchStatus: ["completed"],
    eventFamilies: [...APPROVED_EVENT_FAMILIES],
    regions: [...BACKFILL_REGIONS],
    tournamentLevels: [...TOURNAMENT_LEVELS],
    completedOnly: true,
    includeEventIds: [],
    excludeEventIds: [],
    maximumEvents: MAX_EVENTS_CEILING,
    maximumMatches: MAX_MATCHES_CEILING,
  };
}
