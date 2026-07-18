/**
 * Event classification taxonomy — see docs/29-vlr-data-ingestion-foundation.md
 * ("Event Discovery and Classification") and TASK-041 requirement 4. This is
 * the provider-neutral vocabulary the scope model, classifier, and
 * training-eligibility evaluator all share.
 */

/** Approved dataset families. Nothing outside this list is training-eligible. */
export const APPROVED_EVENT_FAMILIES = ["vct-americas", "vct-emea", "vct-pacific", "vct-china", "masters", "champions"] as const;
export type ApprovedEventFamily = (typeof APPROVED_EVENT_FAMILIES)[number];

export const EXCLUDED_EVENT_CATEGORIES = [
  "excluded-tier-2",
  "excluded-qualifier",
  "excluded-game-changers",
  "excluded-showmatch",
  "excluded-unrelated",
] as const;
export type ExcludedEventCategory = (typeof EXCLUDED_EVENT_CATEGORIES)[number];

export type EventClassification = ApprovedEventFamily | ExcludedEventCategory | "unknown";

export const ALL_EVENT_CLASSIFICATIONS = [...APPROVED_EVENT_FAMILIES, ...EXCLUDED_EVENT_CATEGORIES, "unknown"] as const;

export function isApprovedEventFamily(value: EventClassification): value is ApprovedEventFamily {
  return (APPROVED_EVENT_FAMILIES as readonly string[]).includes(value);
}

/** Confidence describes how strongly the available evidence supports the classification. */
export type ClassificationConfidence = "authoritative" | "high" | "low";

export type ClassificationSource = "override-registry" | "provider-id-mapping" | "structured-metadata" | "name-pattern" | "insufficient-evidence";

export interface ClassificationEvidence {
  readonly source: ClassificationSource;
  readonly detail: string;
}

export interface EventClassificationResult {
  readonly classification: EventClassification;
  readonly confidence: ClassificationConfidence;
  readonly reason: string;
  readonly evidence: readonly ClassificationEvidence[];
}
