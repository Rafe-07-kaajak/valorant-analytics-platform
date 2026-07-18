import { createHash } from "node:crypto";
import { NORMALIZED_SCHEMA_VERSION } from "../normalize/schemaVersion";
import { PARSER_VERSION } from "../vlr/parsers/htmlUtils";
import { QUALITY_RULES_VERSION } from "../quality/qualityRulesVersion";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import type { TeamAlias } from "../identity/teamAliasRegistry";

/**
 * Curated dataset versioning — TASK-043 requirement 19. Extends
 * `discovery/datasetManifest.ts`'s existing deterministic-hash approach
 * (never a random UUID) with the two new version axes TASK-043 introduces:
 * identity-mapping content and quality-rules content. The same input data
 * plus the same mapping/rules content always reproduces the same curated
 * dataset version.
 */
const IDENTITY_VERSION_PREFIX = "vlr-identity-mappings";

export function computeIdentityMappingVersion(teamMappings: readonly VlrTeamMappingEntry[], teamAliases: readonly TeamAlias[]): string {
  const canonical = JSON.stringify({
    teamMappings: [...teamMappings]
      .map((entry) => ({ vlrTeamId: entry.vlrTeamId, internalTeamId: entry.internalTeamId, status: entry.status ?? "verified" }))
      .sort((a, b) => a.vlrTeamId.localeCompare(b.vlrTeamId)),
    teamAliases: [...teamAliases]
      .map((alias) => ({ canonicalTeamId: alias.canonicalTeamId, alias: alias.alias, aliasType: alias.aliasType }))
      .sort((a, b) => `${a.canonicalTeamId}:${a.alias}`.localeCompare(`${b.canonicalTeamId}:${b.alias}`)),
  });
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return `${IDENTITY_VERSION_PREFIX}@${hash}`;
}

export interface CuratedVersionInputs {
  readonly sourceDatasetVersion: string;
  readonly identityMappingVersion: string;
  readonly curatedMatchInternalIds: readonly string[];
  readonly curatedMatchContentHashes: readonly string[];
}

export interface CuratedVersion {
  readonly curatedDatasetVersion: string;
  readonly schemaVersion: string;
  readonly parserVersion: string;
  readonly qualityRulesVersion: string;
  readonly identityMappingVersion: string;
  readonly sourceDatasetVersion: string;
}

export function computeCuratedDatasetVersion(inputs: CuratedVersionInputs): CuratedVersion {
  const canonical = JSON.stringify({
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
    qualityRulesVersion: QUALITY_RULES_VERSION,
    identityMappingVersion: inputs.identityMappingVersion,
    sourceDatasetVersion: inputs.sourceDatasetVersion,
    curatedMatchContentHashes: [...inputs.curatedMatchContentHashes].sort(),
  });
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return {
    curatedDatasetVersion: hash,
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
    qualityRulesVersion: QUALITY_RULES_VERSION,
    identityMappingVersion: inputs.identityMappingVersion,
    sourceDatasetVersion: inputs.sourceDatasetVersion,
  };
}
