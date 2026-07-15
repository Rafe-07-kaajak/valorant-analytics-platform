import { describe, expect, it } from "vitest";
import type { DnaDimensionKey } from "@repo/shared";
import { getFeatureRegistry } from "./featureRegistry";

const EXPECTED_DIMENSIONS: DnaDimensionKey[] = [
  "aggression",
  "tempo",
  "mapControl",
  "utilityEfficiency",
  "adaptability",
  "clutchAbility",
];

describe("getFeatureRegistry", () => {
  it("has exactly one entry for each of the six Team DNA dimensions", () => {
    const registry = getFeatureRegistry();
    const keys = registry.map((feature) => feature.key);

    expect(new Set(keys)).toEqual(new Set(EXPECTED_DIMENSIONS));
    expect(keys).toHaveLength(EXPECTED_DIMENSIONS.length);
  });

  it("populates every required metadata field for every entry", () => {
    for (const feature of getFeatureRegistry()) {
      expect(feature.id.length).toBeGreaterThan(0);
      expect(feature.name.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
      expect(feature.category.length).toBeGreaterThan(0);
      expect(feature.owner.length).toBeGreaterThan(0);
      expect(feature.source.length).toBeGreaterThan(0);
      expect(feature.formula.length).toBeGreaterThan(0);
      expect(feature.direction.length).toBeGreaterThan(0);
      expect(feature.weight).toBeGreaterThan(0);
      expect(feature.version.length).toBeGreaterThan(0);
      expect(feature.status).toBe("Production");
      expect(feature.consumers.length).toBeGreaterThan(0);
    }
  });

  it("uses unique feature IDs", () => {
    const ids = getFeatureRegistry().map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns the same catalog on every call", () => {
    expect(getFeatureRegistry()).toEqual(getFeatureRegistry());
  });
});
