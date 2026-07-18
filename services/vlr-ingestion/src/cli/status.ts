import { describeConfig, loadVlrIngestionConfig } from "../env";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { EVENT_DISCOVERY_CHECKPOINT_KEY, loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { loadDatasetManifest } from "../discovery/datasetManifest";
import { deterministicInternalId } from "../identity/deterministicId";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:status` — TASK-042 requirement 9. Read-only summary of
 * the current backfill campaign's state: never touches the network, makes
 * it obvious whether `discover`/`backfill`/`retry` need to run next.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  console.log("=== VLR ingestion status ===");
  console.log(`Network enabled: ${config.networkEnabled}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log("Active rate/safety policy:");
  console.log(describeConfig(config));
  console.log("");

  const store = new FilesystemIngestionStore(config.dataDir);
  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  const datasetManifest = await loadDatasetManifest(store);

  if (!eventManifest || !matchManifest) {
    console.log("No discovery manifest found yet. Next step: pnpm ingest:vlr:discover");
    return;
  }

  const discoveryCheckpoint = await store.readEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY);
  console.log(`Event manifest: ${eventManifest.entries.length} candidate event(s), generated ${eventManifest.generatedAt}`);
  console.log(`Archive scan complete (reached scope start date): ${discoveryCheckpoint?.archiveComplete ? "YES" : "NO"}`);
  console.log(`Last completed discovery page: ${discoveryCheckpoint?.lastCompletedPage ?? "(none yet)"}`);
  console.log(`Match manifest: ${matchManifest.entries.length} unique match link(s), generated ${matchManifest.generatedAt}`);

  const includedEventIds = eventManifest.entries.filter((e) => e.inclusionStatus === "included").map((e) => e.vlrEventId);
  let eventsWithVerifiedMatchDiscovery = 0;
  for (const vlrEventId of includedEventIds) {
    const checkpoint = await store.readMatchDiscoveryCheckpoint(vlrEventId);
    if (checkpoint?.verifiedComplete) eventsWithVerifiedMatchDiscovery += 1;
  }
  console.log(`Included events with verified-complete match discovery: ${eventsWithVerifiedMatchDiscovery} / ${includedEventIds.length}`);

  const completedEntries = matchManifest.entries.filter((e) => e.listedStatus === "completed");
  let normalizedCount = 0;
  for (const entry of completedEntries) {
    if (await store.getNormalizedEntity<NormalizedMatch>("match", deterministicInternalId("match", entry.vlrMatchId))) normalizedCount += 1;
  }
  console.log(`Normalized completed matches: ${normalizedCount} / ${completedEntries.length}`);

  const unresolvedFailures = await store.listFailures({ resolved: false });
  console.log(`Unresolved failures: ${unresolvedFailures.length}`);

  console.log(`Dataset manifest generated: ${datasetManifest ? `yes (version ${datasetManifest.datasetVersion})` : "no — run pnpm ingest:vlr:manifest"}`);
  console.log("");

  if (!discoveryCheckpoint?.archiveComplete || eventsWithVerifiedMatchDiscovery < includedEventIds.length) {
    console.log("Next step: pnpm ingest:vlr:discover (event and/or match discovery has not reached full archive completion)");
  } else if (normalizedCount < completedEntries.length) {
    console.log(`Next step: pnpm ingest:vlr:backfill --batch-size 50 (${completedEntries.length - normalizedCount} completed match(es) remaining)`);
  } else if (unresolvedFailures.length > 0) {
    console.log("Next step: pnpm ingest:vlr:retry (all discovered completed matches are normalized; unresolved failures remain)");
  } else {
    console.log("Next step: pnpm ingest:vlr:validate, then pnpm ingest:vlr:manifest");
  }
}

void runCli(main);
