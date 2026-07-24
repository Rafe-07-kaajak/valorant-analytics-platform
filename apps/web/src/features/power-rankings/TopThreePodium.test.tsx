// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings } from "./rankingModel";
import { TopThreePodium } from "./TopThreePodium";
import { mockMatchMedia } from "../../test/mockMatchMedia";

afterEach(cleanup);

const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
const top3 = entries.slice(0, 3);

describe("TopThreePodium", () => {
  it("renders one sealed reveal button per top-3 team, using global rank in Global mode", () => {
    mockMatchMedia(() => false);
    render(
      <TopThreePodium
        entries={top3}
        scopeLabel="Global"
        useRegionalRank={false}
        revealedTeamIds={new Set()}
        onReveal={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reveal Global rank 1 team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 2 team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 3 team" })).toBeInTheDocument();
  });

  it("calls onReveal with the specific team id that was activated", () => {
    mockMatchMedia(() => false);
    const onReveal = vi.fn();
    render(
      <TopThreePodium
        entries={top3}
        scopeLabel="Global"
        useRegionalRank={false}
        revealedTeamIds={new Set()}
        onReveal={onReveal}
        onOpenDossier={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal Global rank 1 team" }));
    expect(onReveal).toHaveBeenCalledWith(top3[0]!.team.id);
  });

  it("only shows already-revealed teams as revealed, others stay sealed", () => {
    mockMatchMedia(() => false);
    render(
      <TopThreePodium
        entries={top3}
        scopeLabel="Global"
        useRegionalRank={false}
        revealedTeamIds={new Set([top3[0]!.team.id])}
        onReveal={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    expect(screen.getByText(top3[0]!.team.name, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 2 team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 3 team" })).toBeInTheDocument();
  });
});
