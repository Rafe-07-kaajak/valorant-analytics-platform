import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import { runFeatureBuild, runFeatureBuildAndWrite } from "../feature/featureBuild";
import { DEFAULT_ELO_CONFIG } from "../feature/versions";

/**
 * End-to-end TASK-044 pipeline integration test — TASK-044 requirement 25.
 * Writes a small synthetic curated dataset directly to disk (mirroring the
 * exact shape TASK-043's `curate/curatedExport.ts` produces), then drives
 * the full audit → build → validate → export pipeline against it, entirely
 * without network access.
 */
let dataDir: string;

/**
 * These fixtures predate the canonical-window feature and test general
 * feature-engineering correctness, not window semantics — pointing the
 * anchor at this suite's own synthetic event (rather than the real Masters
 * Toronto 2025 anchor) keeps every fixture match eligible, preserving each
 * test's original assertions unchanged.
 */
const WINDOW_OPTIONS = { canonicalWindowEventName: "VCT 2025: Americas Stage 1" };

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "vlr-task044-pipeline-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:100",
    name: "VCT 2025: Americas Stage 1",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
    endDate: { iso: "2025-03-01T00:00:00.000Z", raw: "r", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "high", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "100", sourceUrl: "https://www.vlr.gg/event/100", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

async function writeCuratedFixture(matches: readonly NormalizedMatch[], events: readonly NormalizedEvent[], curatedDatasetVersion = "fixture-v1"): Promise<void> {
  const curatedDir = join(dataDir, "curated");
  await mkdir(curatedDir, { recursive: true });
  await writeFile(join(curatedDir, "matches.json"), JSON.stringify(matches), "utf-8");
  await writeFile(join(curatedDir, "events.json"), JSON.stringify(events), "utf-8");
  await writeFile(
    join(curatedDir, "dataset-manifest.json"),
    JSON.stringify({ curatedDatasetVersion, curatedMatchCount: matches.length, curatedEventCount: events.length, eligibleMatchCount: matches.length, sourceDatasetVersion: "src-v1" }),
    "utf-8",
  );
}

describe("TASK-044 feature pipeline integration", () => {
  it("builds a full deterministic feature export from a small curated dataset", async () => {
    const matchOne = buildNormalizedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: "vlr:event:100" });
    await writeCuratedFixture([matchOne], [buildEvent()]);

    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    expect(result.rows).toHaveLength(1);
    expect(result.rowValidation.valid).toBe(true);
    expect(result.splitValidation.valid).toBe(true);
    expect(Object.keys(result.files)).toContain("feature-rows.json");
    expect(Object.keys(result.files)).toContain("feature-catalog.json");
  });

  it("produces deterministic chronological output regardless of source match order", async () => {
    const early = buildNormalizedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-a",
      teamBId: "team-b",
      winnerId: "team-a",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h1" },
    });
    const late = buildNormalizedMatch({
      internalId: "vlr:match:2",
      teamAId: "team-a",
      teamBId: "team-c",
      winnerId: "team-c",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "u2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" },
    });

    await writeCuratedFixture([early, late], [buildEvent()]);
    const forward = await runFeatureBuild(dataDir, WINDOW_OPTIONS);

    await writeCuratedFixture([late, early], [buildEvent()]);
    const reversed = await runFeatureBuild(dataDir, WINDOW_OPTIONS);

    expect(forward.rows.map((r) => r.matchInternalId)).toEqual(reversed.rows.map((r) => r.matchInternalId));
    expect(forward.rows).toEqual(reversed.rows);
  });

  it("handles same-timestamp matches without cross-match leakage", async () => {
    const sameTime = "2025-01-01T00:00:00.000Z";
    const matchOne = buildNormalizedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-a",
      teamBId: "team-b",
      winnerId: "team-a",
      eventId: "vlr:event:100",
      scheduledAt: { iso: sameTime, raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h1" },
    });
    const matchTwo = buildNormalizedMatch({
      internalId: "vlr:match:2",
      teamAId: "team-a",
      teamBId: "team-c",
      winnerId: "team-c",
      eventId: "vlr:event:100",
      scheduledAt: { iso: sameTime, raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "u2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" },
    });
    await writeCuratedFixture([matchOne, matchTwo], [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    const rowOne = result.rows.find((r) => r.matchInternalId === "vlr:match:1")!;
    const rowTwo = result.rows.find((r) => r.matchInternalId === "vlr:match:2")!;
    expect(rowOne.teamAPriorMatchCount).toBe(0);
    expect(rowTwo.teamAPriorMatchCount).toBe(0);
  });

  it("gives cold-start teams explicit defaults, not fabricated history", async () => {
    const match = buildNormalizedMatch({ internalId: "vlr:match:1", teamAId: "brand-new-team-a", teamBId: "brand-new-team-b", winnerId: "brand-new-team-a", eventId: "vlr:event:100" });
    await writeCuratedFixture([match], [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    const row = result.rows[0]!;
    expect(row.teamAIsColdStart).toBe(true);
    expect(row.teamBIsColdStart).toBe(true);
    expect(row.teamAEloRating).toBe(DEFAULT_ELO_CONFIG.initialRating);
  });

  it("flags missing roster data explicitly rather than guessing", async () => {
    const match = buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:100", rosterSnapshots: [] });
    await writeCuratedFixture([match], [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    expect(result.rows[0]!.teamARosterSnapshotAvailable).toBe(false);
    expect(result.rows[0]!.teamBRosterSnapshotAvailable).toBe(false);
  });

  it("counts an unknown map without misclassifying it as an unplayed placeholder", async () => {
    const match = buildNormalizedMatch({
      internalId: "vlr:match:1",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
      maps: [{ map: { name: "Summit", raw: "Summit", recognized: false }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] }],
    });
    const second = buildNormalizedMatch({
      internalId: "vlr:match:2",
      teamAId: "fnatic",
      teamBId: "some-other-team",
      winnerId: "fnatic",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2025-02-01T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "u2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" },
    });
    await writeCuratedFixture([match, second], [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    const secondRow = result.rows.find((r) => r.matchInternalId === "vlr:match:2")!;
    expect(secondRow.teamAUnknownMapCount).toBe(1);
    expect(secondRow.teamAMapPoolBreadth).toBe(0);
  });

  it("lets 2025 history influence a later 2026 row, but never the reverse", async () => {
    const match2025 = buildNormalizedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-a",
      teamBId: "team-b",
      winnerId: "team-a",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h1" },
    });
    const match2026 = buildNormalizedMatch({
      internalId: "vlr:match:2",
      teamAId: "team-a",
      teamBId: "team-c",
      winnerId: "team-a",
      eventId: "vlr:event:100",
      scheduledAt: { iso: "2026-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "u2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" },
    });
    await writeCuratedFixture([match2025, match2026], [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    const row2025 = result.rows.find((r) => r.matchInternalId === "vlr:match:1")!;
    const row2026 = result.rows.find((r) => r.matchInternalId === "vlr:match:2")!;
    expect(row2025.teamAPriorMatchCount).toBe(0); // 2026 result never reaches back
    expect(row2026.teamAPriorMatchCount).toBe(1); // 2025 result correctly precedes it
    expect(row2026.teamAPriorWins).toBe(1);
  });

  it("passes validation end-to-end and assigns every row to exactly one split", async () => {
    const matches = Array.from({ length: 10 }, (_, i) =>
      buildNormalizedMatch({
        internalId: `vlr:match:${i}`,
        teamAId: "team-a",
        teamBId: `team-${i}`,
        winnerId: i % 2 === 0 ? "team-a" : `team-${i}`,
        eventId: "vlr:event:100",
        scheduledAt: { iso: new Date(i * 86_400_000).toISOString(), raw: "r", confidence: "high" },
        metadata: { provider: "vlr", providerExternalId: String(i), sourceUrl: `u${i}`, fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: `h${i}` },
      }),
    );
    await writeCuratedFixture(matches, [buildEvent()]);
    const result = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    expect(result.rowValidation.valid).toBe(true);
    expect(result.splitValidation.valid).toBe(true);
    expect(result.splitAssignments).toHaveLength(10);
  });

  it("is idempotent: building twice from unchanged curated input reproduces the same file hashes and featureDatasetVersion", async () => {
    const match = buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:100" });
    await writeCuratedFixture([match], [buildEvent()]);

    const first = await runFeatureBuildAndWrite(dataDir, WINDOW_OPTIONS);
    const second = await runFeatureBuildAndWrite(dataDir, WINDOW_OPTIONS);

    expect(second.version.featureDatasetVersion).toBe(first.version.featureDatasetVersion);
    // feature-manifest.json, feature-audit.json, and canonical-window.json
    // all carry their own generatedAt/derivedAt timestamp, expected to differ
    // between two real build invocations — every other file must be
    // byte-identical.
    const timestampedFiles = new Set(["feature-manifest.json", "feature-audit.json", "canonical-window.json"]);
    for (const fileName of Object.keys(first.fileHashes)) {
      if (timestampedFiles.has(fileName)) continue;
      expect(second.fileHashes[fileName]).toBe(first.fileHashes[fileName]);
    }
  });

  it("changes featureDatasetVersion when the rating configuration changes, but not when it's unchanged", async () => {
    const match = buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:100" });
    await writeCuratedFixture([match], [buildEvent()]);

    const baseline = await runFeatureBuild(dataDir, WINDOW_OPTIONS);
    const sameConfig = await runFeatureBuild(dataDir, { ...WINDOW_OPTIONS, eloConfig: DEFAULT_ELO_CONFIG });
    const differentConfig = await runFeatureBuild(dataDir, { ...WINDOW_OPTIONS, eloConfig: { ...DEFAULT_ELO_CONFIG, kFactor: 40 } });

    expect(sameConfig.version.featureDatasetVersion).toBe(baseline.version.featureDatasetVersion);
    expect(differentConfig.version.featureDatasetVersion).not.toBe(baseline.version.featureDatasetVersion);
  });

  it("never requires network access to build (VLR_NETWORK_ENABLED stays false throughout)", async () => {
    expect(process.env.VLR_NETWORK_ENABLED).toBe("false");
    const match = buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:100" });
    await writeCuratedFixture([match], [buildEvent()]);
    await expect(runFeatureBuild(dataDir, WINDOW_OPTIONS)).resolves.toBeDefined();
  });
});
