import { loadVlrIngestionConfig } from "../env";
import { loadCuratedFeatureSource } from "../feature/curatedSource";
import { buildFeatureFeasibilityAudit } from "../feature/featureAudit";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:features:audit` — TASK-044 requirement 2. Reports, for
 * every candidate signal, real dataset coverage and the leakage
 * include/exclude decision. Read-only; never makes a network request.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const source = await loadCuratedFeatureSource(config.dataDir);
  const audit = buildFeatureFeasibilityAudit(source.matches, source.events, new Date().toISOString());

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Matches audited: ${audit.matchCount}`);
  console.log(`Events audited: ${audit.eventCount}`);
  console.log("");
  for (const entry of audit.entries) {
    console.log(`[${entry.includedInTask044 ? "INCLUDED" : "EXCLUDED"}] ${entry.signal} (${entry.group})`);
    console.log(`  coverage: ${entry.coverageCount}/${entry.coverageDenominator} (missingness ${(entry.missingnessRate * 100).toFixed(1)}%)`);
    console.log(`  available before match start: ${entry.availableStrictlyBeforeMatchStart}, leakage risk: ${entry.leakageRisk}`);
    console.log(`  fallback: ${entry.fallback}`);
    console.log(`  notes: ${entry.notes}`);
    console.log("");
  }
}

void runCli(main);
