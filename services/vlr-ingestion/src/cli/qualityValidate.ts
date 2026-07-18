import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { runQualityAudit } from "../quality/qualityAudit";
import { INITIAL_TEAM_MAPPING_REGISTRY, validateTeamMappingRegistry } from "../identity/teamMapping";
import { INITIAL_TEAM_ALIAS_REGISTRY, validateTeamAliasRegistry } from "../identity/teamAliasRegistry";
import { runFullReconciliation } from "../reconciliation/runReconciliation";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:quality:validate` — TASK-043 requirement 15/28. The hard
 * validation gate: exits non-zero on any fatal condition. Deliberately
 * distinct from `pnpm ingest:vlr:validate` (TASK-042's completeness check,
 * unchanged) — this command is about identity/quality correctness, not
 * discovery completeness.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const store = new FilesystemIngestionStore(config.dataDir);

  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!eventManifest || !matchManifest) {
    throw new IngestionError("checkpoint_failure", "No discovery manifests found. Run `pnpm ingest:vlr:discover` first.");
  }

  const failures: string[] = [];
  const warnings: string[] = [];

  const mappingValidation = validateTeamMappingRegistry(INITIAL_TEAM_MAPPING_REGISTRY);
  if (!mappingValidation.valid) {
    for (const conflict of mappingValidation.conflicts) failures.push(`Team mapping conflict: VLR team ${conflict.vlrTeamId} maps to multiple internal teams.`);
    for (const invalid of mappingValidation.invalidEntries) failures.push(`Invalid team mapping entry (${invalid.entry.vlrTeamId}): ${invalid.reasons.join("; ")}`);
  }

  const aliasValidation = validateTeamAliasRegistry(INITIAL_TEAM_ALIAS_REGISTRY);
  for (const collision of aliasValidation.collisions) warnings.push(`Alias collision: "${collision.normalizedAlias}" assigned to multiple canonical teams — never auto-resolved.`);

  const dataset = await loadNormalizedDataset(store);
  const scope = buildCanonicalTargetScope();
  const auditResult = runQualityAudit(dataset.matches, dataset.eventsById, scope.startDate, scope.endDate, new Date().toISOString());
  for (const issue of auditResult.issues) {
    if (issue.severity === "fatal") failures.push(`[${issue.code}] ${issue.entityId}: ${issue.message}`);
    else warnings.push(`[${issue.code}] ${issue.entityId}: ${issue.message}`);
  }

  const { eventReport, matchReport } = await runFullReconciliation(store, eventManifest, matchManifest);
  for (const entry of eventReport.entries) {
    if (entry.category === "orphaned") failures.push(`Orphaned event record: ${entry.internalId} — ${entry.reason}`);
    else if (entry.category === "stale" || entry.category === "out-of-scope") warnings.push(`Event ${entry.internalId} categorized "${entry.category}": ${entry.reason}`);
  }
  for (const entry of matchReport.entries) {
    if (entry.category === "orphaned") failures.push(`Orphaned match record: ${entry.internalId} — ${entry.reason}`);
    else if (entry.category === "stale" || entry.category === "out-of-scope") warnings.push(`Match ${entry.internalId} categorized "${entry.category}": ${entry.reason}`);
  }

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log(`Valid: ${failures.length === 0}`);
  console.log(`Failures: ${failures.length}`);
  for (const failure of failures.slice(0, 50)) console.log(`  FAIL: ${failure}`);
  if (failures.length > 50) console.log(`  ... and ${failures.length - 50} more failure(s).`);
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 20)) console.log(`  WARN: ${warning}`);
  if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more warning(s).`);

  if (failures.length > 0) process.exitCode = 1;
}

void runCli(main);
