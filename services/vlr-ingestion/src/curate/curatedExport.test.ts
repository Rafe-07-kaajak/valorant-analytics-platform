import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCuratedDataset, stableStringify, writeCuratedDataset } from "./curatedExport";
import type { CuratedExportInput } from "./curatedExport";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

function baseInput(overrides: Partial<CuratedExportInput> = {}): CuratedExportInput {
  return {
    matches: [buildNormalizedMatch()],
    events: [],
    teamMapping: [],
    teamAliases: [],
    qualityIssues: [],
    quarantineRecords: [],
    matchCategoryByInternalId: new Map([["vlr:match:1", "current-approved"]]),
    eventCategoryByInternalId: new Map(),
    sourceDatasetVersion: "abc123",
    generatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCuratedDataset", () => {
  it("includes a current-approved, non-quarantined match", () => {
    const files = buildCuratedDataset(baseInput());
    expect(files["matches.json"]).toEqual([expect.objectContaining({ internalId: "vlr:match:1" })]);
    expect(files["dataset-manifest.json"].curatedMatchCount).toBe(1);
  });

  it("excludes a match categorized stale from matches.json", () => {
    const files = buildCuratedDataset(baseInput({ matchCategoryByInternalId: new Map([["vlr:match:1", "stale"]]) }));
    expect(files["matches.json"]).toEqual([]);
  });

  it("excludes a quarantined match from matches.json, but it still exists in the source data", () => {
    const files = buildCuratedDataset(
      baseInput({ quarantineRecords: [{ entityType: "match", internalId: "vlr:match:1", reasons: ["r"], firstQuarantinedAt: "t", sourceReference: "u" }] }),
    );
    expect(files["matches.json"]).toEqual([]);
    expect(files["quarantine.json"]).toHaveLength(1);
  });

  it("produces a deterministic curated dataset version for identical input", () => {
    const a = buildCuratedDataset(baseInput());
    const b = buildCuratedDataset(baseInput());
    expect(a["dataset-manifest.json"].curatedDatasetVersion).toBe(b["dataset-manifest.json"].curatedDatasetVersion);
  });

  it("changes the curated dataset version when the source dataset version changes", () => {
    const a = buildCuratedDataset(baseInput({ sourceDatasetVersion: "v1" }));
    const b = buildCuratedDataset(baseInput({ sourceDatasetVersion: "v2" }));
    expect(a["dataset-manifest.json"].curatedDatasetVersion).not.toBe(b["dataset-manifest.json"].curatedDatasetVersion);
  });

  it("never uses a random UUID for versioning — same input always reproduces the same hash-derived version", () => {
    const version = buildCuratedDataset(baseInput())["dataset-manifest.json"].curatedDatasetVersion;
    expect(version).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("stableStringify", () => {
  it("sorts object keys regardless of insertion order", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});

describe("writeCuratedDataset", () => {
  it("is idempotent: writing the same curated dataset twice produces byte-identical files and identical content hashes", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-curate-test-"));
    const files = buildCuratedDataset(baseInput());

    const firstHashes = await writeCuratedDataset(dataDir, files);
    const firstContent = await readFile(join(dataDir, "curated", "matches.json"), "utf-8");

    const secondHashes = await writeCuratedDataset(dataDir, files);
    const secondContent = await readFile(join(dataDir, "curated", "matches.json"), "utf-8");

    expect(secondHashes).toEqual(firstHashes);
    expect(secondContent).toBe(firstContent);
  });
});
