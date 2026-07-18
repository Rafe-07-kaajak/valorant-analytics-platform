import { exitCodeForError, IngestionError } from "../errors";

/**
 * Shared CLI plumbing — see docs/29-vlr-data-ingestion-foundation.md
 * ("Commands") and TASK-041 requirement 23/26. Every command shares the
 * same argument validation, error-to-exit-code mapping, and "never print
 * secrets" logging discipline.
 */
export function requireArg(argv: readonly string[], index: number, label: string): string {
  const value = argv[index];
  if (!value || value.trim().length === 0) {
    throw new IngestionError("invalid_provider_id", `Missing required argument: ${label}.`);
  }
  return value.trim();
}

/** Runs a CLI entrypoint, mapping any thrown error to a stable process exit code. Never prints secrets or raw HTML. */
export async function runCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const message = error instanceof IngestionError ? `[${error.code}] ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error(`Ingestion command failed: ${message}`);
    process.exitCode = exitCodeForError(error);
  }
}
