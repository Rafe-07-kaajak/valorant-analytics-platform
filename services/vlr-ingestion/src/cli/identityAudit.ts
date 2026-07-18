import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { buildEventAudit, buildPlayerAudit, buildTeamAudit } from "../identity/identityAudit";
import { INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:identity:audit` — TASK-043 requirement 2. Deterministic
 * baseline identity/quality audit across teams, players, and events, read
 * directly from the already-persisted normalized store. No network.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const asJson = process.argv.includes("--json");
  console.log(`Data directory: ${config.dataDir}`);

  const store = new FilesystemIngestionStore(config.dataDir);
  const dataset = await loadNormalizedDataset(store);
  if (dataset.matches.length === 0 && dataset.events.length === 0) {
    throw new IngestionError("checkpoint_failure", "No normalized records found. Run `pnpm ingest:vlr:discover` and `pnpm ingest:vlr:backfill` first.");
  }

  const teamAudit = buildTeamAudit(dataset.matches, INITIAL_TEAM_MAPPING_REGISTRY);
  const playerAudit = buildPlayerAudit(dataset.matches);
  const eventAudit = buildEventAudit(dataset.events, dataset.matches);

  if (asJson) {
    console.log(JSON.stringify({ teamAudit, playerAudit, eventAudit }, null, 2));
    return;
  }

  console.log("");
  console.log("=== Teams ===");
  console.log(`Unique internal team identities: ${teamAudit.uniqueInternalTeamIds}`);
  console.log(`Mapped: ${teamAudit.mappedTeamCount}, unmapped: ${teamAudit.unmappedTeamCount}`);
  console.log(`Duplicate internal mappings (conflicts): ${teamAudit.duplicateInternalMappingCount}`);
  console.log(`Currently-supported (32-team) roster: ${teamAudit.currentSupportedTeamsMapped.length}/${teamAudit.currentSupportedTeamCandidates.length} mapped`);
  console.log(`Unresolved supported teams: ${teamAudit.currentSupportedTeamsUnresolved.join(", ") || "(none)"}`);

  console.log("");
  console.log("=== Players ===");
  console.log(`Unique VLR player IDs: ${playerAudit.uniquePlayerIds}`);
  console.log(`Total roster appearances: ${playerAudit.rosterAppearanceCount}`);
  console.log(`Incomplete roster snapshots: ${playerAudit.incompleteRosterSnapshotCount}`);
  console.log("Handle-based duplicate/rename detection: not derivable from the current dataset (handles are not captured — see docs/31, 'Known limitations').");

  console.log("");
  console.log("=== Events ===");
  console.log(`Unique persisted event records: ${eventAudit.uniqueEventIds}`);
  console.log(`Duplicate event records: ${eventAudit.duplicateEventRecordCount}`);
  for (const entry of eventAudit.entries) {
    console.log(`  ${entry.eventInternalId}: "${entry.name}" (${entry.family}) — ${entry.matchCount} match(es), ${entry.startDate ?? "?"}–${entry.endDate ?? "?"}`);
  }
}

void runCli(main);
