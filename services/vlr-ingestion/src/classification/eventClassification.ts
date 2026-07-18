import type { ClassificationEvidence, EventClassification, EventClassificationResult } from "./eventFamily";
import type { EventClassificationOverride } from "./eventOverrides";

/**
 * Deterministic event classifier — see docs/29-vlr-data-ingestion-foundation.md
 * ("Event Discovery and Classification") and TASK-041 requirement 4.
 *
 * Evidence is consulted in strict priority order and the classifier stops
 * at the first tier that produces a confident answer:
 *
 *   1. override registry (authoritative — a human or a verified provider-ID
 *      mapping already resolved this exact event)
 *   2. structured metadata (parentSeries / region / stage / tags — the
 *      normalized fields a real page parse would populate)
 *   3. event name pattern (diagnostic/provisional only — always confidence
 *      "low")
 *   4. unknown (insufficient evidence)
 *
 * This function never fabricates an event ID and never guesses a family
 * from name alone without flagging it — see requirement 4:
 * "name-only classification must produce an explicit confidence level or
 * warning" and "unknown events must never silently enter the approved
 * dataset."
 */
export interface ClassifiableEventInput {
  readonly providerEventId: string;
  readonly name: string;
  readonly parentSeries?: string;
  readonly region?: string;
  readonly season?: string;
  readonly stage?: string;
  readonly tags?: readonly string[];
}

const EXCLUDED_NAME_PATTERNS: readonly { pattern: RegExp; classification: EventClassification }[] = [
  { pattern: /game[\s-]?changers/i, classification: "excluded-game-changers" },
  { pattern: /show ?match/i, classification: "excluded-showmatch" },
  { pattern: /qualifier/i, classification: "excluded-qualifier" },
  { pattern: /\btier[\s-]?2\b/i, classification: "excluded-tier-2" },
];

const APPROVED_NAME_PATTERNS: readonly { pattern: RegExp; classification: EventClassification }[] = [
  { pattern: /champions tour.*americas|vct\s*americas/i, classification: "vct-americas" },
  { pattern: /champions tour.*emea|vct\s*emea/i, classification: "vct-emea" },
  { pattern: /champions tour.*pacific|vct\s*pacific/i, classification: "vct-pacific" },
  { pattern: /champions tour.*china|vct\s*china/i, classification: "vct-china" },
  { pattern: /masters/i, classification: "masters" },
  { pattern: /champions(?!\s*tour)/i, classification: "champions" },
];

const EXCLUDED_TAGS: ReadonlyMap<string, EventClassification> = new Map([
  ["game-changers", "excluded-game-changers"],
  ["showmatch", "excluded-showmatch"],
  ["qualifier", "excluded-qualifier"],
  ["tier-2", "excluded-tier-2"],
]);

const REGION_TO_VCT_FAMILY: ReadonlyMap<string, EventClassification> = new Map([
  ["americas", "vct-americas"],
  ["emea", "vct-emea"],
  ["pacific", "vct-pacific"],
  ["china", "vct-china"],
]);

function classifyFromOverride(input: ClassifiableEventInput, overrides: ReadonlyMap<string, EventClassificationOverride>): EventClassificationResult | null {
  const override = overrides.get(input.providerEventId);
  if (!override) return null;
  return {
    classification: override.classification,
    confidence: "authoritative",
    reason: `Provider event ID "${input.providerEventId}" is mapped by the override registry: ${override.reason}`,
    evidence: [{ source: "override-registry", detail: `providerEventId=${input.providerEventId} -> ${override.classification}` }],
  };
}

function classifyFromStructuredMetadata(input: ClassifiableEventInput): EventClassificationResult | null {
  const evidence: ClassificationEvidence[] = [];

  if (input.tags) {
    for (const tag of input.tags) {
      const excluded = EXCLUDED_TAGS.get(tag.toLowerCase());
      if (excluded) {
        evidence.push({ source: "structured-metadata", detail: `tag="${tag}"` });
        return { classification: excluded, confidence: "high", reason: `Event tag "${tag}" is an excluded category.`, evidence };
      }
    }
  }

  const parentSeries = input.parentSeries?.toLowerCase() ?? "";
  const region = input.region?.toLowerCase() ?? "";

  if (/masters/.test(parentSeries)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` });
    return { classification: "masters", confidence: "high", reason: "Parent series metadata identifies this as a Masters event.", evidence };
  }
  if (/champions/.test(parentSeries) && !/champions tour/.test(parentSeries)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` });
    return { classification: "champions", confidence: "high", reason: "Parent series metadata identifies this as a Champions event.", evidence };
  }
  if (/champions tour|vct/.test(parentSeries) && region) {
    const family = REGION_TO_VCT_FAMILY.get(region);
    if (family) {
      evidence.push(
        { source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` },
        { source: "structured-metadata", detail: `region="${input.region}"` },
      );
      return { classification: family, confidence: "high", reason: `Parent series and region metadata identify this as ${family}.`, evidence };
    }
  }

  return null;
}

function classifyFromNamePattern(input: ClassifiableEventInput): EventClassificationResult | null {
  for (const { pattern, classification } of EXCLUDED_NAME_PATTERNS) {
    if (pattern.test(input.name)) {
      return {
        classification,
        confidence: "low",
        reason: `Event name "${input.name}" matches the ${classification} name pattern (provisional — name-only match).`,
        evidence: [{ source: "name-pattern", detail: pattern.source }],
      };
    }
  }
  for (const { pattern, classification } of APPROVED_NAME_PATTERNS) {
    if (pattern.test(input.name)) {
      return {
        classification,
        confidence: "low",
        reason: `Event name "${input.name}" matches the ${classification} name pattern (provisional — name-only match, not structured metadata).`,
        evidence: [{ source: "name-pattern", detail: pattern.source }],
      };
    }
  }
  return null;
}

/**
 * Classifies a single event. Never throws — an event that cannot be
 * classified confidently returns `"unknown"` with `confidence: "low"`
 * rather than guessing.
 */
export function classifyEvent(
  input: ClassifiableEventInput,
  overrides: ReadonlyMap<string, EventClassificationOverride> = new Map(),
): EventClassificationResult {
  return (
    classifyFromOverride(input, overrides) ??
    classifyFromStructuredMetadata(input) ??
    classifyFromNamePattern(input) ?? {
      classification: "unknown",
      confidence: "low",
      reason: `No override, structured metadata, or name pattern produced a classification for "${input.name}".`,
      evidence: [{ source: "insufficient-evidence", detail: "no matching rule" }],
    }
  );
}
