import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCuratedDataset, stableStringify, writeCuratedDataset } from "./curatedExport";
import type { CuratedExportInput, CuratedMatch } from "./curatedExport";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

function matchesOf(files: ReturnType<typeof buildCuratedDataset>): readonly CuratedMatch[] {
  return files["matches.json"] as readonly CuratedMatch[];
}

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

describe("buildCuratedDataset — display metadata (TASK-057)", () => {
  it("uses the discovery manifest's raw team names as the primary display label, for both teams", () => {
    const files = buildCuratedDataset(
      baseInput({
        matches: [buildNormalizedMatch({ teamAId: "vlr:team:11058", teamBId: "paper-rex" })],
        matchManifestEntries: [{ vlrMatchId: "1", eventId: "vlr:event:1", eventFamily: "masters", matchUrl: "u", listedStatus: "completed", discoverySourceUrl: "u", discoveryTimestamp: "t", detailFetchStatus: "fetched", teamANameRaw: "G2 Esports", teamBNameRaw: "Paper Rex" }],
      }),
    );
    const match = matchesOf(files)[0]!;
    expect(match.teamADisplayName).toBe("G2 Esports");
    expect(match.teamBDisplayName).toBe("Paper Rex");
    // The canonical identifier is untouched — display name is additive, never a replacement.
    expect(match.teamAId).toBe("vlr:team:11058");
    expect(match.teamBId).toBe("paper-rex");
  });

  it("falls back to a title-cased canonical slug when discovery has no raw name for a mapped team", () => {
    const files = buildCuratedDataset(baseInput({ matches: [buildNormalizedMatch({ teamAId: "paper-rex" })], matchManifestEntries: [] }));
    expect(matchesOf(files)[0]!.teamADisplayName).toBe("Paper Rex");
  });

  it("falls back to the raw provider ID only when a team is both unmapped and missing a raw name — the last resort, never a fabricated name", () => {
    const files = buildCuratedDataset(baseInput({ matches: [buildNormalizedMatch({ teamAId: "vlr:team:99999" })], matchManifestEntries: [] }));
    expect(matchesOf(files)[0]!.teamADisplayName).toBe("vlr:team:99999");
  });

  it("resolves matchStageDisplay from the discovery manifest's round-stage text when present", () => {
    const files = buildCuratedDataset(
      baseInput({
        matches: [buildNormalizedMatch()],
        matchManifestEntries: [{ vlrMatchId: "1", eventId: "vlr:event:1", eventFamily: "masters", matchUrl: "u", listedStatus: "completed", discoverySourceUrl: "u", discoveryTimestamp: "t", detailFetchStatus: "fetched", roundStageText: "Grand Final Playoffs" }],
      }),
    );
    expect(matchesOf(files)[0]!.matchStageDisplay).toBe("Grand Final Playoffs");
  });

  it("falls back to the event's own stage, then to the explicit \"unknown\" category, when discovery has no round-stage text", () => {
    const withEventStage = buildCuratedDataset(
      baseInput({
        matches: [buildNormalizedMatch()],
        events: [{ internalId: "vlr:event:1", name: "Test Event", status: "completed", startDate: { iso: null, raw: "r", confidence: "none" }, endDate: { iso: null, raw: "r", confidence: "none" }, tournamentLevel: "international", stage: "Masters", eventFamily: "masters", classification: { classification: "masters", confidence: "authoritative", reason: "r", evidence: [] }, metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" } }],
        eventCategoryByInternalId: new Map([["vlr:event:1", "current-approved"]]),
      }),
    );
    expect(matchesOf(withEventStage)[0]!.matchStageDisplay).toBe("Masters");

    const withNeither = buildCuratedDataset(baseInput({ matches: [buildNormalizedMatch()] }));
    expect(matchesOf(withNeither)[0]!.matchStageDisplay).toBe("unknown");
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
