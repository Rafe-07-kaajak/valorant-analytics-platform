/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PredictionResult, Team } from "@repo/shared";
import { InteractivePredictionBreakdown } from "./InteractivePredictionBreakdown";
import { useBreakdownState } from "./useBreakdownState";

afterEach(cleanup);

const teamA: Team = { id: "paper-rex", name: "Paper Rex", region: "Pacific", logoUrl: "/prx.png" };
const teamB: Team = { id: "g2-esports", name: "G2 Esports", region: "Americas", logoUrl: "/g2.png" };

function baseResult(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return {
    predictionId: "p1",
    requestId: "r1",
    scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent"] },
    outcomes: [
      { teamId: "paper-rex", winProbability: 0.62 },
      { teamId: "g2-esports", winProbability: 0.38 },
    ],
    predictedWinnerId: "paper-rex",
    confidence: 70,
    trustScore: 80,
    explanation:
      "Paper Rex is favored primarily due to a aggression advantage over G2 Esports. Aggression shows the widest gap between these two teams and carries the most weight in this prediction.",
    teamDna: [
      {
        teamId: "paper-rex",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 80 },
          { key: "tempo", label: "Tempo", value: 60 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 60 },
          { key: "adaptability", label: "Adaptability", value: 60 },
          { key: "clutchAbility", label: "Clutch Ability", value: 60 },
        ],
      },
      {
        teamId: "g2-esports",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 55 },
          { key: "tempo", label: "Tempo", value: 60 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 60 },
          { key: "adaptability", label: "Adaptability", value: 60 },
          { key: "clutchAbility", label: "Clutch Ability", value: 60 },
        ],
      },
    ],
    matchDna: {
      similarityScore: 70,
      complementaryTraits: [],
      conflictingTraits: ["aggression"],
      decisiveTrait: "aggression",
    },
    keyFactors: [
      {
        id: "aggression",
        label: "Aggression",
        impact: "positive",
        magnitude: 25,
        description: "Paper Rex leads in aggression (80 vs 55 for G2 Esports).",
      },
    ],
    insights: [],
    pipeline: [
      { id: "validation", label: "Validation", description: "Validates the scenario input.", durationMs: 2 },
      { id: "team-dna", label: "Team DNA", description: "Resolves each team's DNA profile.", durationMs: 5 },
    ],
    warnings: [],
    generatedAt: new Date().toISOString(),
    predictionVersion: "test",
    ...overrides,
  };
}

function Harness({ result }: { result: PredictionResult }) {
  const breakdown = useBreakdownState();
  return <InteractivePredictionBreakdown result={result} teamA={teamA} teamB={teamB} breakdown={breakdown} />;
}

describe("InteractivePredictionBreakdown", () => {
  it("renders the section heading and all four tabs", () => {
    render(<Harness result={baseResult()} />);
    expect(screen.getByRole("heading", { name: "Interactive Prediction Breakdown" })).toBeInTheDocument();
    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Contributions", "Match DNA", "Key Factors", "Pipeline"]);
  });

  it("shows the Contributions tab by default with a keyboard-reachable, non-color-only row", () => {
    render(<Harness result={baseResult()} />);
    const row = screen.getByRole("button", { name: /Aggression: favors Paper Rex/ });
    expect(row).toBeInTheDocument();
  });

  it("selecting a contribution row persists as active after switching to the Match DNA tab", () => {
    render(<Harness result={baseResult()} />);
    fireEvent.click(screen.getByRole("button", { name: /Aggression: favors Paper Rex/ }));

    fireEvent.focus(screen.getByRole("tab", { name: "Match DNA" }));
    const dnaRow = screen.getByRole("button", { name: /Aggression: Paper Rex leads/ });
    expect(dnaRow).toHaveAttribute("aria-current", "true");
  });

  it("selecting a key factor cross-highlights the same dimension's Contributions row", () => {
    render(<Harness result={baseResult()} />);
    fireEvent.focus(screen.getByRole("tab", { name: "Key Factors" }));
    fireEvent.click(screen.getByRole("button", { name: /Aggression: Paper Rex leads/ }));

    fireEvent.focus(screen.getByRole("tab", { name: "Contributions" }));
    expect(screen.getByRole("button", { name: /Aggression: favors Paper Rex/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("activates a row via keyboard (Enter) without a pointer", () => {
    render(<Harness result={baseResult()} />);
    const row = screen.getByRole("button", { name: /Aggression: favors Paper Rex/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(row).toHaveAttribute("aria-current", "true");
  });

  it("Escape clears the active selection", () => {
    render(<Harness result={baseResult()} />);
    const row = screen.getByRole("button", { name: /Aggression: favors Paper Rex/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(row, { key: "Escape" });
    expect(row).toHaveAttribute("aria-current", "false");
  });

  it("renders the Pipeline tab's stages in their original order", () => {
    render(<Harness result={baseResult()} />);
    fireEvent.focus(screen.getByRole("tab", { name: "Pipeline" }));
    const list = screen.getByRole("list", { name: "Prediction pipeline stages, in order" });
    const items = within(list).getAllByRole("button");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("1. Validation"),
      expect.stringContaining("2. Team DNA"),
    ]);
  });

  it("renders nothing when there are no key factors, DNA rows, or pipeline stages", () => {
    const { container } = render(
      <Harness
        result={baseResult({
          keyFactors: [],
          pipeline: [],
          teamDna: [
            { teamId: "paper-rex", dimensions: [] },
            { teamId: "g2-esports", dimensions: [] },
          ],
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
