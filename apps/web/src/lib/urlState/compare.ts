import type { CanonicalUrlState } from "./types";

/** Structural equality (not reference equality) — used by the URL-sync hook to skip a redundant `setState`/`router.replace` when a reparse produces an equivalent-but-new object, which is what prevents state↔URL sync loops. */
export function canonicalStatesEqual(a: CanonicalUrlState, b: CanonicalUrlState): boolean {
  return (
    a.regionA === b.regionA &&
    a.teamA === b.teamA &&
    a.regionB === b.regionB &&
    a.teamB === b.teamB &&
    a.format === b.format &&
    a.maps.length === b.maps.length &&
    a.maps.every((id, index) => id === b.maps[index])
  );
}
