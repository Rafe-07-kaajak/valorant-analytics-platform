/**
 * Error taxonomy for the VLR ingestion foundation — see
 * docs/29-vlr-data-ingestion-foundation.md ("Error Taxonomy"). Every error
 * carries a stable machine-readable code and an explicit retryable flag so
 * the CLI can map failures to exit codes without inspecting error messages.
 */

export type IngestionErrorCode =
  | "network_disabled"
  | "invalid_provider_id"
  | "invalid_backfill_scope"
  | "disallowed_url"
  | "timeout"
  | "rate_limited"
  | "unexpected_status"
  | "invalid_content_type"
  | "response_too_large"
  | "parse_failure"
  | "critical_field_missing"
  | "normalization_failure"
  | "mapping_conflict"
  | "event_classification_conflict"
  | "persistence_failure"
  | "checkpoint_failure"
  | "cancelled";

export interface IngestionErrorContext {
  readonly [key: string]: string | number | boolean | undefined;
}

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
  readonly retryable: boolean;
  readonly context?: IngestionErrorContext;

  constructor(code: IngestionErrorCode, message: string, options?: { retryable?: boolean; context?: IngestionErrorContext }) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.context = options?.context;
  }
}

const RETRYABLE_CODES: ReadonlySet<IngestionErrorCode> = new Set(["timeout", "rate_limited", "unexpected_status"]);

export function isRetryableCode(code: IngestionErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

/** Maps an ingestion error code to a stable CLI process exit code. */
export function exitCodeForError(error: unknown): number {
  if (error instanceof IngestionError) {
    switch (error.code) {
      case "network_disabled":
        return 2;
      case "invalid_provider_id":
      case "invalid_backfill_scope":
      case "disallowed_url":
        return 3;
      case "cancelled":
        return 4;
      default:
        return 1;
    }
  }
  return 1;
}
