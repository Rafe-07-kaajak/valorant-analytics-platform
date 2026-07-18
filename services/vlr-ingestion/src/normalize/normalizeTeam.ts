import type { VlrTeam } from "../vlr/schemas/raw";
import type { ResolvedTeamIdentity } from "../identity/teamMapping";
import { contentHash } from "./contentHash";
import { NORMALIZED_SCHEMA_VERSION } from "./schemaVersion";
import type { IngestionRecordMetadata, NormalizedTeam } from "./normalizedSchemas";

/**
 * Raw → normalized team, idempotent — see
 * docs/29-vlr-data-ingestion-foundation.md ("Raw vs Normalized Data") and
 * TASK-041 requirement 7. Given the same raw record and identity
 * resolution, always produces byte-identical output.
 */
export function normalizeTeam(raw: VlrTeam, identity: ResolvedTeamIdentity, parsedAt: string): NormalizedTeam {
  const { source, ...content } = raw;
  const metadata: IngestionRecordMetadata = {
    provider: "vlr",
    providerExternalId: raw.vlrTeamId,
    sourceUrl: source.sourceUrl,
    fetchedAt: source.fetchedAt,
    parsedAt,
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    contentHash: contentHash(content),
  };

  return {
    internalId: identity.internalId,
    mapped: identity.mapped,
    name: raw.name,
    shortName: raw.shortName,
    region: raw.region,
    metadata,
  };
}
