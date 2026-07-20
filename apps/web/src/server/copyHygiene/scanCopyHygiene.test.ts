import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanCopyHygiene } from "./scanCopyHygiene";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  }
});

/** Builds a `<root>/apps/web/src/...` + `<root>/packages/ui/src/...` tree — the exact shape scanCopyHygiene expects, matching this repo's layout. */
function makeFixtureRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "copy-hygiene-fixture-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(root, ...relativePath.split("/"));
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }
  return root;
}

describe("scanCopyHygiene — TASK-050 automated copy hygiene protection", () => {
  it("flags an em dash inside JSX text", () => {
    tempRoot = makeFixtureRoot({
      "apps/web/src/features/Example.tsx": `export function Example() {\n  return <p>Free to explore ${EM_DASH} no account required.</p>;\n}\n`,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ character: "em dash", line: 2 });
  });

  it("flags an en dash inside a string literal", () => {
    tempRoot = makeFixtureRoot({
      "apps/web/src/features/Example.ts": `export const label = "Stage 1${EN_DASH}2 playoffs";\n`,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]?.character).toBe("en dash");
  });

  it("flags a dash inside a template literal", () => {
    const fixtureSource =
      "export const label = (name: string) => `${name} " + EM_DASH + " modeled gap`;\n";
    tempRoot = makeFixtureRoot({
      "apps/web/src/lib/example.ts": fixtureSource,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(1);
  });

  it("does not flag an em dash inside a comment", () => {
    tempRoot = makeFixtureRoot({
      "apps/web/src/features/Example.tsx": `// engineering note ${EM_DASH} not user-facing\nexport function Example() {\n  return <p>All clear.</p>;\n}\n`,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(0);
  });

  it("does not flag a plain ASCII hyphen", () => {
    tempRoot = makeFixtureRoot({
      "apps/web/src/features/Example.tsx": `export function Example() {\n  return <p>Tier-1 VALORANT, TASK-050-ready.</p>;\n}\n`,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(0);
  });

  it("excludes *.test.tsx fixture/spec files from the scan", () => {
    tempRoot = makeFixtureRoot({
      "apps/web/src/features/Example.test.tsx": `describe("thing ${EM_DASH} case", () => {});\n`,
    });

    const report = scanCopyHygiene(tempRoot);

    expect(report.violations).toHaveLength(0);
    expect(report.filesScanned).toBe(0);
  });

  it("passes cleanly on this repository's own source tree", () => {
    const repoRoot = join(__dirname, "../../../../..");
    const report = scanCopyHygiene(repoRoot);

    if (report.violations.length > 0) {
      const details = report.violations
        .map((v) => `${v.file}:${v.line}:${v.column} (${v.character}) — ${v.excerpt}`)
        .join("\n");
      throw new Error(`Copy hygiene violations found:\n${details}`);
    }

    expect(report.filesScanned).toBeGreaterThan(0);
  });
});
