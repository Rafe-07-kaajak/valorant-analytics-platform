import { createHash } from "node:crypto";

/**
 * Deterministic content hashing — see docs/29-vlr-data-ingestion-foundation.md
 * ("Content Hashing and Idempotency") and TASK-041 requirement 21.
 *
 * Hashes are computed over a stable JSON serialization (sorted object keys)
 * so that key order never changes the hash, and deliberately exclude
 * volatile local metadata (`fetchedAt`, `parsedAt`) — two fetches of
 * unchanged content must hash identically so the ingestion coordinator can
 * skip reprocessing it.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeysDeep(val)]));
  }
  return value;
}

export function contentHash(value: unknown): string {
  const canonical = JSON.stringify(sortKeysDeep(value));
  return createHash("sha256").update(canonical).digest("hex");
}

/** Strips fields that vary between otherwise-identical fetches, so hashing reflects content only. */
export function stripVolatileFields<T extends Record<string, unknown>>(value: T, volatileKeys: readonly string[]): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...value };
  for (const key of volatileKeys) delete clone[key];
  return clone;
}
