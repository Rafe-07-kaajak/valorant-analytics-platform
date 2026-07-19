import { resolve, sep } from "node:path";
import { IngestionError } from "../errors";

/**
 * Filesystem path safety — see docs/29-vlr-data-ingestion-foundation.md
 * ("Persistence Policy") and TASK-041 requirement 19/29. Every path the
 * filesystem store touches is built here, so path traversal and unsafe
 * filenames are rejected in exactly one place.
 *
 * Also reachable via the `@repo/vlr-ingestion/persistence/pathSafety`
 * subpath export (see `package.json`) — TASK-047's `apps/web` server-only
 * code imports this file directly rather than the package's main barrel
 * (`.`), because that barrel transitively reaches
 * `vlr/fixtureLoader.ts`'s `new URL("../../fixtures", import.meta.url)`,
 * which Next.js's webpack build statically tries (and fails) to resolve as
 * a bundled asset the moment anything in `apps/web` imports the main
 * export. Importing this module's own subpath avoids that entirely.
 */

// `:` is deliberately excluded from the "safe" set even though it's valid in
// a source reference like `vlr:team:2593` — it's a reserved drive-letter
// separator on Windows and unsafe to use verbatim in a filename there.
const UNSAFE_ID_PATTERN = /[^A-Za-z0-9_.-]/g;

/** Deterministically encodes an arbitrary ID (which may contain `:`, `/`, etc.) into a safe filename segment. */
export function safeFileName(id: string): string {
  return id.replace(UNSAFE_ID_PATTERN, "_");
}

/**
 * Resolves `segments` under `rootDir`, throwing if the resolved path would
 * escape the root (path traversal, absolute-path injection, or a symlink
 * target resolved outside the root).
 */
export function resolveSafePath(rootDir: string, ...segments: string[]): string {
  const resolvedRoot = resolve(rootDir);
  const candidate = resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + sep)) {
    throw new IngestionError("persistence_failure", `Resolved path "${candidate}" escapes the configured root "${resolvedRoot}".`);
  }
  return candidate;
}
