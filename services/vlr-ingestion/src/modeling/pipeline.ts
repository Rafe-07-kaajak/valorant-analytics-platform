import { version as typescriptVersion } from "typescript";
import { loadFeatureDatasetSource, partitionBySplit, type FeatureDatasetSource } from "./io";
import { buildFeaturePolicy, type FeaturePolicy } from "./featurePolicy";
import { buildModelFeasibilityAudit, type ModelAudit } from "./audit";
import { fitPreprocessor, transformRows, type PreprocessorState } from "./preprocessing";
import { constantBaselinePredict, eloBaselinePredict, fitClassPrior, classPriorPredict } from "./baselines";
import { computeMetrics, reliabilityBins, type ProbabilisticMetrics } from "./metrics";
import { fitLogisticRegression, predictLogisticRegression, type LogisticRegressionConfig } from "./logisticRegression";
import { fitGradientBoostedTrees, predictGradientBoostedTrees, type GradientBoostedTreesConfig } from "./gradientBoostedTrees";
import { LOGISTIC_CANDIDATE_CONFIGS, TREE_CANDIDATE_CONFIGS, makeLogisticFoldFn, makeTreeFoldFn, constantFoldFn, classPriorFoldFn, eloFoldFn } from "./candidates";
import { runWalkForwardBacktest, type WalkForwardBacktestResult } from "./backtest";
import { fitSigmoidCalibration, fitIsotonicCalibration, applyCalibrationBatch, MIN_ISOTONIC_SAMPLE_COUNT, type CalibrationModel } from "./calibration";
import { computeTestSetUncertainty, type TestSetUncertainty } from "./bootstrap";
import { buildErrorAnalysis, type ErrorAnalysisReport } from "./errorAnalysis";
import { logisticFeatureImportance, permutationFeatureImportance } from "./featureImportance";
import { computeModelVersion } from "./modelVersion";
import type { SerializedEstimator, ModelManifest, ModelCard, EvaluationReport, RowPrediction, FoldPredictionRecord, ReliabilityData, FeatureContract, FeatureImportanceReport, ModelArtifactFiles } from "./artifact";
import { ModelingError } from "./errors";

/**
 * End-to-end training pipeline — TASK-045 requirement 26 (A-I). This is the
 * single "one-command rebuild" the CLI's `model:train` invokes; every other
 * `model:*` command only reads what this function already wrote. The test
 * split is never read until step G, after every other decision (candidate
 * hyperparameters, family, calibration method) has already been frozen
 * using only train/validation/walk-forward evidence.
 */

const RANDOM_SEED = 45045;
const REPORTING_THRESHOLD = 0.5;
const PROBABILITY_CLIPPING_EPSILON = 1e-15;
const FAMILY_INDISTINGUISHABLE_LOG_LOSS_EPSILON = 0.005;
const MIN_IMPROVEMENT_OVER_ELO_LOG_LOSS = 0;

export interface CandidateFitResult<TConfig> {
  readonly config: TConfig;
  readonly validationMetrics: ProbabilisticMetrics;
}

export interface CalibrationCandidateResult {
  readonly method: CalibrationModel["method"];
  readonly validationMetrics: ProbabilisticMetrics;
}

export interface FamilyWalkForwardEvidence {
  readonly estimatorType: SerializedEstimator["estimatorType"];
  readonly result: WalkForwardBacktestResult;
}

export interface PipelineResult {
  readonly source: FeatureDatasetSource;
  readonly policy: FeaturePolicy;
  readonly audit: ModelAudit;
  readonly baselineValidationMetrics: Readonly<Record<"constant-baseline" | "class-prior-baseline" | "elo-baseline", ProbabilisticMetrics>>;
  readonly logisticCandidates: readonly CandidateFitResult<LogisticRegressionConfig>[];
  readonly treeCandidates: readonly CandidateFitResult<GradientBoostedTreesConfig>[];
  readonly bestLogisticConfig: LogisticRegressionConfig;
  readonly bestTreeConfig: GradientBoostedTreesConfig;
  readonly walkForward: Readonly<Record<SerializedEstimator["estimatorType"], WalkForwardBacktestResult>>;
  readonly calibrationCandidates: readonly CalibrationCandidateResult[];
  readonly selectedEstimatorType: SerializedEstimator["estimatorType"];
  readonly selectionRationale: string;
  readonly calibrationRationale: string;
  readonly finalEstimator: SerializedEstimator;
  readonly finalCalibration: CalibrationModel;
  readonly preprocessor: PreprocessorState;
  readonly evaluation: EvaluationReport;
  readonly testPredictions: readonly RowPrediction[];
  readonly foldPredictions: readonly FoldPredictionRecord[];
  readonly reliabilityData: ReliabilityData;
  readonly featureImportance: FeatureImportanceReport;
  readonly errorAnalysis: ErrorAnalysisReport;
  readonly featureContract: FeatureContract;
  readonly modelVersion: string;
  /** The true train-split's own earliest row, not the whole dataset's earliest row (which may include canonical-window-excluded rows never used for training). */
  readonly trainDateRangeStartIso: string | null;
  readonly totalModelFits: number;
  readonly trainingRuntimeMs: number;
  readonly generatedAt: string;
}

function pickBest<TConfig>(candidates: readonly CandidateFitResult<TConfig>[]): CandidateFitResult<TConfig> {
  return [...candidates].sort((a, b) => a.validationMetrics.logLoss - b.validationMetrics.logLoss)[0]!;
}

export async function runModelTrainingPipeline(dataDir: string, generatedAt: string): Promise<PipelineResult> {
  const startedAtMs = Date.now();
  let totalModelFits = 0;

  const source = await loadFeatureDatasetSource(dataDir);
  const policy = buildFeaturePolicy(source.catalog);
  const splitRows = partitionBySplit(source.rows, source.splitAssignments);
  if (splitRows.train.length === 0 || splitRows.validation.length === 0 || splitRows.test.length === 0) {
    throw new ModelingError("insufficient_data", "One or more of train/validation/test splits is empty.");
  }

  // --- A. Feasibility audit (descriptive only; touches every split, fits nothing). ---
  const audit = buildModelFeasibilityAudit(source.rows, policy, source.splitAssignments, generatedAt);

  // TASK-044's walk-forward folds are built over the *entire* chronological
  // dataset (see docs/32 — 20% warm-up, 5 folds, expanding window). The
  // last fold's validation window is defined as "everything remaining",
  // which extends past the fixed train/validation boundary into rows the
  // fixed split calls "test". Using that fold for family/config selection
  // would leak test labels into the freeze decision (TASK-045 requirement
  // 21, "final test set remains untouched until selection is frozen"), so
  // every walk-forward fold whose validation window touches even one test
  // row is excluded from walk-forward evidence entirely — for selection
  // *and* for reporting, so the artifact never cites a fold that saw test
  // labels. See docs/33, "Walk-forward folds vs. the fixed test split".
  const testMatchIds = new Set(splitRows.test.map((r) => r.matchInternalId));
  const testSafeWalkForwardFolds = source.walkForwardFolds.filter((fold) => fold.validationMatchInternalIds.every((id) => !testMatchIds.has(id)));
  if (testSafeWalkForwardFolds.length === 0) {
    throw new ModelingError("insufficient_data", "No walk-forward fold's validation window is fully outside the fixed test split.");
  }

  // --- B. Baselines, evaluated on validation for candidate comparison. ---
  const trainLabels = splitRows.train.map((r) => r.labelTeamAWin);
  const validationLabels = splitRows.validation.map((r) => r.labelTeamAWin);
  const classPrior = fitClassPrior(splitRows.train);
  const baselineValidationMetrics = {
    "constant-baseline": computeMetrics(validationLabels, constantBaselinePredict(splitRows.validation)),
    "class-prior-baseline": computeMetrics(validationLabels, classPriorPredict(splitRows.validation, classPrior)),
    "elo-baseline": computeMetrics(validationLabels, eloBaselinePredict(splitRows.validation)),
  } as const;

  // --- C. Candidate training (small predeclared grids, evaluated on the fixed train/validation holdout). ---
  const preprocessorPrimary = fitPreprocessor(splitRows.train, policy);
  const trainMatrixPrimary = transformRows(splitRows.train, preprocessorPrimary).matrix;
  const validationMatrixPrimary = transformRows(splitRows.validation, preprocessorPrimary).matrix;

  const logisticCandidates: CandidateFitResult<LogisticRegressionConfig>[] = LOGISTIC_CANDIDATE_CONFIGS.map((config) => {
    const model = fitLogisticRegression(trainMatrixPrimary, trainLabels, preprocessorPrimary.featureNames, config);
    totalModelFits += 1;
    return { config, validationMetrics: computeMetrics(validationLabels, predictLogisticRegression(model, validationMatrixPrimary)) };
  });
  const treeCandidates: CandidateFitResult<GradientBoostedTreesConfig>[] = TREE_CANDIDATE_CONFIGS.map((config) => {
    const model = fitGradientBoostedTrees(trainMatrixPrimary, trainLabels, preprocessorPrimary.featureNames, config);
    totalModelFits += 1;
    return { config, validationMetrics: computeMetrics(validationLabels, predictGradientBoostedTrees(model, validationMatrixPrimary)) };
  });

  const bestLogisticConfig = pickBest(logisticCandidates).config;
  const bestTreeConfig = pickBest(treeCandidates).config;

  // --- D. Walk-forward backtest of every family (baselines + both learned winners), restricted to test-safe folds only. ---
  const logisticFoldFn = makeLogisticFoldFn(bestLogisticConfig, policy);
  const treeFoldFn = makeTreeFoldFn(bestTreeConfig, policy);

  const walkForward: Record<SerializedEstimator["estimatorType"], WalkForwardBacktestResult> = {
    "logistic-regression": runWalkForwardBacktest(testSafeWalkForwardFolds, source.rows, logisticFoldFn),
    "gradient-boosted-trees": runWalkForwardBacktest(testSafeWalkForwardFolds, source.rows, treeFoldFn),
    "elo-baseline": runWalkForwardBacktest(testSafeWalkForwardFolds, source.rows, eloFoldFn),
    "class-prior-baseline": runWalkForwardBacktest(testSafeWalkForwardFolds, source.rows, classPriorFoldFn),
    "constant-baseline": runWalkForwardBacktest(testSafeWalkForwardFolds, source.rows, constantFoldFn),
  };
  totalModelFits += testSafeWalkForwardFolds.length * 2; // logistic + tree fold fits (baselines fit no real model parameters).

  // --- E. Calibration — evaluated for the two learned families on validation predictions only, never test. ---
  const finalLogisticModel = fitLogisticRegression(trainMatrixPrimary, trainLabels, preprocessorPrimary.featureNames, bestLogisticConfig);
  const finalTreeModel = fitGradientBoostedTrees(trainMatrixPrimary, trainLabels, preprocessorPrimary.featureNames, bestTreeConfig);
  totalModelFits += 2;

  const logisticValidationRaw = predictLogisticRegression(finalLogisticModel, validationMatrixPrimary);
  const treeValidationRaw = predictGradientBoostedTrees(finalTreeModel, validationMatrixPrimary);

  function evaluateCalibrationCandidates(rawValidationPredictions: readonly number[]): CalibrationCandidateResult[] {
    const results: CalibrationCandidateResult[] = [{ method: "none", validationMetrics: computeMetrics(validationLabels, rawValidationPredictions) }];
    const sigmoidModel = fitSigmoidCalibration(rawValidationPredictions, validationLabels);
    results.push({ method: "sigmoid", validationMetrics: computeMetrics(validationLabels, applyCalibrationBatch(sigmoidModel, rawValidationPredictions)) });
    if (rawValidationPredictions.length >= MIN_ISOTONIC_SAMPLE_COUNT) {
      const isotonicModel = fitIsotonicCalibration(rawValidationPredictions, validationLabels);
      results.push({ method: "isotonic", validationMetrics: computeMetrics(validationLabels, applyCalibrationBatch(isotonicModel, rawValidationPredictions)) });
    }
    return results;
  }

  const logisticCalibrationCandidates = evaluateCalibrationCandidates(logisticValidationRaw);
  const treeCalibrationCandidates = evaluateCalibrationCandidates(treeValidationRaw);

  function bestCalibrationMethod(candidates: readonly CalibrationCandidateResult[]): CalibrationCandidateResult {
    return [...candidates].sort((a, b) => a.validationMetrics.logLoss - b.validationMetrics.logLoss)[0]!;
  }

  // --- F. Family selection — frozen using train/validation/walk-forward evidence only; test is never read above this line. ---
  const logisticEvidence = { walkForwardMeanLogLoss: walkForward["logistic-regression"].meanLogLoss, validationLogLoss: pickBest(logisticCandidates).validationMetrics.logLoss };
  const treeEvidence = { walkForwardMeanLogLoss: walkForward["gradient-boosted-trees"].meanLogLoss, validationLogLoss: pickBest(treeCandidates).validationMetrics.logLoss };
  const eloEvidence = { walkForwardMeanLogLoss: walkForward["elo-baseline"].meanLogLoss };

  const logisticIsBetter = logisticEvidence.walkForwardMeanLogLoss <= treeEvidence.walkForwardMeanLogLoss;
  const learnedBestType: "logistic-regression" | "gradient-boosted-trees" = logisticIsBetter ? "logistic-regression" : "gradient-boosted-trees";
  const learnedBestLogLoss = logisticIsBetter ? logisticEvidence.walkForwardMeanLogLoss : treeEvidence.walkForwardMeanLogLoss;
  const learnedOtherLogLoss = logisticIsBetter ? treeEvidence.walkForwardMeanLogLoss : logisticEvidence.walkForwardMeanLogLoss;
  const improvementOverElo = eloEvidence.walkForwardMeanLogLoss - learnedBestLogLoss;

  let selectedEstimatorType: SerializedEstimator["estimatorType"];
  let selectionRationale: string;
  if (improvementOverElo <= MIN_IMPROVEMENT_OVER_ELO_LOG_LOSS) {
    selectedEstimatorType = "elo-baseline";
    selectionRationale = `Neither learned candidate's walk-forward mean log loss (logistic ${logisticEvidence.walkForwardMeanLogLoss.toFixed(4)}, tree ${treeEvidence.walkForwardMeanLogLoss.toFixed(4)}) beats the Elo baseline (${eloEvidence.walkForwardMeanLogLoss.toFixed(4)}) on this dataset; selecting Elo per the conservative-fallback rule (TASK-045 requirement 11) rather than a learned model chosen on noise.`;
  } else if (Math.abs(logisticEvidence.walkForwardMeanLogLoss - treeEvidence.walkForwardMeanLogLoss) <= FAMILY_INDISTINGUISHABLE_LOG_LOSS_EPSILON) {
    selectedEstimatorType = "logistic-regression";
    selectionRationale = `Logistic regression (${logisticEvidence.walkForwardMeanLogLoss.toFixed(4)}) and the gradient-boosted-tree ensemble (${treeEvidence.walkForwardMeanLogLoss.toFixed(4)}) are within ${FAMILY_INDISTINGUISHABLE_LOG_LOSS_EPSILON} walk-forward mean log loss of each other — statistically indistinguishable at this dataset's size — so the simpler, more portable model (logistic regression) is selected per the simplicity tie-break rule.`;
  } else {
    selectedEstimatorType = learnedBestType;
    selectionRationale = `${learnedBestType} has the lowest walk-forward mean log loss (${learnedBestLogLoss.toFixed(4)} vs ${learnedOtherLogLoss.toFixed(4)} for the other learned family and ${eloEvidence.walkForwardMeanLogLoss.toFixed(4)} for Elo), a margin larger than both the family-indistinguishability threshold and the minimum-improvement-over-Elo threshold, evaluated across every walk-forward fold rather than a single holdout split.`;
  }

  // --- Final calibration for the selected family (baselines use no calibration). ---
  let finalCalibration: CalibrationModel = { method: "none" };
  let calibrationRationale = "Selected estimator is a non-learned baseline; no calibration is applied.";
  if (selectedEstimatorType === "logistic-regression" || selectedEstimatorType === "gradient-boosted-trees") {
    const rawValidationPredictions = selectedEstimatorType === "logistic-regression" ? logisticValidationRaw : treeValidationRaw;
    const candidates = selectedEstimatorType === "logistic-regression" ? logisticCalibrationCandidates : treeCalibrationCandidates;
    const best = bestCalibrationMethod(candidates);
    calibrationRationale = `"${best.method}" calibration has the lowest validation log loss (${best.validationMetrics.logLoss.toFixed(4)}) among {${candidates.map((c) => c.method).join(", ")}} evaluated on the validation split.`;
    if (best.method === "sigmoid") finalCalibration = fitSigmoidCalibration(rawValidationPredictions, validationLabels);
    else if (best.method === "isotonic") finalCalibration = fitIsotonicCalibration(rawValidationPredictions, validationLabels);
  }

  // --- G. Final test evaluation — the single, frozen pass over the held-out test split. ---
  const testLabels = splitRows.test.map((r) => r.labelTeamAWin);
  const testMatrixPrimary = transformRows(splitRows.test, preprocessorPrimary).matrix;

  let finalEstimator: SerializedEstimator;
  let testRawPredictions: readonly number[];
  if (selectedEstimatorType === "logistic-regression") {
    finalEstimator = { estimatorType: "logistic-regression", weights: finalLogisticModel.weights, bias: finalLogisticModel.bias, featureNames: finalLogisticModel.featureNames, config: bestLogisticConfig };
    testRawPredictions = predictLogisticRegression(finalLogisticModel, testMatrixPrimary);
  } else if (selectedEstimatorType === "gradient-boosted-trees") {
    finalEstimator = { estimatorType: "gradient-boosted-trees", trees: finalTreeModel.trees, initialLogOdds: finalTreeModel.initialLogOdds, featureNames: finalTreeModel.featureNames, config: bestTreeConfig };
    testRawPredictions = predictGradientBoostedTrees(finalTreeModel, testMatrixPrimary);
  } else if (selectedEstimatorType === "elo-baseline") {
    finalEstimator = { estimatorType: "elo-baseline" };
    testRawPredictions = eloBaselinePredict(splitRows.test);
  } else if (selectedEstimatorType === "class-prior-baseline") {
    finalEstimator = { estimatorType: "class-prior-baseline", prior: classPrior };
    testRawPredictions = classPriorPredict(splitRows.test, classPrior);
  } else {
    finalEstimator = { estimatorType: "constant-baseline", value: 0.5 };
    testRawPredictions = constantBaselinePredict(splitRows.test);
  }

  const testCalibratedPredictions = applyCalibrationBatch(finalCalibration, testRawPredictions);

  const baselineTestMetrics = {
    "constant-baseline": computeMetrics(testLabels, constantBaselinePredict(splitRows.test)),
    "class-prior-baseline": computeMetrics(testLabels, classPriorPredict(splitRows.test, classPrior)),
    "elo-baseline": computeMetrics(testLabels, eloBaselinePredict(splitRows.test)),
  };

  const uncertainty: TestSetUncertainty = computeTestSetUncertainty(testLabels, testCalibratedPredictions, eloBaselinePredict(splitRows.test), RANDOM_SEED);

  const testPredictions: RowPrediction[] = splitRows.test.map((row, i) => ({
    matchInternalId: row.matchInternalId,
    predictedRaw: testRawPredictions[i]!,
    predictedCalibrated: testCalibratedPredictions[i]!,
    actual: testLabels[i]!,
  }));

  const selectedWalkForward = walkForward[selectedEstimatorType];
  const foldPredictions: FoldPredictionRecord[] = selectedWalkForward.folds.map((fold) => ({ foldId: fold.foldId, predictions: fold.predictions.map((p) => ({ matchInternalId: p.matchInternalId, predicted: p.predicted, actual: p.actual })) }));

  const evaluation: EvaluationReport = {
    baselineTestMetrics,
    validationMetrics: selectedEstimatorType === "logistic-regression" ? computeMetrics(validationLabels, logisticValidationRaw) : selectedEstimatorType === "gradient-boosted-trees" ? computeMetrics(validationLabels, treeValidationRaw) : baselineValidationMetrics[selectedEstimatorType],
    walkForward: {
      meanLogLoss: selectedWalkForward.meanLogLoss,
      medianLogLoss: selectedWalkForward.medianLogLoss,
      meanBrierScore: selectedWalkForward.meanBrierScore,
      pooledMetrics: selectedWalkForward.pooledMetrics,
      folds: selectedWalkForward.folds.map((f) => ({ foldId: f.foldId, trainRowCount: f.trainRowCount, validationRowCount: f.validationRowCount, trainStartIso: f.trainStartIso, trainEndIso: f.trainEndIso, validationStartIso: f.validationStartIso, validationEndIso: f.validationEndIso, metrics: f.metrics })),
    },
    testMetricsUncalibrated: computeMetrics(testLabels, testRawPredictions),
    testMetricsCalibrated: computeMetrics(testLabels, testCalibratedPredictions),
    uncertainty,
  };

  const reliabilityData: ReliabilityData = {
    preCalibration: reliabilityBins(testLabels, testRawPredictions),
    postCalibration: reliabilityBins(testLabels, testCalibratedPredictions),
  };

  const errorAnalysis = buildErrorAnalysis(splitRows.test, testPredictions);

  const featureImportance: FeatureImportanceReport =
    selectedEstimatorType === "logistic-regression"
      ? logisticFeatureImportance(finalLogisticModel)
      : selectedEstimatorType === "gradient-boosted-trees"
        ? permutationFeatureImportance(finalTreeModel, testMatrixPrimary, testLabels, preprocessorPrimary.featureNames)
        : { method: "standardized-coefficient", topPositive: [], topNegative: [], unstableFeatures: [], zeroOrUnusedFeatures: [], caveat: "Selected estimator is a non-learned baseline; no feature importance applies." };

  const featureContract: FeatureContract = {
    featureSchemaVersion: source.manifest.featureSchemaVersion,
    featureRulesVersion: source.manifest.featureRulesVersion,
    numericFields: preprocessorPrimary.numericFields,
    nullableNumericFields: preprocessorPrimary.nullableNumericFields,
    booleanFields: preprocessorPrimary.booleanFields,
    categoricalFields: preprocessorPrimary.categoricalFields,
    categoricalVocabulary: preprocessorPrimary.vocabularyByField,
    encodedFeatureNames: preprocessorPrimary.featureNames,
    excludedFields: policy.excludedFields,
    requiredInputFields: policy.allInputFields,
    outputSchema: { teamAWinProbability: "number in [0, 1]", teamBWinProbability: "number in [0, 1] (always 1 - teamAWinProbability)" },
  };

  const modelVersion = computeModelVersion({
    featureDatasetVersion: source.manifest.featureDatasetVersion,
    preprocessingConfig: preprocessorPrimary,
    estimatorConfig: finalEstimator,
    calibrationConfig: finalCalibration,
  });

  const trainingRuntimeMs = Date.now() - startedAtMs;

  return {
    source,
    policy,
    audit,
    baselineValidationMetrics,
    logisticCandidates,
    treeCandidates,
    bestLogisticConfig,
    bestTreeConfig,
    walkForward,
    calibrationCandidates: selectedEstimatorType === "gradient-boosted-trees" ? treeCalibrationCandidates : logisticCalibrationCandidates,
    selectedEstimatorType,
    selectionRationale,
    calibrationRationale,
    finalEstimator,
    finalCalibration,
    preprocessor: preprocessorPrimary,
    evaluation,
    testPredictions,
    foldPredictions,
    reliabilityData,
    featureImportance,
    errorAnalysis,
    featureContract,
    modelVersion,
    trainDateRangeStartIso: splitRows.train[0]?.scheduledAt ?? null,
    totalModelFits,
    trainingRuntimeMs,
    generatedAt,
  };
}

export function buildModelManifest(result: PipelineResult): ModelManifest {
  return {
    modelVersion: result.modelVersion,
    modelingRulesVersion: "vlr-modeling-rules@1.0.0",
    sourceFeatureDatasetVersion: result.source.manifest.featureDatasetVersion,
    featureSchemaVersion: result.source.manifest.featureSchemaVersion,
    featureRulesVersion: result.source.manifest.featureRulesVersion,
    estimatorType: result.selectedEstimatorType,
    calibrationMethod: result.finalCalibration.method,
    randomSeed: RANDOM_SEED,
    trainRowCount: result.source.splitSummary.boundaries.trainRowCount,
    validationRowCount: result.source.splitSummary.boundaries.validationRowCount,
    testRowCount: result.source.splitSummary.boundaries.testRowCount,
    trainDateRangeStartIso: result.trainDateRangeStartIso,
    trainDateRangeEndIso: result.source.splitSummary.boundaries.trainEndIso,
    reportingThreshold: REPORTING_THRESHOLD,
    probabilityClippingEpsilon: PROBABILITY_CLIPPING_EPSILON,
    nodeRuntimeVersion: process.version,
    typescriptVersion,
    generatedAt: result.generatedAt,
    selectionRationale: result.selectionRationale,
    contentHashes: {},
  };
}

export function buildArtifactFiles(result: PipelineResult, manifest: ModelManifest, modelCard: ModelCard): ModelArtifactFiles {
  return {
    "model.json": result.finalEstimator,
    "preprocessing.json": result.preprocessor,
    "calibration.json": result.finalCalibration,
    "feature-contract.json": result.featureContract,
    "model-manifest.json": manifest,
    "model-card.json": modelCard,
    "evaluation.json": result.evaluation,
    "test-predictions.json": result.testPredictions,
    "fold-predictions.json": result.foldPredictions,
    "reliability-data.json": result.reliabilityData,
    "feature-importance.json": result.featureImportance,
  };
}
