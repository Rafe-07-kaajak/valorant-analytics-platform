/**
 * A single CART-style regression tree — the base learner for the
 * gradient-boosted ensemble (TASK-045 requirement 4C). Split selection
 * minimizes unweighted sum-of-squared-error over a numeric target
 * (Friedman's generic gradient-boosting formulation fits each tree to the
 * current pseudo-residuals by least squares); the caller supplies a
 * separate `leafValueFn` so gradient-boosted classification can assign each
 * leaf a Newton-step value instead of the plain residual mean. Bounded
 * complexity by construction: `maxDepth` and `minSamplesLeaf` are the only
 * two knobs, both small and predeclared (TASK-045 requirement 10).
 */

export interface RegressionTreeConfig {
  readonly maxDepth: number;
  readonly minSamplesLeaf: number;
}

export type TreeNode =
  | { readonly isLeaf: true; readonly value: number; readonly sampleCount: number }
  | { readonly isLeaf: false; readonly featureIndex: number; readonly threshold: number; readonly left: TreeNode; readonly right: TreeNode };

function sumOfSquares(values: readonly number[], indices: readonly number[]): number {
  if (indices.length === 0) return 0;
  let sum = 0;
  for (const i of indices) sum += values[i]!;
  const mean = sum / indices.length;
  let sse = 0;
  for (const i of indices) sse += (values[i]! - mean) ** 2;
  return sse;
}

function bestSplitForFeature(matrix: readonly (readonly number[])[], target: readonly number[], indices: readonly number[], featureIndex: number, minSamplesLeaf: number): { threshold: number; sse: number } | null {
  const sorted = [...indices].sort((a, b) => matrix[a]![featureIndex]! - matrix[b]![featureIndex]!);
  let best: { threshold: number; sse: number } | null = null;

  for (let cut = minSamplesLeaf; cut <= sorted.length - minSamplesLeaf; cut += 1) {
    const leftValue = matrix[sorted[cut - 1]!]![featureIndex]!;
    const rightValue = matrix[sorted[cut]!]![featureIndex]!;
    if (leftValue === rightValue) continue; // Not a valid split point (identical values straddle the cut).
    const threshold = (leftValue + rightValue) / 2;
    const leftIndices = sorted.slice(0, cut);
    const rightIndices = sorted.slice(cut);
    const sse = sumOfSquares(target, leftIndices) + sumOfSquares(target, rightIndices);
    if (best === null || sse < best.sse) best = { threshold, sse };
  }
  return best;
}

function buildNode(matrix: readonly (readonly number[])[], target: readonly number[], indices: readonly number[], leafValueFn: (indices: readonly number[]) => number, depth: number, config: RegressionTreeConfig): TreeNode {
  const makeLeaf = (): TreeNode => ({ isLeaf: true, value: leafValueFn(indices), sampleCount: indices.length });

  if (depth >= config.maxDepth || indices.length < 2 * config.minSamplesLeaf) return makeLeaf();

  const featureCount = matrix[0]?.length ?? 0;
  let bestFeatureIndex = -1;
  let bestThreshold = 0;
  let bestSse = sumOfSquares(target, indices);

  for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
    const candidate = bestSplitForFeature(matrix, target, indices, featureIndex, config.minSamplesLeaf);
    if (candidate !== null && candidate.sse < bestSse) {
      bestSse = candidate.sse;
      bestFeatureIndex = featureIndex;
      bestThreshold = candidate.threshold;
    }
  }

  if (bestFeatureIndex === -1) return makeLeaf();

  const leftIndices = indices.filter((i) => matrix[i]![bestFeatureIndex]! <= bestThreshold);
  const rightIndices = indices.filter((i) => matrix[i]![bestFeatureIndex]! > bestThreshold);
  if (leftIndices.length === 0 || rightIndices.length === 0) return makeLeaf();

  return {
    isLeaf: false,
    featureIndex: bestFeatureIndex,
    threshold: bestThreshold,
    left: buildNode(matrix, target, leftIndices, leafValueFn, depth + 1, config),
    right: buildNode(matrix, target, rightIndices, leafValueFn, depth + 1, config),
  };
}

export function fitRegressionTree(matrix: readonly (readonly number[])[], target: readonly number[], leafValueFn: (indices: readonly number[]) => number, config: RegressionTreeConfig): TreeNode {
  const allIndices = target.map((_, i) => i);
  return buildNode(matrix, target, allIndices, leafValueFn, 0, config);
}

export function predictTree(node: TreeNode, row: readonly number[]): number {
  let current = node;
  while (!current.isLeaf) {
    current = row[current.featureIndex]! <= current.threshold ? current.left : current.right;
  }
  return current.value;
}

/** Collects every `(featureIndex, sampleCount)` split decision in the tree — used by permutation-importance-adjacent diagnostics and tests. */
export function collectSplitFeatureIndices(node: TreeNode): readonly number[] {
  if (node.isLeaf) return [];
  return [node.featureIndex, ...collectSplitFeatureIndices(node.left), ...collectSplitFeatureIndices(node.right)];
}
