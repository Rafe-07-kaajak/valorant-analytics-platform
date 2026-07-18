import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { loadDatasetManifest } from "../discovery/datasetManifest";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { loadQualityReport } from "../quality/qualityAudit";
import { evaluateQuarantine, saveQuarantineLedger } from "../quality/quarantine";
import type { QuarantineRecord } from "../quality/quarantine";
import type { QualityIssue } from "../quality/qualityIssue";
import { INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";
import { INITIAL_TEAM_ALIAS_REGISTRY } from "../identity/teamAliasRegistry";
import { runFullReconciliation } from "../reconciliation/runReconciliation";
import { buildCategoryByExternalId } from "../reconciliation/reconciliationTypes";
import { buildCuratedDataset, writeCuratedDataset } from "../curate/curatedExport";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:curate` — TASK-043 requirement 18. Builds the
 * deterministic curated dataset for TASK-044 feature engineering, writing
 * it to `<dataDir>/curated/`. Read-only over the existing normalized store
 * and manifests; writes only new curated files, never touches an existing
 * normalized/raw record.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const store = new FilesystemIngestionStore(config.dataDir);

  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  const sourceDatasetManifest = await loadDatasetManifest(store);
  if (!eventManifest || !matchManifest || !sourceDatasetManifest) {
    throw new IngestionError("checkpoint_failure", "Missing discovery/dataset manifests. Run `pnpm ingest:vlr:discover`, `pnpm ingest:vlr:backfill`, then `pnpm ingest:vlr:manifest` first.");
  }

  const dataset = await loadNormalizedDataset(store);
  const generatedAt = new Date().toISOString();

  const auditResult = await loadQualityReport(store);
  if (!auditResult) {
    throw new IngestionError("checkpoint_failure", "No quality report found. Run `pnpm ingest:vlr:quality:audit` first, so curation reuses its stable issue timestamps instead of recomputing a fresh audit on every run.");
  }
  const { eventReport, matchReport } = await runFullReconciliation(store, eventManifest, matchManifest);
  const eventCategoryByInternalId = new Map(eventReport.entries.map((e) => [e.internalId, e.category]));
  const matchCategoryByInternalId = new Map(matchReport.entries.map((e) => [e.internalId, e.category]));
  const matchCategoryByVlrId = buildCategoryByExternalId(matchReport);

  const issuesByMatch = new Map<string, QualityIssue[]>();
  for (const issue of auditResult.issues) {
    if (issue.entityType !== "match") continue;
    const bucket = issuesByMatch.get(issue.entityId);
    if (bucket) bucket.push(issue);
    else issuesByMatch.set(issue.entityId, [issue]);
  }

  const freshQuarantineRecords: QuarantineRecord[] = [];
  for (const match of dataset.matches) {
    const category = matchCategoryByVlrId.get(match.sourceReference.externalId);
    const evaluation = evaluateQuarantine({ match, reconciliationCategory: category, issues: issuesByMatch.get(match.internalId) ?? [] });
    if (evaluation.quarantined) {
      freshQuarantineRecords.push({ entityType: "match", internalId: match.internalId, reasons: evaluation.reasons, firstQuarantinedAt: generatedAt, sourceReference: match.sourceReference.sourceUrl });
    }
  }
  const quarantineRecords = await saveQuarantineLedger(store, freshQuarantineRecords);

  const files = buildCuratedDataset({
    matches: dataset.matches,
    events: dataset.events,
    teamMapping: INITIAL_TEAM_MAPPING_REGISTRY,
    teamAliases: INITIAL_TEAM_ALIAS_REGISTRY,
    qualityIssues: auditResult.issues,
    quarantineRecords,
    matchCategoryByInternalId,
    eventCategoryByInternalId,
    sourceDatasetVersion: sourceDatasetManifest.datasetVersion,
    generatedAt,
  });

  const hashes = await writeCuratedDataset(config.dataDir, files);

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Curated output: ${config.dataDir}/curated/`);
  console.log("");
  console.log("=== Curated dataset manifest ===");
  console.log(JSON.stringify(files["dataset-manifest.json"], null, 2));
  console.log("");
  console.log("File content hashes (for idempotency verification):");
  for (const [fileName, hash] of Object.entries(hashes)) console.log(`  ${fileName}: ${hash}`);
}

void runCli(main);
