import { describe, expect, it } from "vitest";
import { computeRuntimePackageVersion, type RuntimePackageVersionInputs } from "./runtimePackageVersion";

function baseInputs(): RuntimePackageVersionInputs {
  return {
    modelVersion: "model-v1",
    sourceFeatureDatasetVersion: "dataset-v1",
    featureSchemaVersion: "schema-v1",
    featureRulesVersion: "rules-v1",
    modelFiles: [
      { fileName: "model.json", sha256: "aaa", sizeBytes: 10 },
      { fileName: "manifest.json", sha256: "bbb", sizeBytes: 20 },
    ],
    historicalFiles: [{ fileName: "historical-rows.json", sha256: "ccc", sizeBytes: 30 }],
    historicalRowCount: 5,
    historicalCatalogCount: 5,
  };
}

describe("computeRuntimePackageVersion", () => {
  it("is deterministic for identical inputs", () => {
    const a = computeRuntimePackageVersion(baseInputs());
    const b = computeRuntimePackageVersion(baseInputs());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is independent of file-array order (sorted internally by fileName)", () => {
    const inputs = baseInputs();
    const reordered: RuntimePackageVersionInputs = { ...inputs, modelFiles: [...inputs.modelFiles].reverse() };
    expect(computeRuntimePackageVersion(inputs)).toBe(computeRuntimePackageVersion(reordered));
  });

  it("changes when any file hash changes", () => {
    const inputs = baseInputs();
    const mutated: RuntimePackageVersionInputs = { ...inputs, modelFiles: [{ fileName: "model.json", sha256: "different", sizeBytes: 10 }, inputs.modelFiles[1]] };
    expect(computeRuntimePackageVersion(inputs)).not.toBe(computeRuntimePackageVersion(mutated));
  });

  it("changes when modelVersion changes", () => {
    const inputs = baseInputs();
    expect(computeRuntimePackageVersion(inputs)).not.toBe(computeRuntimePackageVersion({ ...inputs, modelVersion: "model-v2" }));
  });

  it("changes when historicalRowCount changes", () => {
    const inputs = baseInputs();
    expect(computeRuntimePackageVersion(inputs)).not.toBe(computeRuntimePackageVersion({ ...inputs, historicalRowCount: 6 }));
  });
});
