import { loadVlrIngestionConfig } from "../env";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { buildTeamAudit } from "../identity/identityAudit";
import { INITIAL_TEAM_MAPPING_REGISTRY, validateTeamMappingRegistry } from "../identity/teamMapping";
import { INITIAL_TEAM_ALIAS_REGISTRY, validateTeamAliasRegistry } from "../identity/teamAliasRegistry";
import { runCli } from "./cliSupport";

/** `pnpm ingest:vlr:identity:teams` — TASK-043 requirement 4/5. Team mapping + alias report: mapped/unmapped/conflicted, alias collisions. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const asJson = process.argv.includes("--json");
  const store = new FilesystemIngestionStore(config.dataDir);
  const dataset = await loadNormalizedDataset(store);

  const mappingValidation = validateTeamMappingRegistry(INITIAL_TEAM_MAPPING_REGISTRY);
  const aliasValidation = validateTeamAliasRegistry(INITIAL_TEAM_ALIAS_REGISTRY);
  const teamAudit = buildTeamAudit(dataset.matches, INITIAL_TEAM_MAPPING_REGISTRY);

  if (asJson) {
    console.log(JSON.stringify({ mappingValidation, aliasValidation, teamAudit }, null, 2));
    if (!mappingValidation.valid || !aliasValidation.valid) process.exitCode = 1;
    return;
  }

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log(`Team mapping registry valid: ${mappingValidation.valid} (${INITIAL_TEAM_MAPPING_REGISTRY.length} entries)`);
  for (const conflict of mappingValidation.conflicts) console.log(`  CONFLICT: VLR team ${conflict.vlrTeamId} maps to ${conflict.conflicting.map((c) => c.internalTeamId).join(", ")}`);
  console.log(`Alias registry valid: ${aliasValidation.valid} (${INITIAL_TEAM_ALIAS_REGISTRY.length} entries)`);
  for (const collision of aliasValidation.collisions) console.log(`  COLLISION: alias "${collision.normalizedAlias}" assigned to ${new Set(collision.conflicting.map((c) => c.canonicalTeamId)).size} distinct teams`);

  console.log("");
  console.log(`Currently-supported teams: ${teamAudit.currentSupportedTeamsMapped.length}/${teamAudit.currentSupportedTeamCandidates.length} resolved`);
  console.log(`Unresolved: ${teamAudit.currentSupportedTeamsUnresolved.join(", ") || "(none)"}`);
  console.log("");
  console.log("Observed teams in dataset (mapped + unmapped):");
  for (const entry of teamAudit.entries) {
    console.log(`  ${entry.teamInternalId} — mapped: ${entry.mapped}, matches: ${entry.matchAppearances}, events: ${entry.eventAppearances}, first: ${entry.firstSeen ?? "?"}, last: ${entry.lastSeen ?? "?"}`);
  }

  if (!mappingValidation.valid || !aliasValidation.valid) process.exitCode = 1;
}

void runCli(main);
