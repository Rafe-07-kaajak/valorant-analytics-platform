import type { PipelineResult } from "./pipeline";
import type { ModelCard } from "./artifact";

/** Builds the human-readable model card from a completed pipeline run — TASK-045 requirement 15/25. */
export function buildModelCard(result: PipelineResult): ModelCard {
  return {
    summary: `Selected estimator: ${result.selectedEstimatorType} (calibration: ${result.finalCalibration.method}), model version ${result.modelVersion}, built from feature dataset version ${result.source.manifest.featureDatasetVersion}. Test log loss ${result.evaluation.testMetricsCalibrated.logLoss.toFixed(4)} vs Elo baseline ${result.evaluation.baselineTestMetrics["elo-baseline"].logLoss.toFixed(4)}.`,
    datasetSummary: {
      rowCount: result.source.manifest.rowCount,
      featureCount: result.source.manifest.featureCount,
      trainRowCount: result.source.splitSummary.boundaries.trainRowCount,
      validationRowCount: result.source.splitSummary.boundaries.validationRowCount,
      testRowCount: result.source.splitSummary.boundaries.testRowCount,
      dateRangeStartIso: result.audit.dateRangeStartIso,
      dateRangeEndIso: result.audit.dateRangeEndIso,
      overallTeamAWinRate: result.audit.targets.overallTeamAWinRate,
      coldStartRowCount: result.audit.coldStartRowCount,
    },
    candidatesEvaluated: [
      { family: "logistic-regression", configs: result.logisticCandidates.map((c) => ({ config: c.config, validationLogLoss: c.validationMetrics.logLoss })) },
      { family: "gradient-boosted-trees", configs: result.treeCandidates.map((c) => ({ config: c.config, validationLogLoss: c.validationMetrics.logLoss })) },
    ],
    backtestSummary: {
      logisticMeanLogLoss: result.walkForward["logistic-regression"].meanLogLoss,
      treeMeanLogLoss: result.walkForward["gradient-boosted-trees"].meanLogLoss,
      eloMeanLogLoss: result.walkForward["elo-baseline"].meanLogLoss,
      classPriorMeanLogLoss: result.walkForward["class-prior-baseline"].meanLogLoss,
      constantMeanLogLoss: result.walkForward["constant-baseline"].meanLogLoss,
      foldCount: result.walkForward[result.selectedEstimatorType].folds.length,
    },
    calibrationSummary: {
      candidatesEvaluated: result.calibrationCandidates.map((c) => ({ method: c.method, validationLogLoss: c.validationMetrics.logLoss, validationEce: c.validationMetrics.expectedCalibrationError })),
      selectedMethod: result.finalCalibration.method,
      rationale: result.calibrationRationale,
    },
    selectionRationale: result.selectionRationale,
    finalTestSummary: {
      logLoss: result.evaluation.testMetricsCalibrated.logLoss,
      brierScore: result.evaluation.testMetricsCalibrated.brierScore,
      rocAuc: result.evaluation.testMetricsCalibrated.rocAuc,
      accuracy: result.evaluation.testMetricsCalibrated.accuracy,
      eloLogLoss: result.evaluation.baselineTestMetrics["elo-baseline"].logLoss,
      logLossMinusEloConfidenceInterval: result.evaluation.uncertainty.logLossMinusElo,
    },
    knownLimitations: [
      "Only 432 curated matches across 16 approved events — several teams remain in or near cold-start through much of the timeline.",
      "Calibration method selection uses validation-set evidence directly, without a further held-out calibration split, given the limited row count.",
      "Bootstrap confidence intervals are descriptive uncertainty, not a formal significance test, and do not correct for the chronological/tournament structure of the data.",
      "No player handle/rename identity beyond provider ID; no map veto/selection-order data; no patch field.",
      "No team home-region evidence, so no standalone same/cross-region team-matchup feature exists.",
      "Feature importance is associative, not causal.",
      "No live inference service, no frontend integration, and no scheduler are part of this task.",
    ],
    nextStep: "TASK-046: inference-service integration, loading this artifact (never retraining it) to serve real predictions.",
  };
}
