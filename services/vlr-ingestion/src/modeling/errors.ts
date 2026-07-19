/**
 * Error taxonomy for the TASK-045 modeling package — mirrors the shape of
 * `../errors.ts` ("VLR ingestion foundation") but is scoped to model
 * training/backtesting/artifact concerns, which are a distinct bounded
 * context from ingestion. Every error carries a stable machine-readable
 * code so CLI commands can map failures to exit codes without inspecting
 * error message text.
 */

export type ModelingErrorCode =
  | "dataset_not_found"
  | "schema_validation_failed"
  | "insufficient_data"
  | "leakage_violation"
  | "invalid_configuration"
  | "artifact_not_found"
  | "artifact_invalid"
  | "input_validation_failed"
  | "persistence_failure";

export interface ModelingErrorContext {
  readonly [key: string]: string | number | boolean | undefined;
}

export class ModelingError extends Error {
  readonly code: ModelingErrorCode;
  readonly context?: ModelingErrorContext;

  constructor(code: ModelingErrorCode, message: string, options?: { context?: ModelingErrorContext }) {
    super(message);
    this.name = "ModelingError";
    this.code = code;
    this.context = options?.context;
  }
}

/** Maps a modeling error code to a stable CLI process exit code. */
export function exitCodeForModelingError(error: unknown): number {
  if (error instanceof ModelingError) {
    switch (error.code) {
      case "dataset_not_found":
      case "artifact_not_found":
        return 2;
      case "schema_validation_failed":
      case "insufficient_data":
      case "leakage_violation":
      case "invalid_configuration":
      case "artifact_invalid":
      case "input_validation_failed":
        return 3;
      default:
        return 1;
    }
  }
  return 1;
}
