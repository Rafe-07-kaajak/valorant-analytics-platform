import type { FeatureFieldMeta } from "../feature/featureCatalog";
import type { FeatureRow } from "../feature/types";

/**
 * Feature policy — TASK-045 requirement 5. Separates the 176 columns TASK-044
 * exports into the buckets this task's contract requires: identifiers/labels
 * (never model inputs), numeric/boolean/categorical inputs, and an explicit
 * high-risk exclusion list. Built directly from `feature-catalog.json`
 * (`type`/`featureGroup`) rather than a hand-maintained field list, so it can
 * never silently drift from TASK-044's actual schema — the same anti-drift
 * property `featureValidation.ts` already relies on for the catalog itself.
 */

/**
 * Fields the catalog classifies as legitimate model-input columns but that
 * this task excludes anyway, because their *value space* is team/entity
 * identity rather than a measured signal. `h2hMostRecentMeetingWinnerProviderId`
 * holds an arbitrary team provider ID; one-hot encoding it would let the
 * model memorize specific team identities through the back door despite
 * `teamAProviderId`/`teamBProviderId` themselves already being excluded as
 * identifiers. The same information is already available in orientation-safe
 * numeric form via `h2hTeamAWins`/`h2hTeamBWins`/`h2hTeamAWinRate`.
 */
export const HIGH_RISK_EXCLUDED_FIELDS: ReadonlySet<string> = new Set(["h2hMostRecentMeetingWinnerProviderId"]);

/** Team-identity fields available only to the clearly-separated identity experiment (section 5) — never the primary model. */
export const TEAM_IDENTITY_FIELDS: readonly string[] = ["teamAProviderId", "teamBProviderId"];

export type FieldKind = "numeric" | "boolean" | "categorical";

export interface FeaturePolicy {
  readonly numericFields: readonly string[];
  readonly booleanFields: readonly string[];
  readonly categoricalFields: readonly string[];
  readonly excludedFields: readonly string[];
  readonly allInputFields: readonly string[];
}

/** Builds the feature policy from the machine-readable catalog — the single source of truth for column semantics. */
export function buildFeaturePolicy(catalog: readonly FeatureFieldMeta[]): FeaturePolicy {
  const numericFields: string[] = [];
  const booleanFields: string[] = [];
  const categoricalFields: string[] = [];
  const excludedFields: string[] = [];

  for (const field of catalog) {
    if (field.type === "identifier" || field.type === "label" || field.type === "version") {
      excludedFields.push(field.name);
      continue;
    }
    if (HIGH_RISK_EXCLUDED_FIELDS.has(field.name)) {
      excludedFields.push(field.name);
      continue;
    }
    if (field.type === "numeric" || field.type === "integer") numericFields.push(field.name);
    else if (field.type === "boolean") booleanFields.push(field.name);
    else if (field.type === "categorical") categoricalFields.push(field.name);
  }

  numericFields.sort();
  booleanFields.sort();
  categoricalFields.sort();

  return {
    numericFields,
    booleanFields,
    categoricalFields,
    excludedFields: [...excludedFields].sort(),
    allInputFields: [...numericFields, ...booleanFields, ...categoricalFields].sort(),
  };
}

/** Reads a single field's raw value off a row, typed loosely since callers immediately dispatch on `FieldKind`. */
export function readRawField(row: FeatureRow, field: string): string | number | boolean | null {
  return (row as unknown as Record<string, string | number | boolean | null>)[field] ?? null;
}

/** True when `field` is a numeric field whose value is `null` on at least one row (used to decide which fields need imputation + a missing-indicator column). */
export function isValueMissing(value: string | number | boolean | null): value is null {
  return value === null;
}
