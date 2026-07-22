import { describe, expect, it } from "vitest";
import { buildCuratedMatch } from "../testUtils/curatedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { runFeatureStateEngine } from "./stateEngine";
import { buildEventsById } from "./curatedSource";
import { DEFAULT_ELO_CONFIG } from "./versions";
import { FEATURE_CATALOG, featureCatalogFieldNames } from "./featureCatalog";

function buildEvent(): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "raw", confidence: "high" },
    endDate: { iso: "2025-01-10T00:00:00.000Z", raw: "raw", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "authoritative", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
  };
}

describe("FEATURE_CATALOG", () => {
  it("has no duplicate field names", () => {
    const names = featureCatalogFieldNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it("describes every key that actually appears on a generated FeatureRow, and no extra ones", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const rowKeys = new Set(Object.keys(rows[0]!));
    const catalogNames = new Set(featureCatalogFieldNames());

    const missingFromCatalog = [...rowKeys].filter((k) => !catalogNames.has(k));
    const extraInCatalog = [...catalogNames].filter((k) => !rowKeys.has(k));

    expect(missingFromCatalog).toEqual([]);
    expect(extraInCatalog).toEqual([]);
  });

  it("every catalog entry declares a non-empty description and feature group", () => {
    for (const field of FEATURE_CATALOG) {
      expect(field.description.length).toBeGreaterThan(0);
      expect(field.featureGroup.length).toBeGreaterThan(0);
    }
  });
});
