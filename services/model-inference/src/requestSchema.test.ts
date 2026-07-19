import { describe, expect, it } from "vitest";
import { validateInferenceRequest, assertPayloadSize } from "./requestSchema";
import { loadModelInferenceConfig } from "./config";
import { FIXTURE_FEATURE_CONTRACT, fixtureValidRow } from "./testFixtures/buildFixtureArtifact";
import { InferenceError } from "./errors";

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-1",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    features: fixtureValidRow(),
    ...overrides,
  };
}

const config = loadModelInferenceConfig();

describe("validateInferenceRequest", () => {
  it("accepts a fully valid request and passes through the features unchanged", () => {
    const result = validateInferenceRequest(baseRequest(), FIXTURE_FEATURE_CONTRACT);
    expect(result.row).toEqual(fixtureValidRow());
    expect(result.warnings).toEqual([]);
    expect(result.requestId).toBe("req-1");
  });

  it("rejects a request with a mismatched featureSchemaVersion", () => {
    expect(() => validateInferenceRequest(baseRequest({ featureSchemaVersion: "wrong@1.0.0" }), FIXTURE_FEATURE_CONTRACT)).toThrow(InferenceError);
  });

  it("rejects a request missing a required feature", () => {
    const features = fixtureValidRow();
    delete (features as Record<string, unknown>).teamAEloRating;
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "missing_feature" }));
  });

  it("rejects an unknown extra feature (strict allowlist policy)", () => {
    const features = { ...fixtureValidRow(), someExtraField: 1 };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "unknown_feature" }));
  });

  it("rejects label injection — a label field placed inside `features` is caught as an unknown feature, never accepted as model input", () => {
    const features = { ...fixtureValidRow(), labelTeamAWin: 1 };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "unknown_feature" }));
  });

  it("rejects identifier injection — matchInternalId/teamAProviderId inside `features` are caught as unknown features", () => {
    const features = { ...fixtureValidRow(), teamAProviderId: "vlr:team:123" };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "unknown_feature" }));
  });

  it("rejects a wrong-typed numeric feature", () => {
    const features = { ...fixtureValidRow(), teamAEloRating: "not-a-number" };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "invalid_feature_type" }));
  });

  it("rejects NaN and Infinity for a numeric feature", () => {
    const nanFeatures = { ...fixtureValidRow(), teamAEloRating: Number.NaN };
    expect(() => validateInferenceRequest(baseRequest({ features: nanFeatures }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "non_finite_feature" }));
    const infFeatures = { ...fixtureValidRow(), teamAEloRating: Number.POSITIVE_INFINITY };
    expect(() => validateInferenceRequest(baseRequest({ features: infFeatures }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "non_finite_feature" }));
  });

  it("rejects null for a non-nullable numeric field", () => {
    const features = { ...fixtureValidRow(), teamAEloRating: null };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "invalid_feature_value" }));
  });

  it("accepts null for a nullable numeric field", () => {
    const features = { ...fixtureValidRow(), teamADaysSinceLastMatch: null };
    const result = validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT);
    expect(result.row.teamADaysSinceLastMatch).toBeNull();
  });

  it("rejects a wrong-typed boolean feature", () => {
    const features = { ...fixtureValidRow(), teamAHasPriorMatch: "true" };
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "invalid_feature_type" }));
  });

  it("accepts a known categorical value without warnings", () => {
    const result = validateInferenceRequest(baseRequest(), FIXTURE_FEATURE_CONTRACT);
    expect(result.warnings).toEqual([]);
  });

  it("accepts an unknown categorical value with a warning rather than rejecting it (artifact's __unknown__ bucket policy)", () => {
    const features = { ...fixtureValidRow(), eventFamily: "some-future-region" };
    const result = validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT);
    expect(result.row.eventFamily).toBe("some-future-region");
    expect(result.warnings.length).toBe(1);
  });

  it("rejects a non-object request body", () => {
    expect(() => validateInferenceRequest("not-an-object", FIXTURE_FEATURE_CONTRACT)).toThrow(InferenceError);
    expect(() => validateInferenceRequest(null, FIXTURE_FEATURE_CONTRACT)).toThrow(InferenceError);
  });

  it("rejects a __proto__ key in features (prototype pollution guard)", () => {
    const features = JSON.parse(`{"__proto__": {"polluted": true}}`) as Record<string, unknown>;
    expect(() => validateInferenceRequest(baseRequest({ features }), FIXTURE_FEATURE_CONTRACT)).toThrowError(expect.objectContaining({ code: "unknown_feature" }));
  });
});

describe("assertPayloadSize", () => {
  it("accepts a payload within the configured limit", () => {
    expect(() => assertPayloadSize("{}", config)).not.toThrow();
  });

  it("rejects a payload larger than the configured limit", () => {
    const huge = "x".repeat(config.maxRequestBytes + 1);
    expect(() => assertPayloadSize(huge, config)).toThrowError(expect.objectContaining({ code: "payload_too_large" }));
  });
});
