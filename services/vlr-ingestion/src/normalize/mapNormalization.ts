/**
 * Map name normalization — see docs/29-vlr-data-ingestion-foundation.md
 * ("Series and Map Normalization") and TASK-041 requirement 17. Known
 * aliases are harmless capitalization/spacing variants only; an unrecognized
 * map name is never silently remapped to a different map — it is preserved
 * verbatim and flagged.
 */
export interface NormalizedMapName {
  readonly name: string;
  readonly raw: string;
  readonly recognized: boolean;
}

const KNOWN_MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset", "Abyss", "Corrode"] as const;

const ALIAS_LOOKUP: ReadonlyMap<string, string> = new Map(KNOWN_MAPS.map((map) => [map.toLowerCase(), map]));

export function normalizeMapName(raw: string): NormalizedMapName {
  const trimmed = raw.trim();
  const canonical = ALIAS_LOOKUP.get(trimmed.toLowerCase());
  return canonical ? { name: canonical, raw: trimmed, recognized: true } : { name: trimmed, raw: trimmed, recognized: false };
}
