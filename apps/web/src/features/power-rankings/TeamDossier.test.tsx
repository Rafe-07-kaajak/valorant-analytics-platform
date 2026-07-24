// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { maps } from "@repo/prediction-engine";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings, buildRealPowerRankings } from "./rankingModel";
import { TeamDossier } from "./TeamDossier";
import { mockMatchMedia } from "../../test/mockMatchMedia";

afterEach(cleanup);

const entry = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES)[0]!;

describe("TeamDossier", () => {
  it("renders nothing when no team is selected", () => {
    mockMatchMedia(() => false);
    const { container } = render(
      <TeamDossier entry={null} open={false} onOpenChange={vi.fn()} contextLabel="Global #1" maps={maps} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the team's identity, score breakdown, movement badge, and cross-feature links when open", () => {
    mockMatchMedia(() => false);
    render(<TeamDossier entry={entry} open onOpenChange={vi.fn()} contextLabel="Global #1" maps={maps} />);

    expect(screen.getByText(entry.team.name, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Global #1")).toBeInTheDocument();
    expect(screen.getByText("Power Score")).toBeInTheDocument();
    expect(screen.getByText("Baseline")).toBeInTheDocument();

    const predictLink = screen.getByRole("link", { name: `Predict ${entry.team.name}'s next match` });
    expect(predictLink).toHaveAttribute("href", `/prediction-studio?regionA=${entry.team.region}&teamA=${entry.team.id}`);

    const compareLink = screen.getByRole("link", { name: `Compare ${entry.team.name}` });
    expect(compareLink).toHaveAttribute("href", `/team-comparison?regionA=${entry.team.region}&teamA=${entry.team.id}`);

    const mapsLink = screen.getByRole("link", { name: `Explore ${entry.team.name}'s maps` });
    expect(mapsLink).toHaveAttribute("href", `/map-matchup?regionA=${entry.team.region}&teamA=${entry.team.id}`);
  });

  it("shows a confidence badge and honest map-depth aggregate (never a per-map highlight) for a real-data entry", () => {
    mockMatchMedia(() => false);
    const states = new Map([[VCT_TEAMS[0]!.id, { teamId: VCT_TEAMS[0]!.id, seriesCountInWindow: 20, eloRating: 1600, recentFormIndex: 65, mapDepthScore: 55, consistency: 70, opponentAdjusted: 60, competitionTier: 80 }]]);
    const realEntry = buildRealPowerRankings(VCT_TEAMS, states, new Set([VCT_TEAMS[0]!.id]))[0]!;

    render(<TeamDossier entry={realEntry} open onOpenChange={vi.fn()} contextLabel="Global #1" maps={maps} />);

    expect(screen.getByText(/Verified data/)).toBeInTheDocument();
    expect(screen.getByText(/Aggregate map-depth score/)).toBeInTheDocument();
    expect(screen.queryByText("Strongest map")).not.toBeInTheDocument();
  });
});
