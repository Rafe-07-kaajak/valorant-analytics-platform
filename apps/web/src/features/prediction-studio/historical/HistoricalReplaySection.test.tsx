/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { HistoricalCatalogResponse, HistoricalPredictionResponse, RealPredictionReadiness } from "@repo/shared";
import { HistoricalReplaySection } from "./HistoricalReplaySection";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function unavailableReadiness(overrides: Partial<RealPredictionReadiness> = {}): RealPredictionReadiness {
  return {
    realPredictionAvailable: false,
    modelStatus: "unloaded",
    historicalDataAvailable: false,
    message: "The historical feature dataset is not available locally.",
    retryable: true,
    ...overrides,
  };
}

function availableReadiness(): RealPredictionReadiness {
  return {
    realPredictionAvailable: true,
    modelStatus: "ready",
    historicalDataAvailable: true,
    currentModelVersion: "aa85997f41de1264",
    sourceFeatureDatasetVersion: "64591ef5a24f9a0b",
    message: "Historical model replay is available.",
    retryable: false,
  };
}

function catalogWithOneMatch(): HistoricalCatalogResponse {
  return {
    matches: [
      {
        matchInternalId: "vlr:match:1001",
        scheduledAt: "2026-02-20T05:00:00.000Z",
        eventFamily: "masters",
        eventName: "Valorant Masters Bangkok 2025",
        eventRegion: "international",
        tournamentLevel: "tier-1",
        matchStageDisplay: "Grand Final",
        seriesFormat: "BO3",
        teamAProviderId: "vlr:team:1120",
        teamBProviderId: "vlr:team:474",
        teamADisplayName: "Sentinels",
        teamBDisplayName: "Paper Rex",
        modelEligible: true,
        featureDatasetVersion: "64591ef5a24f9a0b",
      },
    ],
    total: 1,
    featureDatasetVersion: "64591ef5a24f9a0b",
  };
}

function predictionResult(): HistoricalPredictionResponse {
  return {
    mode: "historical-real-model",
    requestId: "req-1",
    match: {
      matchInternalId: "vlr:match:1001",
      scheduledAt: "2026-02-20T05:00:00.000Z",
      eventFamily: "masters",
      eventName: "Valorant Masters Bangkok 2025",
      eventRegion: "international",
      tournamentLevel: "tier-1",
      matchStageDisplay: "Grand Final",
      seriesFormat: "BO3",
      teamAProviderId: "vlr:team:1120",
      teamBProviderId: "vlr:team:474",
      teamADisplayName: "Sentinels",
      teamBDisplayName: "Paper Rex",
    },
    modelVersion: "aa85997f41de1264",
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    sourceFeatureDatasetVersion: "64591ef5a24f9a0b",
    featureSchemaVersion: "vlr-feature-schema@1.0.0",
    teamAWinProbability: 0.62,
    teamBWinProbability: 0.38,
    predictedWinnerSide: "teamA",
    confidence: 0.24,
    warnings: [],
    predictionGeneratedAt: new Date().toISOString(),
    inferenceDurationMs: 0.5,
    dataProvenance: {
      sourceFeatureDatasetVersion: "64591ef5a24f9a0b",
      featureSchemaVersion: "vlr-feature-schema@1.0.0",
      generatedFromHistoricalSnapshot: true,
      modelTrainDateRangeEndIso: "2026-04-24T11:00:00.000Z",
      temporalFidelity: "point-in-time",
    },
    resultAvailability: { actualResultRevealable: false },
  };
}

function installFetchMock(handlers: { readiness?: () => RealPredictionReadiness; catalog?: () => HistoricalCatalogResponse; predict?: () => HistoricalPredictionResponse }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/internal/prediction/readiness") {
        return { ok: true, json: async () => handlers.readiness?.() } as Response;
      }
      if (url.startsWith("/api/internal/prediction/catalog")) {
        return { ok: true, json: async () => handlers.catalog?.() } as Response;
      }
      if (url === "/api/internal/prediction/historical" && init?.method === "POST") {
        return { ok: true, json: async () => handlers.predict?.() } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
}

describe("HistoricalReplaySection", () => {
  it("shows the unavailable message and keeps a retry action when real prediction is unavailable", async () => {
    installFetchMock({ readiness: () => unavailableReadiness() });
    render(<HistoricalReplaySection />);

    await screen.findByText(/not available locally/);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Historical matches" })).not.toBeInTheDocument();
  });

  it("loads and displays the historical match catalog once real prediction is available", async () => {
    installFetchMock({ readiness: () => availableReadiness(), catalog: () => catalogWithOneMatch() });
    render(<HistoricalReplaySection />);

    const group = await screen.findByRole("group", { name: "Historical matches" });
    expect(group).toBeInTheDocument();
    expect(screen.getByText(/Sentinels vs Paper Rex/)).toBeInTheDocument();
  });

  it("shows an empty state when the catalog has no matches", async () => {
    installFetchMock({ readiness: () => availableReadiness(), catalog: () => ({ matches: [], total: 0, featureDatasetVersion: "v1" }) });
    render(<HistoricalReplaySection />);

    await screen.findByText("No historical matches are available for replay yet.");
  });

  it("selecting a match runs a prediction and displays the labeled real-model result", async () => {
    installFetchMock({ readiness: () => availableReadiness(), catalog: () => catalogWithOneMatch(), predict: () => predictionResult() });
    render(<HistoricalReplaySection />);

    const matchButton = await screen.findByRole("button", { name: /Sentinels vs Paper Rex/ });
    fireEvent.click(matchButton);

    await screen.findByText("Real trained model");
    expect(screen.getByText("Point-in-time")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("aa85997f41de1264")).toBeInTheDocument();
    await waitFor(() => expect(matchButton).toHaveAttribute("aria-pressed", "true"));
  });

  it("shows a retryable error state when the prediction request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/internal/prediction/readiness") return { ok: true, json: async () => availableReadiness() } as Response;
        if (url.startsWith("/api/internal/prediction/catalog")) return { ok: true, json: async () => catalogWithOneMatch() } as Response;
        if (url === "/api/internal/prediction/historical" && init?.method === "POST") {
          return { ok: false, json: async () => ({ code: "model_unavailable", message: "The prediction model is not currently available.", retryable: true }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
    render(<HistoricalReplaySection />);

    const matchButton = await screen.findByRole("button", { name: /Sentinels vs Paper Rex/ });
    fireEvent.click(matchButton);

    await screen.findByText("The prediction model is not currently available.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("does not render the real-model result heading before a match is selected", async () => {
    installFetchMock({ readiness: () => availableReadiness(), catalog: () => catalogWithOneMatch() });
    render(<HistoricalReplaySection />);

    await screen.findByRole("group", { name: "Historical matches" });
    expect(screen.queryByText("Real trained model")).not.toBeInTheDocument();
  });

  it("shows a Load more control when the archive has more matches than the current page, and requests a larger page on click", async () => {
    function pageOfMatches(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        matchInternalId: `vlr:match:${1000 + i}`,
        scheduledAt: `2026-0${(i % 9) + 1}-01T00:00:00.000Z`,
        eventFamily: "masters",
        eventName: "Valorant Masters Bangkok 2025",
        eventRegion: "international",
        tournamentLevel: "tier-1",
        matchStageDisplay: "Swiss Stage",
        seriesFormat: "BO3",
        teamAProviderId: `vlr:team:${i}a`,
        teamBProviderId: `vlr:team:${i}b`,
        teamADisplayName: `Team ${i}A`,
        teamBDisplayName: `Team ${i}B`,
        modelEligible: true,
        featureDatasetVersion: "64591ef5a24f9a0b",
      }));
    }

    let lastRequestedLimit: number | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/internal/prediction/readiness") return { ok: true, json: async () => availableReadiness() } as Response;
        if (url.startsWith("/api/internal/prediction/catalog")) {
          const limit = Number(new URL(url, "http://localhost").searchParams.get("limit"));
          lastRequestedLimit = limit;
          return { ok: true, json: async () => ({ matches: pageOfMatches(Math.min(limit, 120)), total: 120, featureDatasetVersion: "64591ef5a24f9a0b" }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<HistoricalReplaySection />);

    const loadMore = await screen.findByRole("button", { name: /Load more \(50 of 120\)/ });
    expect(lastRequestedLimit).toBe(50);

    fireEvent.click(loadMore);

    await waitFor(() => expect(lastRequestedLimit).toBe(100));
    await screen.findByRole("button", { name: /Load more \(100 of 120\)/ });
  });
});
