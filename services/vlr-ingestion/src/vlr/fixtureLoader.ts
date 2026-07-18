import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Loads a synthetic HTML fixture by filename — see
 * docs/29-vlr-data-ingestion-foundation.md ("Fixture Testing"). Used both
 * by parser tests and by `FixtureVlrProvider`, the fixture-only provider
 * behind `pnpm ingest:fixtures` — that CLI command's entire purpose is to
 * exercise the ingestion pipeline against these fixtures without any
 * network access, so reading them from production ingestion code here is
 * intentional, not a test-only shortcut.
 */
const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures", import.meta.url));

export function readFixtureFile(name: string): string {
  return readFileSync(`${FIXTURES_DIR}/${name}`, "utf-8");
}
