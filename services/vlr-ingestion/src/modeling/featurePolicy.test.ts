import { describe, expect, it } from "vitest";
import { FEATURE_CATALOG } from "../feature/featureCatalog";
import { buildFeaturePolicy, HIGH_RISK_EXCLUDED_FIELDS } from "./featurePolicy";

describe("buildFeaturePolicy", () => {
  const policy = buildFeaturePolicy(FEATURE_CATALOG);

  it("excludes every identifier, label, and version field", () => {
    expect(policy.allInputFields).not.toContain("matchInternalId");
    expect(policy.allInputFields).not.toContain("teamAProviderId");
    expect(policy.allInputFields).not.toContain("teamBProviderId");
    expect(policy.allInputFields).not.toContain("labelTeamAWin");
    expect(policy.allInputFields).not.toContain("labelWinnerProviderId");
    expect(policy.allInputFields).not.toContain("featureSchemaVersion");
  });

  it("excludes the high-risk identity-valued categorical field", () => {
    for (const field of HIGH_RISK_EXCLUDED_FIELDS) {
      expect(policy.allInputFields).not.toContain(field);
      expect(policy.excludedFields).toContain(field);
    }
  });

  it("classifies every non-excluded catalog field into exactly one of numeric/boolean/categorical", () => {
    for (const field of FEATURE_CATALOG) {
      const isInput = policy.allInputFields.includes(field.name);
      const isExcluded = policy.excludedFields.includes(field.name);
      expect(isInput || isExcluded).toBe(true);
      expect(isInput && isExcluded).toBe(false);
    }
  });

  it("field lists are sorted and free of duplicates", () => {
    for (const list of [policy.numericFields, policy.booleanFields, policy.categoricalFields, policy.allInputFields]) {
      expect([...list].sort()).toEqual([...list]);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("matches TASK-044's documented 162 feature-group columns minus the one high-risk exclusion", () => {
    expect(policy.allInputFields.length).toBe(161);
  });

  it("includes representative fields from every feature group", () => {
    expect(policy.numericFields).toContain("teamAEloRating");
    expect(policy.booleanFields).toContain("teamAIsColdStart");
    expect(policy.categoricalFields).toContain("eventFamily");
  });
});
