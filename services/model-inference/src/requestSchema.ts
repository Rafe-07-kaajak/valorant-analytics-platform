import type { FeatureContract, ModelInputRow } from "@repo/vlr-ingestion";
import { InferenceError } from "./errors";
import type { ModelInferenceConfig } from "./config";

/**
 * Request contract + feature validation — TASK-046 requirement 8/11.
 * Validation runs in one fixed order every time (deterministic, fail-fast
 * on the first problem found): request shape -> payload size -> feature
 * schema/rules version -> missing required features -> unknown features
 * (strict allowlist; this is also how label/identifier injection is
 * rejected, since every label/identifier field is a catalog "excluded"
 * field and therefore never appears in `requiredInputFields`) -> per-field
 * type -> per-field finiteness/nullability -> categorical vocabulary
 * (unknown categories are accepted with a warning, matching the artifact's
 * own `=__unknown__` preprocessing bucket, never rejected).
 */

export type FeatureValue = string | number | boolean | null;

export interface InferenceRequest {
  readonly requestId?: string;
  readonly matchInternalId?: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly sourceFeatureDatasetVersion?: string;
  readonly requestedModelVersion?: string;
  readonly features: Readonly<Record<string, FeatureValue>>;
}

export interface ValidatedRequest {
  readonly requestId: string | undefined;
  readonly matchInternalId: string | undefined;
  readonly requestedModelVersion: string | undefined;
  readonly row: ModelInputRow;
  readonly warnings: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rejects a payload before it is even parsed as a request, using its serialized byte length — TASK-046 requirement 8 ("payload-size bound"), 22 ("oversized JSON"). */
export function assertPayloadSize(rawBody: string, config: ModelInferenceConfig): void {
  const byteLength = Buffer.byteLength(rawBody, "utf-8");
  if (byteLength > config.maxRequestBytes) {
    throw new InferenceError("payload_too_large", `Request payload (${byteLength} bytes) exceeds the configured limit of ${config.maxRequestBytes} bytes.`, { details: { byteLength, maxRequestBytes: config.maxRequestBytes } });
  }
}

function assertShape(request: unknown): asserts request is InferenceRequest {
  if (!isPlainObject(request)) {
    throw new InferenceError("feature_schema_mismatch", "Request body must be a JSON object.");
  }
  if (typeof request.featureSchemaVersion !== "string" || request.featureSchemaVersion.trim().length === 0) {
    throw new InferenceError("feature_schema_mismatch", 'Request is missing required string field "featureSchemaVersion".');
  }
  if (typeof request.featureRulesVersion !== "string" || request.featureRulesVersion.trim().length === 0) {
    throw new InferenceError("feature_schema_mismatch", 'Request is missing required string field "featureRulesVersion".');
  }
  if (!isPlainObject(request.features)) {
    throw new InferenceError("feature_schema_mismatch", 'Request is missing required object field "features".');
  }
  // `__proto__`/`constructor`/`prototype` keys are rejected outright rather
  // than merged into anything (TASK-046 requirement 22, "prototype
  // pollution" / "unsafe object merging") — this service never merges
  // request objects into a shared object, but the check is kept here as a
  // defense-in-depth boundary on every field name that reaches validation.
  for (const key of Object.keys(request.features)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new InferenceError("unknown_feature", `Feature name "${key}" is not permitted.`, { details: { field: key } });
    }
  }
}

export function validateInferenceRequest(request: unknown, featureContract: FeatureContract): ValidatedRequest {
  assertShape(request);

  if (request.featureSchemaVersion !== featureContract.featureSchemaVersion) {
    throw new InferenceError("feature_schema_mismatch", `Request featureSchemaVersion "${request.featureSchemaVersion}" does not match the loaded model's "${featureContract.featureSchemaVersion}".`, { details: { requested: request.featureSchemaVersion, loaded: featureContract.featureSchemaVersion } });
  }
  if (request.featureRulesVersion !== featureContract.featureRulesVersion) {
    throw new InferenceError("feature_schema_mismatch", `Request featureRulesVersion "${request.featureRulesVersion}" does not match the loaded model's "${featureContract.featureRulesVersion}".`, { details: { requested: request.featureRulesVersion, loaded: featureContract.featureRulesVersion } });
  }

  const features = request.features;
  const requiredSet = new Set(featureContract.requiredInputFields);

  const missing = featureContract.requiredInputFields.filter((field) => !(field in features));
  if (missing.length > 0) {
    throw new InferenceError("missing_feature", `Request is missing required feature(s): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ""}.`, { details: { missing } });
  }

  const unknown = Object.keys(features).filter((key) => !requiredSet.has(key));
  if (unknown.length > 0) {
    throw new InferenceError("unknown_feature", `Request contains unrecognized or disallowed feature(s): ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? ` (+${unknown.length - 5} more)` : ""}. Identifiers and label fields are never accepted as model input.`, { details: { unknown } });
  }

  const numericFields = new Set(featureContract.numericFields);
  const nullableNumericFields = new Set(featureContract.nullableNumericFields);
  const booleanFields = new Set(featureContract.booleanFields);
  const categoricalFields = new Set(featureContract.categoricalFields);

  const warnings: string[] = [];
  const row: Record<string, string | number | boolean | null> = {};

  for (const field of featureContract.requiredInputFields) {
    const value = features[field] as FeatureValue;

    if (numericFields.has(field)) {
      if (value === null) {
        if (!nullableNumericFields.has(field)) {
          throw new InferenceError("invalid_feature_value", `Feature "${field}" is not nullable but was null.`, { details: { field } });
        }
      } else if (typeof value !== "number") {
        throw new InferenceError("invalid_feature_type", `Feature "${field}" must be a number (or null if nullable), got ${typeof value}.`, { details: { field, expectedType: "number" } });
      } else if (!Number.isFinite(value)) {
        throw new InferenceError("non_finite_feature", `Feature "${field}" is NaN or Infinite.`, { details: { field } });
      }
      row[field] = value;
      continue;
    }

    if (booleanFields.has(field)) {
      if (typeof value !== "boolean") {
        throw new InferenceError("invalid_feature_type", `Feature "${field}" must be a boolean, got ${typeof value}.`, { details: { field, expectedType: "boolean" } });
      }
      row[field] = value;
      continue;
    }

    if (categoricalFields.has(field)) {
      if (typeof value !== "string" || value.length === 0) {
        throw new InferenceError("invalid_feature_type", `Feature "${field}" must be a non-empty string, got ${typeof value}.`, { details: { field, expectedType: "string" } });
      }
      const vocabulary = featureContract.categoricalVocabulary[field] ?? [];
      if (!vocabulary.includes(value)) {
        warnings.push(`Feature "${field}" value "${value}" is not in the training vocabulary; the artifact's "__unknown__" bucket will be used.`);
      }
      row[field] = value;
      continue;
    }

    // Unreachable given `requiredInputFields` is derived exactly from the
    // union of numeric/boolean/categorical fields at artifact-build time,
    // but fails closed rather than silently accepting an unclassified field.
    throw new InferenceError("feature_schema_mismatch", `Feature "${field}" is required but not classified as numeric, boolean, or categorical by the loaded feature contract.`, { details: { field } });
  }

  return {
    requestId: request.requestId,
    matchInternalId: request.matchInternalId,
    requestedModelVersion: request.requestedModelVersion,
    row,
    warnings,
  };
}
