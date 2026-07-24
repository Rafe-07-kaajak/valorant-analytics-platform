// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings } from "./rankingModel";
import { GlobalRankingView } from "./GlobalRankingView";
import { mockMatchMedia } from "../../test/mockMatchMedia";

afterEach(cleanup);

const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);

describe("GlobalRankingView", () => {
  it("renders a 3-card sealed podium plus a 29-row visible board", () => {
    mockMatchMedia(() => false);
    render(<GlobalRankingView entries={entries} revealedTeamIds={new Set()} onReveal={vi.fn()} onOpenDossier={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Reveal Global rank 1 team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 2 team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 3 team" })).toBeInTheDocument();

    expect(screen.getByRole("list", { name: "Global power ranking, rank 4 and below" })).toBeInTheDocument();
  });

  it("shows exactly 29 board rows (ranks 4 through 32)", () => {
    mockMatchMedia(() => false);
    const { container } = render(
      <GlobalRankingView entries={entries} revealedTeamIds={new Set()} onReveal={vi.fn()} onOpenDossier={vi.fn()} />,
    );
    const list = screen.getByRole("list", { name: "Global power ranking, rank 4 and below" });
    expect(container.querySelectorAll("[role=listitem]").length).toBe(29);
    expect(list).toBeInTheDocument();
  });
});
