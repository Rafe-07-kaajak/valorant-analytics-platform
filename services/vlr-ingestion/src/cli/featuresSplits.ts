import { loadVlrIngestionConfig } from "../env";
import { runFeatureBuild } from "../feature/featureBuild";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:features:splits` — TASK-044 requirement 17. Prints the
 * chronological train/validation/test boundaries, per-split diagnostics,
 * and walk-forward fold summary. Read-only; never makes a network request.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const result = await runFeatureBuild(config.dataDir);

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Total rows: ${result.rows.length}`);
  console.log("");
  console.log("=== Split boundaries ===");
  console.log(JSON.stringify(result.splitSummary.boundaries, null, 2));
  console.log("");
  console.log("=== Split diagnostics ===");
  for (const [label, diagnostics] of [
    ["train", result.splitSummary.train],
    ["validation", result.splitSummary.validation],
    ["test", result.splitSummary.test],
  ] as const) {
    console.log(`${label}: ${diagnostics.rowCount} rows, cold-start rate ${(diagnostics.coldStartRate * 100).toFixed(1)}%`);
    console.log(`  by year: ${JSON.stringify(diagnostics.byYear)}`);
    console.log(`  by event family: ${JSON.stringify(diagnostics.byEventFamily)}`);
  }
  console.log("");
  console.log(`=== Walk-forward folds (${result.walkForwardFolds.length}) ===`);
  for (const fold of result.walkForwardFolds) {
    console.log(`  fold ${fold.foldId}: train=${fold.trainRowCount} (through ${fold.trainEndIso}), validation=${fold.validationRowCount} (${fold.validationStartIso} → ${fold.validationEndIso})`);
  }
}

void runCli(main);
