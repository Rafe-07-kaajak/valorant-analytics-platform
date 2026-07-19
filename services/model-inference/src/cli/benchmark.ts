import { writeFile } from "node:fs/promises";
import { loadModelInferenceConfig } from "../config";
import { PredictionService, MAX_BATCH_SIZE } from "../predictionService";
import { buildSelfTestRow } from "../selfTest";
import { InferenceError } from "../errors";
import { runInferenceCli } from "./cliSupport";
import { localReportPath } from "./localReportDir";

const SINGLE_INFERENCE_SAMPLE_COUNT = 200;

/**
 * `pnpm inference:model:benchmark` — TASK-046 requirement 23. A bounded,
 * deterministic-input local benchmark: load time, self-test time, p50/p95
 * single-inference latency (reusing the service's own bounded rolling
 * metrics rather than a second percentile implementation), and one
 * max-size batch's latency. Never claims production-scale numbers — this
 * is single-process, single-machine, local development hardware only.
 */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  const service = new PredictionService(config);

  const loadStart = performance.now();
  const snapshot = await service.start();
  const loadDurationMs = performance.now() - loadStart;

  if (!snapshot.ready) {
    throw new InferenceError("model_unavailable", "Cannot benchmark: no model loaded successfully.");
  }

  const artifact = service.registry.getCurrentArtifact();
  if (!artifact) throw new InferenceError("model_unavailable", "Cannot benchmark: registry reports ready but no artifact is available.");

  const request = { featureSchemaVersion: artifact.featureContract.featureSchemaVersion, featureRulesVersion: artifact.featureContract.featureRulesVersion, features: buildSelfTestRow(artifact.featureContract) };

  for (let i = 0; i < SINGLE_INFERENCE_SAMPLE_COUNT; i += 1) await service.predict(request);
  const singleInferenceMetrics = service.internalStatus().metrics;

  const batchSize = Math.min(MAX_BATCH_SIZE, 50);
  const batchResult = await service.predictBatch(Array.from({ length: batchSize }, () => request));

  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: snapshot.modelVersion,
    estimatorType: snapshot.estimatorType,
    loadDurationMs,
    selfTestDurationMs: snapshot.lastSelfTest?.durationMs ?? null,
    singleInference: {
      sampleCount: SINGLE_INFERENCE_SAMPLE_COUNT,
      averageMs: singleInferenceMetrics.averageInferenceDurationMs,
      p50Ms: singleInferenceMetrics.p50InferenceDurationMs,
      p95Ms: singleInferenceMetrics.p95InferenceDurationMs,
    },
    batchInference: {
      batchSize,
      totalDurationMs: batchResult.totalDurationMs,
      averageMsPerItem: batchResult.totalDurationMs / batchSize,
    },
    note: "Single-process, single-machine, local development hardware only — not a production-scale or concurrent-load benchmark.",
  };

  const reportPath = await localReportPath("model-inference-benchmark.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(JSON.stringify(report, null, 2));
  console.log("");
  console.log(`Full report written to: ${reportPath}`);
}

void runInferenceCli(main);
