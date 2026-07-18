import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { buildOverrideLookup, validateOverrideRegistry, INITIAL_EVENT_CLASSIFICATION_OVERRIDES } from "../classification/eventOverrides";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { RealVlrProvider } from "../vlr/realVlrProvider";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { discoverEventsResumable, saveEventDiscoveryManifest } from "../discovery/eventManifest";
import { buildMatchDiscoveryManifestResumable } from "../discovery/matchManifest";
import { buildPreBackfillReport, formatPreBackfillReport } from "../discovery/preBackfillReport";
import { runCli } from "./cliSupport";

const DEFAULT_MAX_PAGES_PER_RUN = 20;
const MAX_PAGES_CEILING = 400;

function parseIntFlag(argv: readonly string[], flag: string, fallback: number, ceiling: number): number {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) return fallback;
  const raw = argv[flagIndex + 1];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new IngestionError("invalid_backfill_scope", `${flag} must be a positive integer (got "${raw}").`);
  }
  return Math.min(parsed, ceiling);
}

/**
 * `pnpm ingest:vlr:discover [--max-pages N] [--restart-discovery]` —
 * TASK-042 requirements 1/2/4/6/7. Resumable, checkpointed event and match
 * discovery: each invocation scans up to `--max-pages` further event-listing
 * pages (default 20, bounding a single invocation's runtime — a full
 * 18-month archive is a many-page, many-request operation), persists a
 * checkpoint after every page, and merges newly discovered events into the
 * existing manifest rather than overwriting it. Running this command
 * repeatedly resumes automatically from the last checkpointed page until
 * `archiveComplete` — never re-scanning from page 1 and never re-fetching an
 * already-verified event's detail page. `--restart-discovery` explicitly
 * discards the checkpoint and manifest and starts over.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const maxPagesThisRun = parseIntFlag(process.argv, "--max-pages", DEFAULT_MAX_PAGES_PER_RUN, MAX_PAGES_CEILING);
  const restart = process.argv.includes("--restart-discovery");

  console.log("Rate/concurrency policy for this run:");
  console.log(describeConfig(config));
  console.log(`Max listing pages scanned this invocation: ${maxPagesThisRun}`);
  if (restart) console.log("--restart-discovery: ignoring any existing checkpoint/manifest, starting over from page 1.");
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run live discovery.");
  }

  const overrideValidation = validateOverrideRegistry(INITIAL_EVENT_CLASSIFICATION_OVERRIDES);
  if (!overrideValidation.valid) {
    throw new IngestionError("event_classification_conflict", `Event classification override registry is invalid: ${JSON.stringify(overrideValidation.conflicts)}`);
  }
  const overrides = buildOverrideLookup(INITIAL_EVENT_CLASSIFICATION_OVERRIDES);

  const scope = buildCanonicalTargetScope();
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Scope: ${scope.startDate} through ${scope.endDate}, approved families: ${scope.eventFamilies.join(", ")}`);
  console.log("");

  const store = new FilesystemIngestionStore(config.dataDir);
  const provider = new RealVlrProvider(config, undefined, {
    onDiscoveryPage: (page, candidates, totalKnown) => console.log(`  [events] page ${page}: ${candidates} candidate(s) checked, ${totalKnown} total known event(s) so far`),
    onEventCandidate: (id, inRange) => {
      if (inRange) console.log(`    + event ${id} is date-in-range (classified below)`);
    },
  });

  console.log("Discovering events (resumable; upcoming-only/excluded-by-name listings are skipped without a request)...");
  const discoveryResult = await discoverEventsResumable(provider, scope, overrides, store, {
    restart,
    maxPagesThisRun,
    onPage: (page, candidates, totalKnown) => console.log(`  [events] page ${page} complete: ${candidates} candidate(s) checked, ${totalKnown} total known event(s)`),
    onEventCandidate: (id, inRange) => {
      if (inRange) console.log(`    + event ${id} is date-in-range (classified below)`);
    },
  });
  await saveEventDiscoveryManifest(store, discoveryResult.manifest);

  if (discoveryResult.scopeOrParserMismatch) {
    console.log("NOTE: the persisted checkpoint was for a different scope or an older parser version — it was not silently resumed; discovery started fresh instead.");
  }
  console.log(`Event discovery: ${discoveryResult.pagesScannedThisRun} page(s) scanned this run, ${discoveryResult.manifest.entries.length} candidate event(s) known in total.`);
  console.log(`Archive fully scanned back to ${scope.startDate}: ${discoveryResult.archiveComplete ? "YES" : "NOT YET — run this command again to continue"}`);
  console.log(`Last completed page (resume point): ${discoveryResult.checkpoint.lastCompletedPage}`);
  console.log("");

  console.log("Discovering matches for every included event (resumable; already-verified-complete events are skipped)...");
  const matchManifest = await buildMatchDiscoveryManifestResumable(provider, discoveryResult.manifest, store, {
    onEventDiscovered: (eventId, count, verified) => console.log(`  [matches] event ${eventId}: ${count} match link(s)${verified ? "" : " — NOT yet verified complete against the event's listed match count"}`),
  });
  console.log(`Match discovery complete: ${matchManifest.entries.length} unique match link(s), ${matchManifest.duplicateMatchLinks} duplicate(s).`);
  if (matchManifest.countMismatchEvents.length > 0) {
    console.log(`WARNING: ${matchManifest.countMismatchEvents.length} event(s) discovered fewer matches than their listed count: ${matchManifest.countMismatchEvents.join(", ")}`);
  }
  console.log("");

  const report = buildPreBackfillReport(discoveryResult.manifest, matchManifest, config);
  console.log("=== Pre-backfill discovery report ===");
  console.log(formatPreBackfillReport(report));
  console.log(`Archive scan complete: ${discoveryResult.archiveComplete}`);

  if (report.anomalies.length > 0) {
    console.log("");
    console.log("Anomalies were detected — review before running a full backfill. See the report above.");
  }
  if (!discoveryResult.archiveComplete) {
    console.log("");
    console.log("Event discovery has not yet reached the scope's start date. Resume with: pnpm ingest:vlr:discover");
  }
}

void runCli(main);
