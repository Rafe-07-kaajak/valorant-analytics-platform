import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadModelInferenceConfig } from "./config";

const ENV_KEYS = ["MODEL_INFERENCE_ARTIFACT_DIR", "MODEL_INFERENCE_LOAD_ON_START", "MODEL_INFERENCE_REQUIRE_MODEL_ON_START", "MODEL_INFERENCE_STRICT_HASH_VALIDATION", "MODEL_INFERENCE_PROBABILITY_CLIP_EPSILON", "MODEL_INFERENCE_MAX_REQUEST_BYTES", "MODEL_INFERENCE_RELOAD_ENABLED", "MODEL_INFERENCE_RELOAD_INTERVAL_MS", "MODEL_INFERENCE_FALLBACK_POLICY", "MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY", "MODEL_INFERENCE_TIMEOUT_MS", "MODEL_INFERENCE_LOG_MODE", "MODEL_INFERENCE_MAX_ARTIFACT_FILE_BYTES", "MODEL_INFERENCE_EXPECTED_MODEL_VERSION", "MODEL_INFERENCE_EXPECTED_FEATURE_SCHEMA_VERSION"];

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("loadModelInferenceConfig", () => {
  it("uses secure, network-free defaults when no environment variables are set", () => {
    const config = loadModelInferenceConfig();
    expect(config.loadOnStart).toBe(true);
    expect(config.requireModelOnStart).toBe(false);
    expect(config.strictHashValidation).toBe(true);
    expect(config.reloadEnabled).toBe(false);
    expect(config.fallbackPolicy).toBe("disabled");
    expect(config.loggingMode).toBe("safe");
    expect(config.artifactDir.length).toBeGreaterThan(0);
  });

  it("never hardcodes a specific developer machine's absolute path in the default artifact directory", () => {
    const config = loadModelInferenceConfig();
    expect(config.artifactDir).not.toMatch(/C:\\Users/i);
    expect(config.artifactDir).not.toMatch(/\/home\//);
  });

  it("respects an explicit MODEL_INFERENCE_ARTIFACT_DIR override", () => {
    process.env.MODEL_INFERENCE_ARTIFACT_DIR = "/tmp/custom-artifact-dir";
    const config = loadModelInferenceConfig();
    expect(config.artifactDir).toBe("/tmp/custom-artifact-dir");
  });

  it("clamps an out-of-range MODEL_INFERENCE_MAX_REQUEST_BYTES to the safe maximum", () => {
    process.env.MODEL_INFERENCE_MAX_REQUEST_BYTES = "999999999";
    const config = loadModelInferenceConfig();
    expect(config.maxRequestBytes).toBeLessThanOrEqual(1_048_576);
  });

  it("falls back to the default for a non-numeric MODEL_INFERENCE_TIMEOUT_MS", () => {
    process.env.MODEL_INFERENCE_TIMEOUT_MS = "not-a-number";
    const config = loadModelInferenceConfig();
    expect(config.inferenceTimeoutMs).toBe(5_000);
  });

  it("only enables fallback when explicitly set to 'constant'", () => {
    process.env.MODEL_INFERENCE_FALLBACK_POLICY = "anything-else";
    expect(loadModelInferenceConfig().fallbackPolicy).toBe("disabled");
    process.env.MODEL_INFERENCE_FALLBACK_POLICY = "constant";
    expect(loadModelInferenceConfig().fallbackPolicy).toBe("constant");
  });

  it("clamps the fallback constant probability into [0, 1]", () => {
    process.env.MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY = "5";
    expect(loadModelInferenceConfig().fallbackConstantProbability).toBe(1);
    process.env.MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY = "-5";
    expect(loadModelInferenceConfig().fallbackConstantProbability).toBe(0);
  });

  it("reads process.env fresh on every call rather than caching at module scope", () => {
    process.env.MODEL_INFERENCE_STRICT_HASH_VALIDATION = "false";
    expect(loadModelInferenceConfig().strictHashValidation).toBe(false);
    process.env.MODEL_INFERENCE_STRICT_HASH_VALIDATION = "true";
    expect(loadModelInferenceConfig().strictHashValidation).toBe(true);
  });

  it("only reads a reload interval when reload is enabled", () => {
    process.env.MODEL_INFERENCE_RELOAD_INTERVAL_MS = "120000";
    expect(loadModelInferenceConfig().reloadIntervalMs).toBeUndefined();
    process.env.MODEL_INFERENCE_RELOAD_ENABLED = "true";
    expect(loadModelInferenceConfig().reloadIntervalMs).toBe(120_000);
  });
});
