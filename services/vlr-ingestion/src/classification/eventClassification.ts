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
  // "Challengers"/"VCL" (Valorant Challengers League) are VLR's real names
  // for the tier-2 regional feeder circuit — live markup never literally
  // says "tier 2" (TASK-042 live-markup verification), so the original
  // "\btier[\s-]?2\b" pattern alone never matched a single real event.
  { pattern: /\btier[\s-]?2\b/i, classification: "excluded-tier-2" },
  { pattern: /\bchallengers\b/i, classification: "excluded-tier-2" },
  { pattern: /\bvcl\b/i, classification: "excluded-tier-2" },
];

/**
 * Cheap, request-free pre-filter for live discovery (TASK-042): a listing
 * entry whose name alone unambiguously matches an excluded category can be
 * skipped before ever fetching its detail page. This is deliberately a
 * *skip* signal only — it never marks an event included, and a name that
 * matches nothing here still gets fetched and goes through the full
 * `classifyEvent` evidence chain, so an approved event is never at risk of
 * being dropped by this shortcut.
 */
export function matchesExcludedNamePattern(name: string): boolean {
  return EXCLUDED_NAME_PATTERNS.some(({ pattern }) => pattern.test(name));
}

const APPROVED_NAME_PATTERNS: readonly { pattern: RegExp; classification: EventClassification }[] = [
  { pattern: /champions tour.*americas|vct\s*americas/i, classification: "vct-americas" },
  { pattern: /champions tour.*emea|vct\s*emea/i, classification: "vct-emea" },
  { pattern: /champions tour.*pacific|vct\s*pacific/i, classification: "vct-pacific" },
  { pattern: /champions tour.*china|vct\s*china/i, classification: "vct-china" },
  // Requires "valorant masters" as a phrase, not a bare "masters" substring
  // — real live discovery (TASK-042) turned up "FunPay Clutch Masters",
  // "POP Esports Masters Season 6", and "Shanghai Esports Masters" (a
  // different, unofficial event from the real "Champions Tour 2024: Masters
  // Shanghai"), none of which are the official VCT stop. Every genuine
  // Masters event this scope has seen is literally titled
  // "Valorant Masters <City> <Year>" (the two 2026 events additionally
  // resolve via the higher-confidence structured-metadata stage tag above,
  // so this fallback only needs to cover the events whose breadcrumb didn't
  // carry that tag — e.g. the 2025 events).
  { pattern: /\bvalorant\s+masters\b/i, classification: "masters" },
  // Requires "valorant champions" as a phrase, not a bare "champions"
  // substring — real live discovery (TASK-042) turned up multiple unrelated
  // events an unqualified "champions" pattern would have wrongly swept in:
  // "HUTECH Esports Championship" and "College VALORANT Championship 2026"
  // (both simply contain "champions" inside "Championship" — a word-boundary
  // bug) and, more subtly, "ESSL Champions Cup 2026" (a real standalone
  // "Champions" word, just not *this* tournament). The official event is
  // always titled "Valorant Champions <year>"; nothing else earns a
  // low-confidence name-only "champions" guess. A genuine Champions event
  // that somehow lacks "Valorant" in its title still classifies correctly
  // through the higher-confidence structured-metadata tier above (parent
  // series + no stage tag), which does not depend on this pattern at all.
  { pattern: /\bvalorant\s+champions\b(?!\s*tour)/i, classification: "champions" },
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
  const stage = input.stage?.toLowerCase() ?? "";
  const name = input.name.toLowerCase();

  // Tier-2/qualifier/community sub-events (Challengers, VCL, qualifiers) are
  // real VLR events that can still breadcrumb under "Valorant Champions
  // Tour <year>" with a region tag (TASK-042 live-markup verification) —
  // exactly the same structural shape the VCT-region rule below matches on.
  // Excluding by name here, before that rule runs, stops a tier-2 event
  // from being promoted to an approved family just because it shares the
  // VCT breadcrumb; this is deliberately evaluated ahead of the ordinary
  // name-pattern tier so structured evidence can never override it.
  const excludedByName = EXCLUDED_NAME_PATTERNS.find(({ pattern }) => pattern.test(input.name));
  if (excludedByName && /champions tour|vct/.test(parentSeries)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` }, { source: "name-pattern", detail: excludedByName.pattern.source });
    return {
      classification: excludedByName.classification,
      confidence: "high",
      reason: `Event name "${input.name}" matches the ${excludedByName.classification} pattern, corroborated by the VCT-tour breadcrumb it is nested under.`,
      evidence,
    };
  }

  if (/masters/.test(parentSeries)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` });
    return { classification: "masters", confidence: "high", reason: "Parent series metadata identifies this as a Masters event.", evidence };
  }
  // Real VLR markup: Masters events carry a breadcrumb stage tag whose text
  // is literally "Masters" (parentSeries is just "Valorant Champions Tour
  // <year>", the same as every VCT event) — TASK-042 live-markup
  // verification. This is *stronger* evidence than a name-pattern match.
  if (/masters/.test(stage)) {
    evidence.push({ source: "structured-metadata", detail: `stage="${input.stage}"` });
    return { classification: "masters", confidence: "high", reason: "Breadcrumb stage metadata identifies this as a Masters event.", evidence };
  }
  if (/champions/.test(parentSeries) && !/champions tour/.test(parentSeries)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` });
    return { classification: "champions", confidence: "high", reason: "Parent series metadata identifies this as a Champions event.", evidence };
  }
  // Real VLR markup: Champions carries no breadcrumb stage tag at all (only
  // region tags for every participating region) and parentSeries is again
  // just "Valorant Champions Tour <year>" — distinguished from a regular
  // VCT league stage only by the absent stage tag plus the event's own
  // title actually saying "Champions" (not "Champions Tour").
  if (/champions tour|vct/.test(parentSeries) && !input.stage && /\bvalorant\s+champions\b(?!\s*tour)/.test(name)) {
    evidence.push({ source: "structured-metadata", detail: `parentSeries="${input.parentSeries}"` }, { source: "structured-metadata", detail: "no stage tag present" });
    return { classification: "champions", confidence: "high", reason: "Parent series metadata (no stage tag) and event title identify this as Champions.", evidence };
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
