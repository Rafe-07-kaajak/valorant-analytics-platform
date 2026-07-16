import { maps } from "../data/maps";
import { VCT_TEAM_IDENTITIES } from "../data/vctTeams";
import { DNA_DIMENSIONS } from "./teamDna";
import { generateVctTeamProfiles, VCT_PROFILE_DISCLOSURE, type VctTeamProfile } from "./vctTeamProfiles";

export interface VctTeamProfileValidationIssue {
  code: string;
  message: string;
}

const EXPECTED_TEAM_IDS = new Set(VCT_TEAM_IDENTITIES.map((identity) => identity.id));
const EXPECTED_TEAM_COUNT = 32;
const KNOWN_MAP_IDS = new Set(maps.map((map) => map.id));
const KNOWN_DNA_KEYS = new Set(DNA_DIMENSIONS.map((dimension) => dimension.key));

const PERCENT_FIELDS: readonly (keyof VctTeamProfile)[] = [
  "overallRating",
  "attackStrength",
  "defenseStrength",
  "economyEfficiency",
  "clutchPerformance",
  "consistency",
  "mapControl",
  "recentFormIndex",
];

const BANNED_DISCLOSURE_SUBSTRINGS = ["official riot", "verified by riot", "confirmed tournament record"];

function isAbsoluteWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.includes("\\");
}

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Validates the TASK-031 synthetic profile layer: exact coverage of the
 * TASK-030-aligned 32-team roster, full map coverage, numeric bounds,
 * finiteness, DNA validity, and that no absolute filesystem path or
 * official-data claim has leaked into profile metadata or the disclosure
 * text.
 */
export function validateVctTeamProfiles(profiles: readonly VctTeamProfile[]): VctTeamProfileValidationIssue[] {
  const issues: VctTeamProfileValidationIssue[] = [];

  if (profiles.length !== EXPECTED_TEAM_COUNT) {
    issues.push({
      code: "profile-count-mismatch",
      message: `Expected ${EXPECTED_TEAM_COUNT} profiles, found ${profiles.length}.`,
    });
  }

  const seenTeamIds = new Set<string>();
  for (const profile of profiles) {
    if (seenTeamIds.has(profile.teamId)) {
      issues.push({ code: "duplicate-team-id", message: `Duplicate profile team id: "${profile.teamId}".` });
    }
    seenTeamIds.add(profile.teamId);

    if (!EXPECTED_TEAM_IDS.has(profile.teamId)) {
      issues.push({ code: "unknown-team-id", message: `Profile references a team id outside TASK-030's roster: "${profile.teamId}".` });
    }

    if (isAbsoluteWindowsPath(profile.teamId) || isAbsoluteWindowsPath(profile.region)) {
      issues.push({ code: "absolute-path", message: `Profile "${profile.teamId}" contains an absolute filesystem path.` });
    }

    for (const field of PERCENT_FIELDS) {
      const value = profile[field];
      if (typeof value !== "number" || !isFinitePercent(value)) {
        issues.push({ code: "invalid-percent", message: `Profile "${profile.teamId}" field "${field}" is not a finite 0-100 value: ${value}.` });
      }
    }

    if (!Number.isFinite(profile.roundDifferential) || Math.abs(profile.roundDifferential) > 8) {
      issues.push({
        code: "invalid-round-differential",
        message: `Profile "${profile.teamId}" has an out-of-bounds round differential: ${profile.roundDifferential}.`,
      });
    }

    if (profile.dna.teamId !== profile.teamId) {
      issues.push({ code: "dna-team-id-mismatch", message: `Profile "${profile.teamId}" DNA is keyed to a different team.` });
    }
    if (profile.dna.dimensions.length !== DNA_DIMENSIONS.length) {
      issues.push({ code: "dna-dimension-count-mismatch", message: `Profile "${profile.teamId}" DNA has ${profile.dna.dimensions.length} dimensions, expected ${DNA_DIMENSIONS.length}.` });
    }
    for (const dimension of profile.dna.dimensions) {
      if (!KNOWN_DNA_KEYS.has(dimension.key)) {
        issues.push({ code: "unknown-dna-key", message: `Profile "${profile.teamId}" DNA has an unknown dimension key: "${dimension.key}".` });
      }
      if (!isFinitePercent(dimension.value)) {
        issues.push({ code: "invalid-dna-value", message: `Profile "${profile.teamId}" DNA dimension "${dimension.key}" is not a finite 0-100 value: ${dimension.value}.` });
      }
    }

    const profileMapIds = Object.keys(profile.mapStrength);
    for (const map of maps) {
      if (!(map.id in profile.mapStrength)) {
        issues.push({ code: "missing-map", message: `Profile "${profile.teamId}" is missing modeled strength for map "${map.id}".` });
      }
    }
    for (const mapId of profileMapIds) {
      if (!KNOWN_MAP_IDS.has(mapId)) {
        issues.push({ code: "unknown-map-id", message: `Profile "${profile.teamId}" references an unsupported map id: "${mapId}".` });
      }
      const strength = profile.mapStrength[mapId]!;
      if (!isFinitePercent(strength)) {
        issues.push({ code: "invalid-map-strength", message: `Profile "${profile.teamId}" map "${mapId}" strength is not a finite 0-100 value: ${strength}.` });
      }
    }
  }

  for (const teamId of EXPECTED_TEAM_IDS) {
    if (!seenTeamIds.has(teamId)) {
      issues.push({ code: "missing-team", message: `No profile registered for team "${teamId}".` });
    }
  }

  const regenerated = generateVctTeamProfiles();
  if (JSON.stringify(regenerated) !== JSON.stringify(profiles)) {
    issues.push({ code: "non-deterministic-generation", message: "Regenerating the profile set did not produce identical output." });
  }

  const disclosureLower = VCT_PROFILE_DISCLOSURE.toLowerCase();
  for (const banned of BANNED_DISCLOSURE_SUBSTRINGS) {
    if (disclosureLower.includes(banned)) {
      issues.push({ code: "official-data-claim", message: `Disclosure text contains a disallowed official-data claim: "${banned}".` });
    }
  }
  if (!disclosureLower.includes("simulat")) {
    issues.push({ code: "missing-disclosure-language", message: "Disclosure text does not clearly label the data as simulated/modeled." });
  }

  return issues;
}
