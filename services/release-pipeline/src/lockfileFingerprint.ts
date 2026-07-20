import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

/** sha256 of the repo-root `pnpm-lock.yaml`'s raw bytes — deliberately the raw lockfile content, not a parsed/re-serialized form, so any dependency change (including ones that wouldn't change a parsed summary) is caught. */
export async function computeLockfileHash(lockfilePath: string): Promise<string> {
  const content = await readFile(lockfilePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
