import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { setModelServiceForTesting } from "../../../../../server/prediction/modelService";
import { resetHistoricalRepositoryCacheForTesting } from "../../../../../server/prediction/historicalFeatureRepository";
import { buildFixtureFeatureDataset } from "../../../../../server/prediction/testFixtures/buildFixtureFeatureDataset";
import { POST } from "./route";

function fixtureModelInferenceConfig(artifactDir: string): ModelInferenceConfig {
  return {
    artifactDir,
    expectedModelVersion: undefined,
    expectedFeatureSchemaVersion: undefined,
    loadOnStart: true,
    requireModelOnStart: false,
    strictHashValidation: true,
    probabilityClipEpsilon: 1e-15,
    maxRequestBytes: 262_144,
    reloadEnabled: false,
    reloadIntervalMs: undefined,
    fallbackPolicy: "disabled",
    fallbackConstantProbability: 0.5,
    inferenceTimeoutMs: 5_000,
    loggingMode: "safe",
    maxArtifactFileBytes: 10_000_000,
  };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/internal/prediction/historical", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/internal/prediction/historical", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  async function withReadyFixture() {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;
  }

  it("returns 200 with a real prediction for a valid request", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("historical-real-model");
    expect(body.match.matchInternalId).toBe("vlr:match:1001");
  });

  it("rejects an unparseable JSON body with request_invalid (400)", async () => {
    await withReadyFixture();
    const response = await POST(postRequest("{not json"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("request_invalid");
  });

  it("rejects a wrong mode value", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "synthetic-scenario", matchInternalId: "vlr:match:1001" }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("request_invalid");
  });

  it("rejects an unrecognized extra field (strict allowlist)", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001", features: { teamAEloRating: 9999 } }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("request_invalid");
  });

  it("rejects a raw feature vector supplied by the caller (never accepted as model input)", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001", features: { labelTeamAWin: 1 } }));
    expect(response.status).toBe(400);
  });

  it("rejects a JSON body containing a literal __proto__ key (prototype pollution defense-in-depth)", async () => {
    await withReadyFixture();
    // Built as a raw JSON string, not a JS object literal — `{ __proto__: x }`
    // in source is special-cased by the language grammar (it sets the
    // prototype rather than creating an own property), whereas `JSON.parse`
    // creates `__proto__` as a genuine own enumerable data property, which is
    // exactly the shape this route's strict allowlist must reject.
    const response = await POST(postRequest('{"mode":"historical-real-model","matchInternalId":"vlr:match:1001","__proto__":{"polluted":true}}'));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("request_invalid");
  });

  it("rejects a missing matchInternalId", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model" }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("request_invalid");
  });

  it("returns historical_match_not_found (404) for an unknown match", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:does-not-exist" }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("historical_match_not_found");
  });

  it("rejects an oversized payload with 413", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001", requestId: "x".repeat(20_000) }));
    expect(response.status).toBe(413);
  });

  it("echoes requestId back on both success and error paths", async () => {
    await withReadyFixture();
    const ok = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001", requestId: "req-echo" }));
    expect((await ok.json()).requestId).toBe("req-echo");

    const failed = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:does-not-exist", requestId: "req-echo-2" }));
    expect((await failed.json()).requestId).toBe("req-echo-2");
  });

  it("never includes a label field in a successful response body", async () => {
    await withReadyFixture();
    const response = await POST(postRequest({ mode: "historical-real-model", matchInternalId: "vlr:match:1001" }));
    const rawBody = await response.text();
    expect(rawBody).not.toContain("labelTeamAWin");
    expect(rawBody).not.toContain("labelWinnerProviderId");
  });
});
