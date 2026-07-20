import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TASK-049 section 9/24 — "no client import of server-only modules" /
 * "client-bundle isolation". `docs/35-real-prediction-backend-integration.md`
 * and `docs/36-real-prediction-runtime-packaging.md` both describe this
 * invariant as verified by a one-off manual `grep` run during TASK-047/048;
 * neither task actually committed an automated check. This test makes that
 * invariant enforceable going forward: it walks `apps/web/src/features/**`
 * and `apps/web/src/hooks/**` (the client layer — every file here can end
 * up in a browser bundle) and asserts none of their source text references
 * a server-only module. A textual scan (not a module-graph resolver) is
 * intentional: it fails loudly on both a direct import and a dynamic
 * `import()`, and needs no build step to run.
 */

const CLIENT_ROOTS = ["features", "hooks"];
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /@repo\/model-inference/,
  /@repo\/vlr-ingestion/,
  /server\/prediction/,
  /server\/release/,
  /runtimePackageSource/,
  /node:fs/,
  /node:child_process/,
];

async function collectSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(absolutePath);
    }
  }
  return files;
}

describe("client-bundle isolation: features/** and hooks/** never import a server-only module", () => {
  it.each(CLIENT_ROOTS)("no file under src/%s references a server-only module or Node builtin", async (rootName) => {
    const root = resolve(__dirname, "..", rootName);
    const files = await collectSourceFiles(root);
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; pattern: string }[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) violations.push({ file, pattern: pattern.source });
      }
    }
    expect(violations).toEqual([]);
  });
});
