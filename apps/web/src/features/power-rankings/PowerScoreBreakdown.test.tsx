// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { computeMapDepthScore, computeRealPopulationPriors, computeRealPowerScore } from "./rankingModel";
import { PowerScoreBreakdown } from "./PowerScoreBreakdown";

afterEach(cleanup);

describe("PowerScoreBreakdown", () => {
  it("renders the total power score and all five weighted meters for the synthetic path", () => {
    const profile = VCT_TEAM_PROFILES[0]!;
    const mapDepthScore = computeMapDepthScore(profile);
    render(<PowerScoreBreakdown profile={profile} mapDepthScore={mapDepthScore} powerScore={72.5} />);

    expect(screen.getByText("Power Score")).toBeInTheDocument();
    expect(screen.getByText("72.50")).toBeInTheDocument();
    expect(screen.getByText(/Overall rating/)).toBeInTheDocument();
    expect(screen.getByText(/Recent form \(modeled/)).toBeInTheDocument();
    expect(screen.getByText(/Map depth/)).toBeInTheDocument();
    expect(screen.getByText(/Consistency/)).toBeInTheDocument();
    expect(screen.getByText(/Clutch performance/)).toBeInTheDocument();
  });

  it("renders the real-data breakdown (with an uncertainty penalty row, never a fabricated clutch meter) for the real-data path", () => {
    const state = { teamId: "team-a", seriesCountInWindow: 20, eloRating: 1600, recentFormIndex: 65, mapDepthScore: 55, consistency: 70, opponentAdjusted: 60, competitionTier: 80 };
    const priors = computeRealPopulationPriors([state]);
    const explainability = computeRealPowerScore(state, priors);

    render(<PowerScoreBreakdown explainability={explainability} mapDepthScore={state.mapDepthScore} powerScore={explainability.finalScore} />);

    expect(screen.getByText("Power Score")).toBeInTheDocument();
    expect(screen.getByText(/Baseline rating \(Elo/)).toBeInTheDocument();
    expect(screen.getByText(/Opponent-adjusted strength/)).toBeInTheDocument();
    expect(screen.getByText(/Competition tier/)).toBeInTheDocument();
    expect(screen.getByText("Uncertainty penalty (low sample size)")).toBeInTheDocument();
    expect(screen.queryByText(/Clutch performance/)).not.toBeInTheDocument();
  });
});
