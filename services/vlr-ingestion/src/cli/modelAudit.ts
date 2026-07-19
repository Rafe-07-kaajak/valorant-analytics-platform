import { loadVlrIngestionConfig } from "../env";
import { loadFeatureDatasetSource } from "../modeling/io";
import { buildFeaturePolicy } from "../modeling/featurePolicy";
import { buildModelFeasibilityAudit, writeModelAuditReport } from "../modeling/audit";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:audit` — TASK-045 requirement 2. Read-only feasibility audit over the TASK-044 feature dataset, persisted to `<dataDir>/models/model-audit.json`. Never trains anything; never makes a network request. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const source = await loadFeatureDatasetSource(config.dataDir);
  const policy = buildFeaturePolicy(source.catalog);
  const audit = buildModelFeasibilityAudit(source.rows, policy, source.splitAssignments, new Date().toISOString());
  await writeModelAuditReport(config.dataDir, audit);

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Audit output: ${config.dataDir}/models/model-audit.json`);
  console.log("");
  console.log(`Rows audited: ${audit.rowCount}`);
  console.log(`Date range: ${audit.dateRangeStartIso} - ${audit.dateRangeEndIso}`);
  console.log(`Feature count: ${audit.featureCount} (numeric ${audit.numericFeatureCount}, boolean ${audit.booleanFeatureCount}, categorical ${audit.categoricalFeatureCount})`);
  console.log(`Team coverage: ${audit.teamCoverageCount} teams`);
  console.log(`Cold-start rows: ${audit.coldStartRowCount}/${audit.rowCount}`);
  console.log(`Overall Team A win rate: ${(audit.targets.overallTeamAWinRate * 100).toFixed(1)}% (orientation bias flag: ${audit.targets.orientationBiasFlag})`);
  console.log(`Constant features: ${audit.constantFeatures.length}`);
  console.log(`Near-constant features: ${audit.nearConstantFeatures.length}`);
  console.log(`Duplicate feature pairs: ${audit.duplicateFeaturePairs.length}`);
  console.log(`Highly correlated numeric pairs: ${audit.highlyCorrelatedNumericPairs.length}`);
  console.log(`Suspicious target correlations: ${audit.suspiciousTargetCorrelations.length}`);
  console.log(`Baseline probabilities: constant=${audit.baselineProbabilities.constant}, classPrior=${audit.baselineProbabilities.trainingSetClassPrior.toFixed(4)}, meanElo=${audit.baselineProbabilities.meanEloWinProbability.toFixed(4)}`);
}

void runModelingCli(main);
