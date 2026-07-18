/**
 * Deterministic identity policy — see docs/29-vlr-data-ingestion-foundation.md
 * ("Deterministic IDs") and TASK-041 requirement 9.
 *
 * Provider source identity always takes the form `vlr:<entity-type>:<external-id>`.
 * This string is stable, human-readable, requires no randomness, and is used
 * directly as the internal ID for any entity that has no verified mapping
 * into an existing platform identity (e.g. an unmapped team). No random UUID
 * is ever required for entity identity.
 */

export type VlrEntityType = "team" | "player" | "event" | "match";

/**
 * Builds the canonical provider source reference for a VLR entity. Throws
 * neither — callers are expected to have already validated `externalId`
 * (see `identity/idValidation` usage in the CLI layer).
 */
export function buildVlrSourceReference(entityType: VlrEntityType, externalId: string): string {
  return `vlr:${entityType}:${externalId}`;
}

const SOURCE_REFERENCE_PATTERN = /^vlr:(team|player|event|match):(.+)$/;

export interface ParsedSourceReference {
  readonly provider: "vlr";
  readonly entityType: VlrEntityType;
  readonly externalId: string;
}

/** Parses a `vlr:<type>:<id>` reference back into its parts, or returns null if malformed. */
export function parseVlrSourceReference(reference: string): ParsedSourceReference | null {
  const match = SOURCE_REFERENCE_PATTERN.exec(reference);
  if (!match) return null;
  const [, entityType, externalId] = match;
  return { provider: "vlr", entityType: entityType as VlrEntityType, externalId };
}

/**
 * The internal ID for an entity that has no verified platform mapping is
 * its own source reference — stable, deterministic, and traceable back to
 * the provider without requiring a separate ID allocation scheme.
 */
export function deterministicInternalId(entityType: VlrEntityType, externalId: string): string {
  return buildVlrSourceReference(entityType, externalId);
}
