import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Loads a synthetic HTML fixture by filename — see
 * docs/29-vlr-data-ingestion-foundation.md ("Fixture Testing"). Used both
 * by parser tests and by `FixtureVlrProvider`, the fixture-only provider
 * behind `pnpm ingest:fixtures` — that CLI command's entire purpose is to
 * exercise the ingestion pipeline against these fixtures without any
 * network access, so reading them from production ingestion code here is
 * intentional, not a test-only shortcut.
 *
 * Deliberately built via `dirname`/`resolve` rather than
 * `new URL("../../fixtures", import.meta.url)` — that literal-relative-URL
 * form is a bundler idiom webpack statically pattern-matches and tries to
 * resolve as a bundled asset, which fails the moment any consumer (e.g.
 * TASK-047's `apps/web`, which imports `@repo/model-inference` ->
 * `@repo/vlr-ingestion`) reaches this module through a Next.js webpack
 * build. This form computes the identical path at runtime without
 * triggering that static analysis.
 */
const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");

export function readFixtureFile(name: string): string {
  return readFileSync(`${FIXTURES_DIR}/${name}`, "utf-8");
}
