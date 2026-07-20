import { describe, expect, it } from "vitest";
import { validateEnvironment, buildEnvironmentSchemaDocument, buildExampleEnvContent } from "./environmentSchema";

describe("validateEnvironment", () => {
  it("accepts an empty environment (every variable has a safe default)", () => {
    expect(validateEnvironment({}, { strictProduction: false })).toEqual({ valid: true, errors: [] });
  });

  it("rejects an invalid enum value", () => {
    const result = validateEnvironment({ REAL_PREDICTION_SOURCE_MODE: "not-a-real-mode" }, { strictProduction: false });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.name === "REAL_PREDICTION_SOURCE_MODE")).toBe(true);
  });

  it("rejects an invalid boolean value", () => {
    const result = validateEnvironment({ REAL_PREDICTION_ENABLED: "yes" }, { strictProduction: false });
    expect(result.valid).toBe(false);
  });

  it("rejects local-generated source mode under strict production rules", () => {
    const result = validateEnvironment({ REAL_PREDICTION_SOURCE_MODE: "local-generated" }, { strictProduction: true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.name === "REAL_PREDICTION_SOURCE_MODE")).toBe(true);
  });

  it("accepts a fully strict-production-compliant environment", () => {
    const result = validateEnvironment(
      {
        REAL_PREDICTION_SOURCE_MODE: "runtime-package",
        REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE: "true",
        MODEL_INFERENCE_REQUIRE_MODEL_ON_START: "true",
        NODE_ENV: "production",
      },
      { strictProduction: true },
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("strict production rules are not enforced when strictProduction is false", () => {
    const result = validateEnvironment({ REAL_PREDICTION_SOURCE_MODE: "local-generated", NODE_ENV: "development" }, { strictProduction: false });
    expect(result.valid).toBe(true);
  });
});

describe("buildEnvironmentSchemaDocument / buildExampleEnvContent", () => {
  it("the schema document is deterministic and carries a configSchemaVersion", () => {
    const first = buildEnvironmentSchemaDocument();
    const second = buildEnvironmentSchemaDocument();
    expect(first).toEqual(second);
    expect(first.configSchemaVersion).toMatch(/^release-config-schema@/);
  });

  it("the example env content contains only placeholders, no real values", () => {
    const content = buildExampleEnvContent();
    // Every declared variable line is commented out (placeholder-only convention).
    for (const line of content.split("\n")) {
      if (line.includes("=") && !line.trim().startsWith("#")) {
        throw new Error(`Found an uncommented assignment line: "${line}"`);
      }
    }
  });
});
