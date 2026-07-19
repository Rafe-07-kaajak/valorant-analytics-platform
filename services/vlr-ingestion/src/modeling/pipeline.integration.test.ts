import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_CATALOG } from "../feature/featureCatalog";
import { buildMockFeatureRow, resetMockFeatureRowCounter } from "./testUtils/mockFeatureRow";
import { runModelTrainingPipeline, buildModelManifest, buildArtifactFiles } from "./pipeline";
import { buildModelCard } from "./modelCard";
import { writeModelArtifact, loadModelArtifactForInference } from "./artifact";
import { predict } from "./inference";
import type { FeatureRow } from "../feature/types";
import type { WalkForwardFold } from "../feature/splits";

/**
 * End-to-end integration test — TASK-045 requirement 23. Exercises the full
 * audit → train → backtest → calibrate → select → artifact pipeline against
 * a small synthetic feature dataset (never the real 432-row dataset, so
 * this test stays fast and hermetic), then verifies chronological splits,
 * artifact reload/prediction parity, and deterministic repeat runs.
 */

function buildSyntheticRows(count: number): FeatureRow[] {
  resetMockFeatureRowCounter();
  const rows: FeatureRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const scheduledAt = new Date(2025, 0, 1 + i).toISOString();
    const eloA = 1400 + (i % 5) * 40;
    rows.push(
      buildMockFeatureRow({
        matchInternalId: `vlr:match:s${i}`,
        providerMatchId: `s${i}`,
        scheduledAt,
        teamAProviderId: `vlr:team:${i % 6}`,
        teamBProviderId: `vlr:team:${(i + 1) % 6}`,
        teamAEloRating: eloA,
        teamAEloWinProbability: eloA > 1450 ? 0.6 : 0.4,
        eventFamily: i % 2 === 0 ? "vct-americas" : "masters",
        labelTeamAWin: i % 3 === 0 ? 1 : 0,
      }),
    );
  }
  return rows;
}

function buildSplitAssignments(rows: readonly FeatureRow[]) {
  const trainEnd = Math.floor(rows.length * 0.6);
  const validationEnd = Math.floor(rows.length * 0.8);
  return rows.map((row, i) => ({ matchInternalId: row.matchInternalId, scheduledAt: row.scheduledAt, split: i < trainEnd ? "train" : i < validationEnd ? "validation" : "test" }) as const);
}

function buildWalkForwardFolds(rows: readonly FeatureRow[]): WalkForwardFold[] {
  // Two folds, both fully inside train+validation (never touching the last 20% "test" rows) — mirrors TASK-044's own construction closely enough for this hermetic test.
  const trainEnd = Math.floor(rows.length * 0.6);
  const midpoint = Math.floor(trainEnd * 0.5);
  return [
    { foldId: 0, trainRowCount: midpoint, validationRowCount: trainEnd - midpoint, trainStartIso: rows[0]!.scheduledAt, trainEndIso: rows[midpoint - 1]!.scheduledAt, validationStartIso: rows[midpoint]!.scheduledAt, validationEndIso: rows[trainEnd - 1]!.scheduledAt, trainMatchInternalIds: rows.slice(0, midpoint).map((r) => r.matchInternalId), validationMatchInternalIds: rows.slice(midpoint, trainEnd).map((r) => r.matchInternalId) },
  ];
}

async function writeSyntheticFeatureDataset(dataDir: string, rowCount: number) {
  const rows = buildSyntheticRows(rowCount);
  const splitAssignments = buildSplitAssignments(rows);
  const walkForwardFolds = buildWalkForwardFolds(rows);
  const boundaries = { trainRowCount: splitAssignments.filter((a) => a.split === "train").length, validationRowCount: splitAssignments.filter((a) => a.split === "validation").length, testRowCount: splitAssignments.filter((a) => a.split === "test").length, trainEndIso: null, validationEndIso: null };
  const splitSummary = { boundaries, train: { rowCount: boundaries.trainRowCount, byYear: {}, byEventFamily: {}, coldStartRate: 0 }, validation: { rowCount: boundaries.validationRowCount, byYear: {}, byEventFamily: {}, coldStartRate: 0 }, test: { rowCount: boundaries.testRowCount, byYear: {}, byEventFamily: {}, coldStartRate: 0 } };

  const featuresDir = join(dataDir, "features");
  await mkdir(featuresDir, { recursive: true });
  await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify(rows), "utf-8");
  await writeFile(join(featuresDir, "feature-catalog.json"), JSON.stringify(FEATURE_CATALOG), "utf-8");
  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify({ featureDatasetVersion: "synthetic-v1", featureSchemaVersion: "vlr-feature-schema@1.0.0", featureRulesVersion: "vlr-feature-rules@1.0.0", ratingConfigVersion: "vlr-elo@1.0.0", sourceDatasetVersion: "synthetic-src", generatedAt: "2026-01-01T00:00:00.000Z", rowCount: rows.length, featureCount: 161, targetCount: 4, rejectedMatchCount: 0, trainRowCount: boundaries.trainRowCount, validationRowCount: boundaries.validationRowCount, testRowCount: boundaries.testRowCount, walkForwardFoldCount: walkForwardFolds.length, validationErrorCount: 0, validationWarningCount: 0 }), "utf-8");
  await writeFile(join(featuresDir, "split-assignments.json"), JSON.stringify({ summary: splitSummary, assignments: splitAssignments }), "utf-8");
  await writeFile(join(featuresDir, "walk-forward-folds.json"), JSON.stringify(walkForwardFolds), "utf-8");

  return { rows, splitAssignments, walkForwardFolds };
}

describe("runModelTrainingPipeline (synthetic integration)", () => {
  it("runs the full audit -> train -> backtest -> calibrate -> select -> artifact workflow end to end", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    await writeSyntheticFeatureDataset(dataDir, 60);

    const result = await runModelTrainingPipeline(dataDir, "2026-01-01T00:00:00.000Z");

    expect(result.audit.rowCount).toBe(60);
    expect(result.logisticCandidates.length).toBeGreaterThan(0);
    expect(result.treeCandidates.length).toBeGreaterThan(0);
    expect(["logistic-regression", "gradient-boosted-trees", "elo-baseline", "class-prior-baseline", "constant-baseline"]).toContain(result.selectedEstimatorType);
    expect(result.evaluation.testMetricsCalibrated.sampleCount).toBeGreaterThan(0);
    expect(result.testPredictions.length).toBe(result.evaluation.testMetricsCalibrated.sampleCount);
  });

  it("never uses a test-split row inside walk-forward fold predictions", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    const { splitAssignments } = await writeSyntheticFeatureDataset(dataDir, 60);
    const testIds = new Set(splitAssignments.filter((a) => a.split === "test").map((a) => a.matchInternalId));

    const result = await runModelTrainingPipeline(dataDir, "2026-01-01T00:00:00.000Z");
    for (const fold of result.walkForward[result.selectedEstimatorType].folds) {
      for (const prediction of fold.predictions) expect(testIds.has(prediction.matchInternalId)).toBe(false);
    }
  });

  it("artifact reload produces predictions matching the training-time predictions (parity)", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    await writeSyntheticFeatureDataset(dataDir, 60);

    const result = await runModelTrainingPipeline(dataDir, "2026-01-01T00:00:00.000Z");
    const manifest = buildModelManifest(result);
    const modelCard = buildModelCard(result);
    await writeModelArtifact(dataDir, buildArtifactFiles(result, manifest, modelCard));

    const artifact = await loadModelArtifactForInference(dataDir);
    const firstTestRow = result.source.rows.find((r) => r.matchInternalId === result.testPredictions[0]!.matchInternalId)!;
    const inferenceResult = predict(artifact, firstTestRow as unknown as Record<string, string | number | boolean | null>);
    expect(inferenceResult.teamAWinProbability).toBeCloseTo(result.testPredictions[0]!.predictedCalibrated, 9);
  });

  it("repeat training runs on identical input produce the same model version and identical non-timestamp artifact content (idempotency)", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    await writeSyntheticFeatureDataset(dataDir, 60);

    const runA = await runModelTrainingPipeline(dataDir, "2026-01-01T00:00:00.000Z");
    const runB = await runModelTrainingPipeline(dataDir, "2026-06-01T00:00:00.000Z"); // Different generatedAt, same input.

    expect(runA.modelVersion).toBe(runB.modelVersion);
    expect(runA.selectedEstimatorType).toBe(runB.selectedEstimatorType);
    expect(runA.evaluation.testMetricsCalibrated).toEqual(runB.evaluation.testMetricsCalibrated);
    expect(runA.testPredictions).toEqual(runB.testPredictions);
  });

  it("a feature-dataset-version change changes the model version even when nothing else changes", async () => {
    const dataDirA = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    await writeSyntheticFeatureDataset(dataDirA, 60);
    const runA = await runModelTrainingPipeline(dataDirA, "2026-01-01T00:00:00.000Z");

    const dataDirB = await mkdtemp(join(tmpdir(), "vlr-model-pipeline-test-"));
    await writeSyntheticFeatureDataset(dataDirB, 60);
    const manifestPath = join(dataDirB, "features", "feature-manifest.json");
    const manifest = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(manifestPath, "utf-8")));
    manifest.featureDatasetVersion = "synthetic-v2-different";
    await writeFile(manifestPath, JSON.stringify(manifest), "utf-8");
    const runB = await runModelTrainingPipeline(dataDirB, "2026-01-01T00:00:00.000Z");

    expect(runA.modelVersion).not.toBe(runB.modelVersion);
  });
});
