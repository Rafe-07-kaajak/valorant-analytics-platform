/**
 * A pathological `maps=` value (thousands of comma-separated tokens) is
 * capped before any per-token work happens, regardless of how many turn out
 * to be valid — this bounds parsing cost independent of validation.
 */
export const MAX_RAW_MAP_TOKENS = 64;

/**
 * Canonical order = the order `validMapIds` was built in (callers derive it
 * from `@repo/prediction-engine`'s `maps` list), not click order or
 * alphabetical order — this is what makes serialization deterministic
 * regardless of how a user selected maps.
 */
export function sortMapIdsCanonically(mapIds: readonly string[], validMapIds: ReadonlySet<string>): string[] {
  const requested = new Set(mapIds);
  return Array.from(validMapIds).filter((id) => requested.has(id));
}

/** Parses a comma-separated `maps=` value into a deduplicated, validated, canonically ordered list. Invalid or unrecognized ids are silently dropped; an absent or empty value is a valid "zero maps" result. */
export function parseMapIdsParam(raw: string | null, validMapIds: ReadonlySet<string>): string[] {
  if (!raw) return [];

  const tokens = raw
    .split(",")
    .slice(0, MAX_RAW_MAP_TOKENS)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0 && token.length <= 40);

  return sortMapIdsCanonically(tokens, validMapIds);
}
