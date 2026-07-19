import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/** Resolves `services/model-inference/.local/` (gitignored) — the only place any CLI command writes a report to disk. */
export async function localReportPath(fileName: string): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here, "..", "..", ".local");
  await mkdir(dir, { recursive: true });
  return join(dir, fileName);
}
