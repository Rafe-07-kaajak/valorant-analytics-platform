import type { RegionLogoAsset, TeamLogoAsset, VctRegionId } from "./vctLogos";

export interface VctLogoValidationIssue {
  code: string;
  message: string;
}

const VCT_REGION_IDS: readonly VctRegionId[] = ["americas", "emea", "pacific", "china"];

function isAbsoluteWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.includes("\\");
}

/**
 * Validates the VCT logo manifest's internal consistency: unique IDs and
 * paths, valid region references, exactly one region logo per accepted
 * region, no accidental absolute Windows paths, and that every path
 * resolves to a real asset on disk (via the injected `assetExists` check,
 * so this stays testable without touching the filesystem directly).
 */
export function validateVctLogoManifest(
  regionLogos: Record<VctRegionId, RegionLogoAsset>,
  teamLogos: readonly TeamLogoAsset[],
  assetExists: (logoPath: string) => boolean,
): VctLogoValidationIssue[] {
  const issues: VctLogoValidationIssue[] = [];

  for (const regionId of VCT_REGION_IDS) {
    const region = regionLogos[regionId];
    if (!region) {
      issues.push({ code: "missing-region-logo", message: `No region logo registered for "${regionId}".` });
      continue;
    }
    if (region.id !== regionId) {
      issues.push({
        code: "region-id-mismatch",
        message: `Region logo keyed as "${regionId}" has id "${region.id}".`,
      });
    }
    if (isAbsoluteWindowsPath(region.logoPath)) {
      issues.push({ code: "absolute-path", message: `Region logo path is an absolute path: ${region.logoPath}` });
    }
    if (!assetExists(region.logoPath)) {
      issues.push({ code: "missing-asset-file", message: `Region logo asset not found on disk: ${region.logoPath}` });
    }
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const team of teamLogos) {
    if (seenIds.has(team.id)) {
      issues.push({ code: "duplicate-id", message: `Duplicate team id: "${team.id}".` });
    }
    seenIds.add(team.id);

    if (seenPaths.has(team.logoPath)) {
      issues.push({ code: "duplicate-path", message: `Duplicate team logo path: "${team.logoPath}".` });
    }
    seenPaths.add(team.logoPath);

    if (!VCT_REGION_IDS.includes(team.region)) {
      issues.push({
        code: "invalid-region",
        message: `Team "${team.id}" references unknown region "${team.region}".`,
      });
    }

    if (isAbsoluteWindowsPath(team.logoPath)) {
      issues.push({ code: "absolute-path", message: `Team logo path is an absolute path: ${team.logoPath}` });
    }

    if (!assetExists(team.logoPath)) {
      issues.push({ code: "missing-asset-file", message: `Team logo asset not found on disk: ${team.logoPath}` });
    }
  }

  return issues;
}
