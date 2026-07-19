import type { FeatureRow } from "../feature/types";
import type { FeaturePolicy } from "./featurePolicy";
import { fitPreprocessor, transformRows } from "./preprocessing";
import { fitLogisticRegression, predictLogisticRegression, type LogisticRegressionConfig } from "./logisticRegression";
import { fitGradientBoostedTrees, predictGradientBoostedTrees, type GradientBoostedTreesConfig } from "./gradientBoostedTrees";
import { constantBaselinePredict, eloBaselinePredict, fitClassPrior, classPriorPredict } from "./baselines";

/**
 * Predeclared candidate configurations — TASK-045 requirement 10. Both
 * grids are small and fixed ahead of time (no random/broad search, no
 * AutoML); every fit is reported (see `pipeline.ts`, "fit count"). A
 * fold-model function is a self-contained "fit preprocessing + fit model on
 * `trainRows`, predict on `evalRows`" closure, so `backtest.ts` can treat
 * every candidate — baseline or learned — identically.
 */

export type FoldModelFn = (trainRows: readonly FeatureRow[], evalRows: readonly FeatureRow[]) => readonly number[];

export const LOGISTIC_CANDIDATE_CONFIGS: readonly LogisticRegressionConfig[] = [
  { l2Lambda: 0.01, iterations: 1000, learningRate: 0.05 },
  { l2Lambda: 0.1, iterations: 1000, learningRate: 0.05 },
  { l2Lambda: 1.0, iterations: 1000, learningRate: 0.05 },
];

export const TREE_CANDIDATE_CONFIGS: readonly GradientBoostedTreesConfig[] = [
  { maxDepth: 2, learningRate: 0.05, numTrees: 100, minSamplesLeaf: 10 },
  { maxDepth: 2, learningRate: 0.1, numTrees: 100, minSamplesLeaf: 10 },
  { maxDepth: 3, learningRate: 0.05, numTrees: 100, minSamplesLeaf: 10 },
  { maxDepth: 3, learningRate: 0.1, numTrees: 100, minSamplesLeaf: 10 },
];

export function makeLogisticFoldFn(config: LogisticRegressionConfig, policy: FeaturePolicy): FoldModelFn {
  return (trainRows, evalRows) => {
    const preprocessor = fitPreprocessor(trainRows, policy);
    const trainMatrix = transformRows(trainRows, preprocessor);
    const evalMatrix = transformRows(evalRows, preprocessor);
    const labels = trainRows.map((r) => r.labelTeamAWin);
    const model = fitLogisticRegression(trainMatrix.matrix, labels, preprocessor.featureNames, config);
    return predictLogisticRegression(model, evalMatrix.matrix);
  };
}

export function makeTreeFoldFn(config: GradientBoostedTreesConfig, policy: FeaturePolicy): FoldModelFn {
  return (trainRows, evalRows) => {
    const preprocessor = fitPreprocessor(trainRows, policy);
    const trainMatrix = transformRows(trainRows, preprocessor);
    const evalMatrix = transformRows(evalRows, preprocessor);
    const labels = trainRows.map((r) => r.labelTeamAWin);
    const model = fitGradientBoostedTrees(trainMatrix.matrix, labels, preprocessor.featureNames, config);
    return predictGradientBoostedTrees(model, evalMatrix.matrix);
  };
}

export const constantFoldFn: FoldModelFn = (_trainRows, evalRows) => constantBaselinePredict(evalRows);

export const classPriorFoldFn: FoldModelFn = (trainRows, evalRows) => classPriorPredict(evalRows, fitClassPrior(trainRows));

export const eloFoldFn: FoldModelFn = (_trainRows, evalRows) => eloBaselinePredict(evalRows);
