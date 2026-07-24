/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { maps } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { PredictionStudioClient } from "./PredictionStudioClient";
import { EMPTY_CANONICAL_URL_STATE, type CanonicalUrlState } from "../../lib/urlState";

let mockSearch = "";
const replaceCalls: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      replaceCalls.push(url);
      const queryIndex = url.indexOf("?");
      mockSearch = queryIndex === -1 ? "" : url.slice(queryIndex + 1);
    },
  }),
  usePathname: () => "/prediction-studio",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

afterEach(() => {
  cleanup();
  mockSearch = "";
  replaceCalls.length = 0;
  vi.unstubAllGlobals();
});

function baseRealResult() {
  return {
    mode: "current-real-model",
    requestId: "req-1",
    teamAId: "paper-rex",
    teamBId: "g2-esports",
    seriesFormat: "BO3",
    tournamentTier: "international",
    eventRegion: "international",
    modelVersion: "fixture-model-v1",
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    teamAWinProbability: 0.58,
    teamBWinProbability: 0.42,
    predictedWinnerSide: "teamA",
    confidence: 0.2,
    warnings: [],
    predictionGeneratedAt: new Date().toISOString(),
    inferenceDurationMs: 0.6,
    dataProvenance: {
      sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
      featureSchemaVersion: "fixture-feature-schema@1.0.0",
      canonicalWindowStartIso: "2025-06-07T12:00:00.000Z",
      modelTrainDateRangeEndIso: "2026-04-24T11:00:00.000Z",
      asOfIso: "2026-07-18T04:00:00.000Z",
      constructedFromRealFeatureData: true,
    },
    teamAConfidence: { teamId: "paper-rex", confidence: "verified", seriesCountInWindow: 30 },
    teamBConfidence: { teamId: "g2-esports", confidence: "verified", seriesCountInWindow: 25 },
    teamAState: {
      teamId: "paper-rex",
      isColdStart: false,
      eloRating: 1550,
      recentFormWinRate: 0.6,
      formTrend: 0.05,
      opponentAdjustedRating: 1500,
      strengthOfSchedule: 1480,
      mapPoolBreadth: 7,
      recentMapWinRate: 0.55,
      avgRoundsWonPerMap: 13,
      avgRoundsLostPerMap: 10,
      daysSinceLastMatch: 5,
      isBackToBack: false,
      priorInternationalAppearances: 3,
      priorMastersChampionsAppearances: 1,
      seriesCountInWindow: 30,
    },
    teamBState: {
      teamId: "g2-esports",
      isColdStart: false,
      eloRating: 1480,
      recentFormWinRate: 0.5,
      formTrend: -0.02,
      opponentAdjustedRating: 1470,
      strengthOfSchedule: 1460,
      mapPoolBreadth: 6,
      recentMapWinRate: 0.5,
      avgRoundsWonPerMap: 12,
      avgRoundsLostPerMap: 11,
      daysSinceLastMatch: 8,
      isBackToBack: false,
      priorInternationalAppearances: 2,
      priorMastersChampionsAppearances: 0,
      seriesCountInWindow: 25,
    },
    contribution: {
      driverLabel: "Elo rating differential",
      driverDifferential: 70,
      uncalibratedProbability: 0.58,
      calibrationAdjustment: 0,
      finalProbability: 0.58,
      isSoleDriver: true,
    },
    supportingContext: [
      { id: "recent-form", label: "Recent Form", favoredSide: "teamA", teamAValue: 0.6, teamBValue: 0.5, description: "Win rate across each team's last 10 real matches. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "opponent-adjusted-strength", label: "Opponent-Adjusted Strength", favoredSide: "teamA", teamAValue: 1500, teamBValue: 1470, description: "Average real opponent Elo faced in each team's last 10 matches. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "map-pool-breadth", label: "Map Pool Breadth", favoredSide: "teamA", teamAValue: 7, teamBValue: 6, description: "Count of distinct real maps each team has recorded matches on. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "schedule-strength", label: "Strength of Schedule", favoredSide: "teamA", teamAValue: 1480, teamBValue: 1460, description: "Average real opponent Elo across each team's entire match history. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "activity-rest", label: "Activity & Rest", favoredSide: "teamA", teamAValue: 5, teamBValue: 8, description: "Days since each team's last real match (-1 means no real match history). Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "competition-experience", label: "Competition Experience", favoredSide: "teamA", teamAValue: 4, teamBValue: 2, description: "Combined real prior International/Masters/Champions roster appearances. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
    ],
    evidenceTrust: {
      score: 78,
      explanation: "30 real series for team A and 25 for team B in the canonical data window. 2 prior real meeting(s) between these exact teams.",
      teamASeriesCount: 30,
      teamBSeriesCount: 25,
      teamAIdentityConfidence: "verified",
      teamBIdentityConfidence: "verified",
      h2hMeetingCount: 2,
    },
    headToHead: { priorMeetingCount: 2, teamAWins: 1, teamBWins: 1, teamAWinRate: 0.5, priorMapDifferential: 0, meetingsLast365Days: 2 },
    mapEvidence: {
      teamAMapPoolBreadth: 7,
      teamBMapPoolBreadth: 6,
      teamARecentMapWinRate: 0.55,
      teamBRecentMapWinRate: 0.5,
      teamACumulativeMapWinRate: 0.52,
      teamBCumulativeMapWinRate: 0.48,
      teamAAvgRoundsWonPerMap: 13,
      teamBAvgRoundsWonPerMap: 12,
      teamAAvgRoundsLostPerMap: 10,
      teamBAvgRoundsLostPerMap: 11,
      knownMapPoolOverlapCount: 5,
      mapStrengthDifferential: 0.04,
      evidenceLevel: "sufficient",
    },
    pipeline: [
      { id: "match-request", label: "Match Request", description: "Received the selected teams, series format, and tournament tier.", durationMs: null },
      { id: "run-estimator", label: "Run Selected Estimator", description: "Scored the encoded row with the currently selected estimator.", durationMs: 0.6 },
      { id: "generate-explanation", label: "Generate Human-Readable Explanation", description: "Built the deterministic explanation from the estimator's actual driver and supporting real context.", durationMs: null },
    ],
  };
}

/**
 * Both "Real Model 2.0" (default toggle position) and "Real Model 1.0" now
 * hit the exact same real endpoint, `/api/internal/prediction/current` — a
 * single mock branch serves both. `realResponse`/`realOk` let a test steer
 * what that one endpoint returns for either mode's submission.
 */
function installPredictionFetchMock(options: { realResponse?: unknown; realOk?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/internal/prediction/current") {
        const ok = options.realOk ?? true;
        return { ok, json: async () => options.realResponse ?? baseRealResult() } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
}

function renderClient(initialUrlState: CanonicalUrlState = EMPTY_CANONICAL_URL_STATE, fetchOptions: { realResponse?: unknown; realOk?: boolean } = {}) {
  installPredictionFetchMock(fetchOptions);
  render(
    <PredictionStudioClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      maps={maps}
      initialUrlState={initialUrlState}
    />,
  );
}

describe("PredictionStudioClient", () => {
  it("initializes region/team/format/map selections from URL state", () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent", "haven"],
      format: "BO5",
      mode: null,
    });

    expect(screen.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /G2 Esports/ })).toHaveAttribute("aria-pressed", "true");
    const seriesFormatGroup = screen.getByRole("group", { name: "Series Format" });
    expect(within(seriesFormatGroup).getByRole("button", { name: "Best of 5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ascent" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Haven" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not auto-submit a prediction even when URL state is fully complete", async () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent"],
      format: "BO3",
      mode: null,
    });

    // Give any accidental effect a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Predicted Winner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Prediction" })).toBeEnabled();
  });

  it("shows draft-level cross-feature links once both teams are selected, before any result", () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: [],
      format: null,
      mode: null,
    });

    expect(screen.getByRole("link", { name: /Compare Teams/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Maps/ })).toBeInTheDocument();
  });

  it("replaces draft-level links with result-scoped links once a prediction is generated", async () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent"],
      format: "BO3",
      mode: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));
    await screen.findByText("Predicted Winner");

    // Exactly one set of links remains, and it reflects the result's teams.
    const compareLinks = screen.getAllByRole("link", { name: /Compare Teams/ });
    expect(compareLinks).toHaveLength(1);
    expect(compareLinks[0]).toHaveAccessibleName(expect.stringMatching(/Paper Rex/));
  });

  it("keeps result-level links stable when the draft controls change after a result exists", async () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent"],
      format: "BO3",
      mode: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));
    await screen.findByText("Predicted Winner");

    const linkBefore = screen.getByRole("link", { name: /Compare Teams/ }).getAttribute("href");

    // Change the draft's series format after the result already exists.
    const seriesFormatGroup = screen.getByRole("group", { name: "Series Format" });
    fireEvent.click(within(seriesFormatGroup).getByRole("button", { name: "Best of 5" }));

    const linkAfter = screen.getByRole("link", { name: /Compare Teams/ }).getAttribute("href");
    expect(linkAfter).toBe(linkBefore);
  });

  it("updates the URL when a team selection changes, without reloading", async () => {
    renderClient();

    const regionGroup = screen.getByRole("group", { name: "Team A region" });
    fireEvent.click(within(regionGroup).getByRole("button", { name: /Pacific/ }));
    const teamGroup = screen.getByRole("group", { name: "Team A team" });
    fireEvent.click(within(teamGroup).getByRole("button", { name: /Paper Rex/ }));

    await waitFor(() => expect(replaceCalls.length).toBeGreaterThan(0));
    expect(replaceCalls.at(-1)).toContain("teamA=paper-rex");
  });

  it("clears the team parameter when its region changes", async () => {
    renderClient({ ...EMPTY_CANONICAL_URL_STATE, regionA: "pacific", teamA: "paper-rex" });

    const regionGroup = screen.getByRole("group", { name: "Team A region" });
    fireEvent.click(within(regionGroup).getByRole("button", { name: /EMEA/ }));

    await waitFor(() => expect(replaceCalls.length).toBeGreaterThan(0));
    expect(replaceCalls.at(-1)).not.toContain("teamA=paper-rex");
    expect(replaceCalls.at(-1)).toContain("regionA=emea");
  });

  describe("Real Model 1.0 mode", () => {
    function submitRealPrediction() {
      const modeGroup = screen.getByRole("group", { name: "Prediction Mode" });
      fireEvent.click(within(modeGroup).getByRole("button", { name: "Real Model 1.0" }));
      const tierGroup = screen.getByRole("group", { name: "Match Context (assumed)" });
      fireEvent.click(within(tierGroup).getByRole("button", { name: "International" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));
    }

    it("shows the real result, never the synthetic one, and never calls the synthetic endpoint", async () => {
      renderClient({
        regionA: "pacific",
        teamA: "paper-rex",
        regionB: "americas",
        teamB: "g2-esports",
        maps: [],
        format: null,
        mode: null,
      });

      submitRealPrediction();

      await screen.findByText("Real-model prediction");
      expect(screen.queryByText("Predicted Winner")).not.toBeInTheDocument();
      expect(window.fetch).not.toHaveBeenCalledWith("/api/vct-prediction", expect.anything());
      expect(window.fetch).not.toHaveBeenCalledWith("/api/simulate-prediction", expect.anything());
    });

    it("displays model version, estimator, and feature dataset provenance", async () => {
      renderClient({
        regionA: "pacific",
        teamA: "paper-rex",
        regionB: "americas",
        teamB: "g2-esports",
        maps: [],
        format: null,
        mode: null,
      });

      submitRealPrediction();

      await screen.findByText("fixture-model-v1");
      expect(screen.getByText("elo-baseline")).toBeInTheDocument();
      expect(screen.getByText("fixture-feature-dataset-v1")).toBeInTheDocument();
    });

    it("shows a warning for a provisional/limited-data team instead of an unexplained default", async () => {
      renderClient(
        {
          regionA: "pacific",
          teamA: "paper-rex",
          regionB: "americas",
          teamB: "g2-esports",
          maps: [],
          format: null,
          mode: null,
        },
        {
          realResponse: {
            ...baseRealResult(),
            teamBConfidence: { teamId: "g2-esports", confidence: "provisional", seriesCountInWindow: 2 },
            warnings: ["G2 Esports has limited real match history (2 matches) or an unverified identity mapping: treat this prediction with reduced confidence for that team."],
          },
        },
      );

      submitRealPrediction();

      await screen.findByText(/limited real match history/);
      expect(screen.getByText(/Provisional data/)).toBeInTheDocument();
    });

    it("shows a labeled error (never a crash, never a fallback to the synthetic result) when the real request fails", async () => {
      renderClient(
        {
          regionA: "pacific",
          teamA: "paper-rex",
          regionB: "americas",
          teamB: "g2-esports",
          maps: [],
          format: null,
          mode: null,
        },
        { realOk: false, realResponse: { code: "request_invalid", message: "teamAId is not a known VCT team.", retryable: false } },
      );

      submitRealPrediction();

      await screen.findByText(/teamAId is not a known VCT team\./);
      expect(screen.queryByText("Real-model prediction")).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Team A region" })).toBeInTheDocument();
    });

    it("keeps the mode toggle explicit — Real Model 2.0 stays selectable and never auto-switches", async () => {
      renderClient({
        regionA: "pacific",
        teamA: "paper-rex",
        regionB: "americas",
        teamB: "g2-esports",
        maps: [],
        format: null,
        mode: null,
      });

      const modeGroup = screen.getByRole("group", { name: "Prediction Mode" });
      expect(modeGroup.querySelector('[aria-pressed="true"]')).toHaveTextContent("Real Model 2.0");

      fireEvent.click(within(modeGroup).getByRole("button", { name: "Real Model 1.0" }));
      expect(modeGroup.querySelector('[aria-pressed="true"]')).toHaveTextContent("Real Model 1.0");

      fireEvent.click(within(modeGroup).getByRole("button", { name: "Real Model 2.0" }));
      expect(modeGroup.querySelector('[aria-pressed="true"]')).toHaveTextContent("Real Model 2.0");
    });
  });

  describe("Real Model 2.0 mode (default)", () => {
    it("is the default mode, and renders the rich Synthetic-Scenario-shaped UI populated with real data", async () => {
      renderClient({
        regionA: "pacific",
        teamA: "paper-rex",
        regionB: "americas",
        teamB: "g2-esports",
        maps: ["ascent"],
        format: "BO3",
        mode: null,
      });

      const modeGroup = screen.getByRole("group", { name: "Prediction Mode" });
      expect(modeGroup.querySelector('[aria-pressed="true"]')).toHaveTextContent("Real Model 2.0");

      fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));

      await screen.findByText("Predicted Winner");
      expect(screen.getByText("Interactive Prediction Breakdown")).toBeInTheDocument();
      expect(screen.getByText("What-if Simulator")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Match DNA" })).toBeInTheDocument();
      expect(screen.getByText("Why This Prediction")).toBeInTheDocument();
      expect(screen.queryByText("Real-model prediction")).not.toBeInTheDocument();
    });

    it("never calls the synthetic prediction API or the synthetic simulator API", async () => {
      renderClient({
        regionA: "pacific",
        teamA: "paper-rex",
        regionB: "americas",
        teamB: "g2-esports",
        maps: ["ascent"],
        format: "BO3",
        mode: null,
      });

      fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));
      await screen.findByText("Predicted Winner");

      expect(window.fetch).toHaveBeenCalledWith("/api/internal/prediction/current", expect.anything());
      expect(window.fetch).not.toHaveBeenCalledWith("/api/vct-prediction", expect.anything());
      expect(window.fetch).not.toHaveBeenCalledWith("/api/vct-profile-baseline", expect.anything());
      expect(window.fetch).not.toHaveBeenCalledWith("/api/simulate-prediction", expect.anything());
    });

    it("shows a labeled error with a working Retry, never a silent fallback, on a failed request", async () => {
      renderClient(
        {
          regionA: "pacific",
          teamA: "paper-rex",
          regionB: "americas",
          teamB: "g2-esports",
          maps: ["ascent"],
          format: "BO3",
          mode: null,
        },
        { realOk: false, realResponse: { code: "request_invalid", message: "teamAId is not a known VCT team.", retryable: false } },
      );

      fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));

      const errorText = await screen.findByText(/teamAId is not a known VCT team\./);
      const alert = errorText.closest('[role="alert"]') as HTMLElement;
      expect(screen.queryByText("Predicted Winner")).not.toBeInTheDocument();
      expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });
});
