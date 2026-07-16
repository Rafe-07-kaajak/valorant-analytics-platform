import { VCT_REGION_LOGOS, VCT_TEAM_LOGOS } from "./vctLogos";
import type { VctRegion, VctRegionId, VctTeam } from "./vctDirectory";

export interface VctDirectoryValidationIssue {
  code: string;
  message: string;
}

const VCT_REGION_IDS: readonly VctRegionId[] = ["americas", "emea", "pacific", "china"];
const TEAMS_PER_REGION = 8;
const TOTAL_TEAMS = 32;

function isAbsoluteWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.includes("\\");
}

/**
 * Validates the canonical VCT region/team directory: region and team
 * counts, uniqueness of IDs and short names, valid region references in
 * both directions, logo paths that trace back to the TASK-029 manifest,
 * no absolute Windows paths, and no missing display or short names.
 */
export function validateVctDirectory(
  regions: readonly VctRegion[],
  teams: readonly VctTeam[],
): VctDirectoryValidationIssue[] {
  const issues: VctDirectoryValidationIssue[] = [];

  const validRegionLogoPaths = new Set<string>(Object.values(VCT_REGION_LOGOS).map((asset) => asset.logoPath));
  const validTeamLogoPaths = new Set<string>(VCT_TEAM_LOGOS.map((asset) => asset.logoPath));

  if (regions.length !== VCT_REGION_IDS.length) {
    issues.push({
      code: "region-count-mismatch",
      message: `Expected ${VCT_REGION_IDS.length} regions, found ${regions.length}.`,
    });
  }

  if (teams.length !== TOTAL_TEAMS) {
    issues.push({ code: "team-count-mismatch", message: `Expected ${TOTAL_TEAMS} teams, found ${teams.length}.` });
  }

  const seenRegionIds = new Set<string>();
  for (const region of regions) {
    if (seenRegionIds.has(region.id)) {
      issues.push({ code: "duplicate-region-id", message: `Duplicate region id: "${region.id}".` });
    }
    seenRegionIds.add(region.id);

    if (!VCT_REGION_IDS.includes(region.id)) {
      issues.push({ code: "invalid-region-id", message: `Unknown region id: "${region.id}".` });
    }
    if (!region.name) {
      issues.push({ code: "missing-name", message: `Region "${region.id}" is missing a display name.` });
    }
    if (!region.shortName) {
      issues.push({ code: "missing-short-name", message: `Region "${region.id}" is missing a short name.` });
    }
    if (isAbsoluteWindowsPath(region.logoPath)) {
      issues.push({ code: "absolute-path", message: `Region logo path is an absolute path: ${region.logoPath}` });
    }
    if (!validRegionLogoPaths.has(region.logoPath)) {
      issues.push({
        code: "unmanifested-logo-path",
        message: `Region "${region.id}" logo path is not registered in the TASK-029 manifest: ${region.logoPath}`,
      });
    }

    const teamsInRegion = teams.filter((team) => team.region === region.id).map((team) => team.id);
    if (teamsInRegion.length !== TEAMS_PER_REGION) {
      issues.push({
        code: "team-per-region-mismatch",
        message: `Region "${region.id}" has ${teamsInRegion.length} teams, expected ${TEAMS_PER_REGION}.`,
      });
    }

    const regionTeamIdSet = new Set(region.teamIds);
    const actualTeamIdSet = new Set(teamsInRegion);
    const symmetricDifference = [
      ...[...regionTeamIdSet].filter((id) => !actualTeamIdSet.has(id)),
      ...[...actualTeamIdSet].filter((id) => !regionTeamIdSet.has(id)),
    ];
    if (symmetricDifference.length > 0) {
      issues.push({
        code: "region-team-id-mismatch",
        message: `Region "${region.id}" teamIds do not exactly match its teams: ${symmetricDifference.join(", ")}.`,
      });
    }
  }

  const seenTeamIds = new Set<string>();
  const seenShortNames = new Set<string>();
  for (const team of teams) {
    if (seenTeamIds.has(team.id)) {
      issues.push({ code: "duplicate-team-id", message: `Duplicate team id: "${team.id}".` });
    }
    seenTeamIds.add(team.id);

    if (seenShortNames.has(team.shortName)) {
      issues.push({ code: "duplicate-short-name", message: `Duplicate team short name: "${team.shortName}".` });
    }
    seenShortNames.add(team.shortName);

    if (!VCT_REGION_IDS.includes(team.region)) {
      issues.push({
        code: "invalid-region",
        message: `Team "${team.id}" references unknown region "${team.region}".`,
      });
    }
    if (!team.name) {
      issues.push({ code: "missing-name", message: `Team "${team.id}" is missing a display name.` });
    }
    if (!team.shortName) {
      issues.push({ code: "missing-short-name", message: `Team "${team.id}" is missing a short name.` });
    }
    if (isAbsoluteWindowsPath(team.logoPath)) {
      issues.push({ code: "absolute-path", message: `Team logo path is an absolute path: ${team.logoPath}` });
    }
    if (!validTeamLogoPaths.has(team.logoPath)) {
      issues.push({
        code: "unmanifested-logo-path",
        message: `Team "${team.id}" logo path is not registered in the TASK-029 manifest: ${team.logoPath}`,
      });
    }
  }

  return issues;
}
