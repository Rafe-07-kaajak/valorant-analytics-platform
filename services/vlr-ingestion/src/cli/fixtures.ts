import { join } from "node:path";
import { loadVlrIngestionConfig } from "../env";
import { buildOverrideLookup } from "../classification/eventOverrides";
import { INITIAL_EVENT_CLASSIFICATION_OVERRIDES } from "../classification/eventOverrides";
import { buildTeamMappingLookup } from "../identity/teamMapping";
import { INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { FixtureVlrProvider } from "../ingestion/fixtureProvider";
import { IngestionService } from "../ingestion/ingestionService";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:fixtures` — see docs/29-vlr-data-ingestion-foundation.md
 * ("Commands") and TASK-041 requirement 23. Requires no network: every
 * "discovery" and "fetch" reads a synthetic HTML fixture from `fixtures/`.
 * Safe to run repeatedly — a second run reports the previous records as
 * unchanged rather than rewriting them.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const dataDir = join(config.dataDir, "fixtures-run");
  const store = new FilesystemIngestionStore(dataDir);
  const provider = new FixtureVlrProvider();
  const teamMapping = buildTeamMappingLookup(INITIAL_TEAM_MAPPING_REGISTRY);
  const eventOverrides = buildOverrideLookup(INITIAL_EVENT_CLASSIFICATION_OVERRIDES);

  const service = new IngestionService({ provider, store, teamMapping, eventOverrides });
  const scope = buildCanonicalTargetScope();

  console.log("Running fixture ingestion (no network access) ...");
  console.log(`Data directory: ${dataDir}`);

  const summary = await service.run(scope);
  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main);
