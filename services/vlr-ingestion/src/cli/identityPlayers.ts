import { loadVlrIngestionConfig } from "../env";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { buildPlayerAudit } from "../identity/identityAudit";
import { runCli } from "./cliSupport";

/** `pnpm ingest:vlr:identity:players` — TASK-043 requirement 7. Player identity report. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const asJson = process.argv.includes("--json");
  const store = new FilesystemIngestionStore(config.dataDir);
  const dataset = await loadNormalizedDataset(store);
  const playerAudit = buildPlayerAudit(dataset.matches);

  if (asJson) {
    console.log(JSON.stringify(playerAudit, null, 2));
    return;
  }

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log(`Unique VLR player IDs: ${playerAudit.uniquePlayerIds}`);
  console.log(`Total roster appearances: ${playerAudit.rosterAppearanceCount}`);
  console.log(`Incomplete roster snapshots: ${playerAudit.incompleteRosterSnapshotCount}`);
  console.log("Handle-based identity (duplicate handles, handle history): not derivable — handles are not captured anywhere in the current normalized schema (see docs/31).");
  console.log("");
  console.log(`Showing first 25 of ${playerAudit.entries.length} player(s):`);
  for (const entry of playerAudit.entries.slice(0, 25)) {
    console.log(`  ${entry.playerInternalId} — appearances: ${entry.rosterAppearances}, teams: ${entry.teamsRepresented.join(", ")}, first: ${entry.firstSeen ?? "?"}, last: ${entry.lastSeen ?? "?"}`);
  }
}

void runCli(main);
