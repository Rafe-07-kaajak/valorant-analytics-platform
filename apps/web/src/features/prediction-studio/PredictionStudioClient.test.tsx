/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PredictionResult } from "@repo/shared";
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

function baseResult(): PredictionResult {
  return {
    predictionId: "p1",
    requestId: "r1",
    scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent", "haven"] },
    outcomes: [
      { teamId: "paper-rex", winProbability: 0.6 },
      { teamId: "g2-esports", winProbability: 0.4 },
    ],
    predictedWinnerId: "paper-rex",
    confidence: 70,
    trustScore: 80,
    explanation: "Paper Rex is favored.",
    teamDna: [
      { teamId: "paper-rex", dimensions: [{ key: "aggression", label: "Aggression", value: 70 }] },
      { teamId: "g2-esports", dimensions: [{ key: "aggression", label: "Aggression", value: 55 }] },
    ],
    matchDna: { similarityScore: 70, complementaryTraits: [], conflictingTraits: ["aggression"], decisiveTrait: "aggression" },
    keyFactors: [],
    insights: [],
    pipeline: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
    predictionVersion: "test",
  };
}

function baselineProfile() {
  return {
    attackStrength: 60,
    defenseStrength: 55,
    economyEfficiency: 58,
    clutchPerformance: 62,
    consistency: 50,
    recentFormIndex: 65,
    aggression: 70,
    tempo: 60,
    mapControl: 55,
    utilityEfficiency: 58,
    adaptability: 50,
    clutchAbility: 62,
    mapStrength: { ascent: 60, haven: 55 },
  };
}

function installPredictionFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/vct-prediction") {
        return { ok: true, json: async () => baseResult() } as Response;
      }
      if (url === "/api/vct-profile-baseline") {
        return { ok: true, json: async () => ({ teamA: baselineProfile(), teamB: baselineProfile() }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
}

function renderClient(initialUrlState: CanonicalUrlState = EMPTY_CANONICAL_URL_STATE) {
  installPredictionFetchMock();
  render(
    <PredictionStudioClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      maps={maps}
      disclosure="Predictions use simulated team profiles."
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
    });

    expect(screen.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /G2 Esports/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Series Format")).toHaveValue("BO5");
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
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));
    await screen.findByText("Predicted Winner");

    const linkBefore = screen.getByRole("link", { name: /Compare Teams/ }).getAttribute("href");

    // Change the draft's series format after the result already exists.
    fireEvent.change(screen.getByLabelText("Series Format"), { target: { value: "BO5" } });

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
});
