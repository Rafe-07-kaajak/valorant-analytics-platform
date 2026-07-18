import type { VctTeamId } from "@repo/prediction-engine";

/**
 * Team alias registry — TASK-043 requirement 5. Distinct from
 * `VlrTeamMappingEntry.aliases` (which is a diagnostic list embedded per
 * mapping entry): this is a standalone registry so alias *collisions*
 * across different canonical teams can be detected independently of
 * whether either team has a verified VLR-ID mapping yet. An alias is
 * always scoped to exactly one canonical team; two entries assigning the
 * same normalized alias text to different canonical teams is a collision
 * that must be surfaced, never silently resolved (requirement 5: "fuzzy
 * name matching must never create verified mappings automatically").
 */
export type TeamAliasType = "display-name" | "former-name" | "abbreviation" | "slug" | "sponsor-name-variant" | "transliteration" | "case-punctuation-variant";

export interface TeamAlias {
  readonly canonicalTeamId: VctTeamId;
  readonly alias: string;
  readonly aliasType: TeamAliasType;
  readonly sourceUrl?: string;
  readonly observedAt?: string;
  readonly notes?: string;
  /** True once the alias no longer reflects a currently-used name — retained for historical reconciliation, never deleted. */
  readonly deprecated?: boolean;
}

export interface TeamAliasCollision {
  readonly normalizedAlias: string;
  readonly conflicting: readonly TeamAlias[];
}

export interface TeamAliasValidationResult {
  readonly valid: boolean;
  readonly collisions: readonly TeamAliasCollision[];
  readonly invalidEntries: readonly { entry: TeamAlias; reasons: readonly string[] }[];
}

/** Case/punctuation-insensitive normalization for diagnostic comparison only — never used to auto-resolve an identity. */
export function normalizeAliasText(alias: string): string {
  return alias
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (e.g. "KRÜ" -> "kru")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validateEntry(entry: TeamAlias): string[] {
  const reasons: string[] = [];
  if (!entry.alias || entry.alias.trim().length === 0) reasons.push("alias must be a non-empty string.");
  if (!entry.canonicalTeamId) reasons.push("canonicalTeamId is required.");
  return reasons;
}

/**
 * Validates a full alias registry: every entry individually, plus
 * cross-entry collisions where the same normalized alias text is assigned
 * to more than one distinct canonical team. A collision never auto-resolves
 * — it is reported for human review (requirement 5).
 */
export function validateTeamAliasRegistry(entries: readonly TeamAlias[]): TeamAliasValidationResult {
  const invalidEntries: { entry: TeamAlias; reasons: readonly string[] }[] = [];
  for (const entry of entries) {
    const reasons = validateEntry(entry);
    if (reasons.length > 0) invalidEntries.push({ entry, reasons });
  }

  const byNormalizedAlias = new Map<string, TeamAlias[]>();
  for (const entry of entries) {
    const key = normalizeAliasText(entry.alias);
    const bucket = byNormalizedAlias.get(key);
    if (bucket) bucket.push(entry);
    else byNormalizedAlias.set(key, [entry]);
  }

  const collisions: TeamAliasCollision[] = [];
  for (const [normalizedAlias, group] of byNormalizedAlias) {
    const distinctTeams = new Set(group.map((entry) => entry.canonicalTeamId));
    if (distinctTeams.size > 1) collisions.push({ normalizedAlias, conflicting: group });
  }

  return { valid: invalidEntries.length === 0 && collisions.length === 0, collisions, invalidEntries };
}

/** Suggests canonical teams whose alias registry entries match `displayName` (active or deprecated) — diagnostic only, never authoritative. */
export function findCanonicalTeamsForAlias(displayName: string, entries: readonly TeamAlias[]): readonly TeamAlias[] {
  const normalized = normalizeAliasText(displayName);
  return entries.filter((entry) => normalizeAliasText(entry.alias) === normalized);
}

/**
 * Initial alias registry. `KRÜ Esports` is the one diacritic/transliteration
 * variant already documented in `teamMapping.ts`'s verified-mapping reason
 * strings (TASK-042); every other alias remains to be captured the same way
 * — from an actually-observed source, never guessed — as future mapping
 * work discovers real display-name variants.
 */
export const INITIAL_TEAM_ALIAS_REGISTRY: readonly TeamAlias[] = [
  { canonicalTeamId: "kru-esports", alias: "KRÜ Esports", aliasType: "display-name", sourceUrl: "https://www.vlr.gg/team/2355/kr-esports", observedAt: "2026-07-18" },
  { canonicalTeamId: "kru-esports", alias: "KRU Esports", aliasType: "transliteration", notes: "ASCII transliteration of the diacritic 'Ü'." },
];
