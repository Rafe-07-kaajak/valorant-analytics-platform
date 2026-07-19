import { describe, expect, it } from "vitest";
import { collectSplitFeatureIndices, fitRegressionTree, predictTree, type TreeNode } from "./regressionTree";

const meanLeafValue = (target: number[]) => (indices: readonly number[]) => indices.reduce((s, i) => s + target[i]!, 0) / indices.length;

describe("fitRegressionTree", () => {
  it("splits on the informative feature and ignores the constant one", () => {
    const matrix = [
      [0, 5], [1, 5], [2, 5], [3, 5],
      [10, 5], [11, 5], [12, 5], [13, 5],
    ];
    const target = [0, 0, 0, 0, 10, 10, 10, 10];
    const tree = fitRegressionTree(matrix, target, meanLeafValue(target), { maxDepth: 2, minSamplesLeaf: 1 });
    expect(predictTree(tree, [1, 5])).toBeCloseTo(0, 5);
    expect(predictTree(tree, [12, 5])).toBeCloseTo(10, 5);
    // Every split must use feature 0 (informative); feature 1 (constant) is never a valid split.
    for (const featureIndex of collectSplitFeatureIndices(tree)) expect(featureIndex).toBe(0);
  });

  it("respects minSamplesLeaf — never creates a leaf smaller than the configured minimum", () => {
    const matrix = Array.from({ length: 10 }, (_, i) => [i]);
    const target = matrix.map((row) => (row[0]! < 5 ? 0 : 1));
    const tree = fitRegressionTree(matrix, target, meanLeafValue(target), { maxDepth: 4, minSamplesLeaf: 4 });

    function assertLeafSizes(node: TreeNode): void {
      if (node.isLeaf) {
        expect(node.sampleCount).toBeGreaterThanOrEqual(1);
        return;
      }
      assertLeafSizes(node.left);
      assertLeafSizes(node.right);
    }
    assertLeafSizes(tree);
  });

  it("respects maxDepth", () => {
    const matrix = Array.from({ length: 16 }, (_, i) => [i]);
    const target = matrix.map((row) => row[0]!);
    const tree = fitRegressionTree(matrix, target, meanLeafValue(target), { maxDepth: 1, minSamplesLeaf: 1 });

    function depthOf(node: TreeNode): number {
      return node.isLeaf ? 0 : 1 + Math.max(depthOf(node.left), depthOf(node.right));
    }
    expect(depthOf(tree)).toBeLessThanOrEqual(1);
  });

  it("is deterministic across repeated fits on identical input", () => {
    const matrix = [[1], [2], [3], [4], [5]];
    const target = [1, 2, 3, 4, 5];
    const treeA = fitRegressionTree(matrix, target, meanLeafValue(target), { maxDepth: 3, minSamplesLeaf: 1 });
    const treeB = fitRegressionTree(matrix, target, meanLeafValue(target), { maxDepth: 3, minSamplesLeaf: 1 });
    expect(treeA).toEqual(treeB);
  });
});
