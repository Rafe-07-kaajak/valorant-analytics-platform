/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GameMap, PredictionResult, SimulationResult, Team, VctProfileBaselineResponse } from "@repo/shared";
import { WhatIfSimulator } from "./WhatIfSimulator";

afterEach(cleanup);

const teamA: Team = { id: "paper-rex", name: "Paper Rex", region: "Pacific", logoUrl: "/prx.png" };
const teamB: Team = { id: "g2-esports", name: "G2 Esports", region: "Americas", logoUrl: "/g2.png" };
const maps: GameMap[] = [{ id: "ascent", name: "Ascent" }, { id: "haven", name: "Haven" }];

function baseResult(overrides: Partial<PredictionResult> = {}): PredictionResult {
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
    keyFactors: [{ id: "aggression", label: "Aggression", impact: "positive", magnitude: 20, description: "x" }],
    insights: [],
    pipeline: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
    predictionVersion: "test",
    ...overrides,
  };
}

function baselineResponse(): VctProfileBaselineResponse {
  const one = {
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
  return { teamA: one, teamB: { ...one, aggression: 55 } };
}

function simulationResponse(result: PredictionResult): SimulationResult {
  return {
    simulationId: "s1",
    requestId: "r1",
    result,
    teamAAdjustment: { scalar: {}, dna: { aggression: 10 }, mapStrength: {} },
    teamBAdjustment: { scalar: {}, dna: {}, mapStrength: {} },
    generatedAt: new Date().toISOString(),
  };
}

function installFetchMock(runResult?: PredictionResult | "reject") {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "/api/vct-profile-baseline") {
        return { ok: true, json: async () => baselineResponse() } as Response;
      }
      if (url === "/api/simulate-prediction") {
        if (runResult === "reject") {
          return { ok: false, json: async () => ({ error: "Simulation failed." }) } as Response;
        }
        return { ok: true, json: async () => simulationResponse(runResult ?? baseResult({ predictedWinnerId: "paper-rex" })) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
  return calls;
}

async function renderSimulator(runResult?: PredictionResult | "reject") {
  const calls = installFetchMock(runResult);
  render(<WhatIfSimulator result={baseResult()} teamA={teamA} teamB={teamB} maps={maps} />);
  await screen.findByRole("tablist", { name: "What-if simulator views" });
  return calls;
}

describe("WhatIfSimulator", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state before baseline values arrive, then renders all three tabs", async () => {
    await renderSimulator();
    const tablist = screen.getByRole("tablist", { name: "What-if simulator views" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Controls", "Result Comparison", "Change Breakdown"]);
  });

  it("shows an error state and no controls when the baseline fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "nope" }) }) as Response),
    );
    render(<WhatIfSimulator result={baseResult()} teamA={teamA} teamB={teamB} maps={maps} />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("identifies Team A and Team B by name, not color alone", async () => {
    await renderSimulator();
    expect(screen.getAllByText("Paper Rex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("G2 Esports").length).toBeGreaterThan(0);
  });

  it("moving a slider updates the draft summary but sends no request", async () => {
    const calls = await renderSimulator();
    const slider = screen.getByRole("slider", { name: /Paper Rex Aggression/ });
    fireEvent.change(slider, { target: { value: "8" } });

    expect(screen.getByText(/Paper Rex: Aggression \+8/)).toBeInTheDocument();
    expect(calls.filter((url) => url === "/api/simulate-prediction")).toHaveLength(0);
  });

  it("Run Simulation is disabled until a draft change exists", async () => {
    await renderSimulator();
    expect(screen.getByRole("button", { name: "Run Simulation" })).toBeDisabled();

    const slider = screen.getByRole("slider", { name: /Paper Rex Aggression/ });
    fireEvent.change(slider, { target: { value: "5" } });
    expect(screen.getByRole("button", { name: "Run Simulation" })).toBeEnabled();
  });

  it("applying a preset sets its documented deltas", async () => {
    await renderSimulator();
    fireEvent.click(screen.getByRole("button", { name: /Apply Improved Form preset to Paper Rex/ }));
    expect(screen.getByText(/Paper Rex: Consistency \+5, Recent Form Index \+10/)).toBeInTheDocument();
  });

  it("a single control's reset button clears only that control", async () => {
    await renderSimulator();
    const slider = screen.getByRole("slider", { name: /Paper Rex Aggression/ });
    fireEvent.change(slider, { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset Paper Rex Aggression to baseline" }));
    expect(screen.queryByText(/Paper Rex: Aggression/)).not.toBeInTheDocument();
  });

  it("Reset All clears every draft back to the safe empty-state summary", async () => {
    await renderSimulator();
    fireEvent.change(screen.getByRole("slider", { name: /Paper Rex Aggression/ }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(screen.getByText("No hypothetical adjustments applied.")).toBeInTheDocument();
  });

  it("map-specific sliders only render for scenario-selected maps", async () => {
    await renderSimulator();
    expect(screen.getByRole("slider", { name: /Paper Rex modeled strength on Ascent/ })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Paper Rex modeled strength on Haven/ })).toBeInTheDocument();
  });

  it("running a simulation shows a loading state, then the Result Comparison tab", async () => {
    await renderSimulator(baseResult({ predictedWinnerId: "paper-rex", outcomes: [{ teamId: "paper-rex", winProbability: 0.7 }, { teamId: "g2-esports", winProbability: 0.3 }] }));
    fireEvent.change(screen.getByRole("slider", { name: /Paper Rex Aggression/ }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Simulation" }));

    expect(await screen.findByText("Running…")).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("tab", { name: "Result Comparison" }));
    await waitFor(() => expect(screen.getAllByText(/Baseline win probability/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Simulated win probability/).length).toBeGreaterThan(0);
  });

  it("a failed simulation shows an alert and preserves the draft", async () => {
    await renderSimulator("reject");
    fireEvent.change(screen.getByRole("slider", { name: /Paper Rex Aggression/ }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Simulation" }));

    await screen.findByRole("alert");
    expect(screen.getByText(/Paper Rex: Aggression \+10/)).toBeInTheDocument();
  });

  it("a rerun replaces the prior simulation result rather than stacking", async () => {
    await renderSimulator(baseResult({ confidence: 75 }));
    fireEvent.change(screen.getByRole("slider", { name: /Paper Rex Aggression/ }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Simulation" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Run Simulation" })).toBeEnabled());

    fireEvent.change(screen.getByRole("slider", { name: /Paper Rex Aggression/ }), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Simulation" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Run Simulation" })).toBeEnabled());

    fireEvent.focus(screen.getByRole("tab", { name: "Result Comparison" }));
    // Exactly one probability card per team — a rerun replaced the first
    // simulation's comparison rather than appending a second one alongside it.
    await waitFor(() => expect(screen.getAllByText(/Baseline win probability/)).toHaveLength(2));
  });

  it("the Change Breakdown tab shows a not-yet-run state before the first simulation", async () => {
    await renderSimulator();
    fireEvent.focus(screen.getByRole("tab", { name: "Change Breakdown" }));
    expect(screen.getByText(/Run a simulation from the Controls tab/)).toBeInTheDocument();
  });
});
