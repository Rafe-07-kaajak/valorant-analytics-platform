import { ModelingError, exitCodeForModelingError } from "./errors";

/**
 * Modeling-specific CLI plumbing — mirrors `../cli/cliSupport.ts`'s
 * `runCli`, but maps `ModelingError` codes to exit codes instead of
 * `IngestionError` codes. Every modeling CLI command shares this so
 * failures are reported consistently and never print secrets/raw HTML
 * (there are none in this package — no network access ever occurs here).
 */
export async function runModelingCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const message = error instanceof ModelingError ? `[${error.code}] ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error(`Model command failed: ${message}`);
    process.exitCode = exitCodeForModelingError(error);
  }
}
