import { EMPTY_CANONICAL_URL_STATE, type CanonicalFieldKey, type CanonicalUrlState } from "./types";

/** On-the-wire parameter names and their canonical order — always emitted in this order, regardless of the order fields were set in. */
export const CANONICAL_FIELD_ORDER: readonly CanonicalFieldKey[] = [
  "regionA",
  "teamA",
  "regionB",
  "teamB",
  "maps",
  "format",
  "mode",
];

/** Projects a full canonical state down to only the fields a given route understands — the "merge existing state with a navigation target" step used by both href generation and the URL-sync hook. */
export function pickCanonicalFields(
  state: CanonicalUrlState,
  fields: readonly CanonicalFieldKey[],
): Partial<CanonicalUrlState> {
  const picked: Partial<CanonicalUrlState> = {};
  for (const key of fields) {
    if (key === "maps") {
      picked.maps = state.maps;
    } else {
      picked[key] = state[key] as never;
    }
  }
  return picked;
}

/** Same projection as `pickCanonicalFields`, but returned as a full `CanonicalUrlState` (fields the destination doesn't own are reset to empty) — the "merge existing state with a navigation target" step: given the source feature's current state, this is exactly what the destination feature would see. */
export function projectCanonicalState(
  state: CanonicalUrlState,
  fields: readonly CanonicalFieldKey[],
): CanonicalUrlState {
  return { ...EMPTY_CANONICAL_URL_STATE, ...pickCanonicalFields(state, fields) };
}

/**
 * Serializes only the requested fields, in canonical order, omitting empty
 * or absent values (no `regionA=` when there's no region, no `maps=` when
 * the pool is empty). Never produces raw JSON — every value is a plain id
 * string or a comma-separated list of ids.
 */
export function serializeUrlState(state: CanonicalUrlState, fields: readonly CanonicalFieldKey[]): string {
  const fieldSet = new Set(fields);
  const params = new URLSearchParams();

  for (const key of CANONICAL_FIELD_ORDER) {
    if (!fieldSet.has(key)) continue;

    if (key === "maps") {
      if (state.maps.length > 0) params.set("maps", state.maps.join(","));
      continue;
    }

    const value = state[key];
    if (value) params.set(key, value);
  }

  return params.toString();
}

/** Adapts a Next.js server page's `searchParams` (a plain object whose values may be a string, a string array from a repeated key, or absent) into a `URLSearchParams` instance, so the same `parseUrlState` runs identically on the server and in the client-side sync hook. */
export function toUrlSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return params;
}
