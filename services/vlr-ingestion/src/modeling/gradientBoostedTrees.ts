import { fitRegressionTree, predictTree, type RegressionTreeConfig, type TreeNode } from "./regressionTree";

/**
 * Gradient-boosted trees for binary classification (logistic/binomial
 * deviance loss) — TASK-045 requirement 4C. Friedman's generic algorithm:
 * each tree is fit by least squares to the current logit-space pseudo-
 * residual `y - p`, and each leaf's output is then replaced by a one-step
 * Newton approximation (`sum(residual) / sum(p * (1 - p))`) rather than the
 * plain residual mean — the same leaf-value refinement scikit-learn's
 * `GradientBoostingClassifier` and XGBoost both use. No margin sampling, no
 * row/feature subsampling, no randomness anywhere in the fit, so no seed is
 * needed for it to reproduce identically.
 */

export interface GradientBoostedTreesConfig {
  readonly maxDepth: number;
  readonly learningRate: number;
  readonly numTrees: number;
  readonly minSamplesLeaf: number;
}

export interface GradientBoostedTreesModel {
  readonly trees: readonly TreeNode[];
  readonly initialLogOdds: number;
  readonly featureNames: readonly string[];
  readonly config: GradientBoostedTreesConfig;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function logit(p: number): number {
  const clipped = Math.min(1 - 1e-15, Math.max(1e-15, p));
  return Math.log(clipped / (1 - clipped));
}

const MIN_LEAF_WEIGHT = 1e-6;

export function fitGradientBoostedTrees(matrix: readonly (readonly number[])[], labels: readonly number[], featureNames: readonly string[], config: GradientBoostedTreesConfig): GradientBoostedTreesModel {
  const n = matrix.length;
  const positiveRate = n > 0 ? labels.reduce((sum, y) => sum + y, 0) / n : 0.5;
  const initialLogOdds = logit(positiveRate);
  const rawScores = new Array<number>(n).fill(initialLogOdds);
  const treeConfig: RegressionTreeConfig = { maxDepth: config.maxDepth, minSamplesLeaf: config.minSamplesLeaf };
  const trees: TreeNode[] = [];

  for (let t = 0; t < config.numTrees; t += 1) {
    const probs = rawScores.map(sigmoid);
    const residuals = labels.map((y, i) => y - probs[i]!);
    const leafWeights = probs.map((p) => Math.max(MIN_LEAF_WEIGHT, p * (1 - p)));

    const leafValueFn = (indices: readonly number[]): number => {
      let sumResidual = 0;
      let sumWeight = 0;
      for (const i of indices) {
        sumResidual += residuals[i]!;
        sumWeight += leafWeights[i]!;
      }
      return sumWeight > 0 ? sumResidual / sumWeight : 0;
    };

    const tree = fitRegressionTree(matrix, residuals, leafValueFn, treeConfig);
    trees.push(tree);
    for (let i = 0; i < n; i += 1) rawScores[i] += config.learningRate * predictTree(tree, matrix[i]!);
  }

  return { trees, initialLogOdds, featureNames, config };
}

export function predictGradientBoostedTrees(model: GradientBoostedTreesModel, matrix: readonly (readonly number[])[]): readonly number[] {
  return matrix.map((row) => predictGradientBoostedTreesSingle(model, row));
}

export function predictGradientBoostedTreesSingle(model: GradientBoostedTreesModel, row: readonly number[]): number {
  let score = model.initialLogOdds;
  for (const tree of model.trees) score += model.config.learningRate * predictTree(tree, row);
  return sigmoid(score);
}
