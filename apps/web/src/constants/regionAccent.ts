import type { VctRegionId } from "./vct";

/**
 * TASK-055 — resolves a VCT region to its identity color tokens
 * (tokens.css `--region-*` / `--region-*-alt`, already defined by TASK-050
 * but not yet consumed by any component). Single source of truth so
 * RegionCard, TeamCard, and the match context core never hardcode a
 * region-to-color mapping independently.
 */
export function getRegionAccentVar(regionId: VctRegionId): string {
  return `var(--region-${regionId})`;
}

export function getRegionAccentAltVar(regionId: VctRegionId): string {
  return `var(--region-${regionId}-alt)`;
}
