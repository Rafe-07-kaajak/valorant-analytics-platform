import { InferenceError, toSafeError, type InferenceErrorCode } from "../errors";

/** Mirrors `services/vlr-ingestion/src/modeling/cliSupport.ts`'s `runModelingCli` — every command shares one error-to-exit-code mapping so failures are reported consistently and never print a raw stack trace. */
export async function runInferenceCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const safe = toSafeError(error);
    console.error(`Model inference command failed: [${safe.code}] ${safe.message}`);
    process.exitCode = error instanceof InferenceError ? exitCodeForInferenceError(safe.code) : 1;
  }
}

const NOT_FOUND_CODES: readonly InferenceErrorCode[] = ["artifact_missing", "model_not_loaded", "model_unavailable"];
const VALIDATION_CODES: readonly InferenceErrorCode[] = ["artifact_schema_invalid", "artifact_hash_mismatch", "unsupported_estimator", "unsupported_calibration", "feature_schema_mismatch", "missing_feature", "unknown_feature", "invalid_feature_type", "invalid_feature_value", "non_finite_feature", "requested_model_version_mismatch", "self_test_failed", "unsafe_artifact_path", "payload_too_large"];

function exitCodeForInferenceError(code: InferenceErrorCode): number {
  if (NOT_FOUND_CODES.includes(code)) return 2;
  if (VALIDATION_CODES.includes(code)) return 3;
  return 1;
}
