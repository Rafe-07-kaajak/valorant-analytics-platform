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

  it("orders cards #1, #2, #3 on mobile via CSS order, while DOM order (and thus the desktop layout and stagger sequence) stays #2, #1, #3", () => {
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

    const rank1Button = screen.getByRole("button", { name: "Reveal Global rank 1 team" });
    const rank2Button = screen.getByRole("button", { name: "Reveal Global rank 2 team" });
    const rank3Button = screen.getByRole("button", { name: "Reveal Global rank 3 team" });

    // DOM order stays #2, #1, #3 (unchanged) — mobile visual order comes
    // entirely from the CSS `order` utility, not from reordering the tree.
    const allButtons = screen.getAllByRole("button", { name: /Reveal Global rank \d team/ });
    expect(allButtons).toEqual([rank2Button, rank1Button, rank3Button]);

    function podiumItem(button: HTMLElement): HTMLElement {
      let node: HTMLElement | null = button;
      while (node) {
        if (node.className.split(/\s+/).some((token) => /^order-[123]$/.test(token))) return node;
        node = node.parentElement;
      }
      throw new Error("Expected an ancestor with an 'order-1' | 'order-2' | 'order-3' class.");
    }

    expect(podiumItem(rank1Button).className).toContain("order-1 sm:order-none");
    expect(podiumItem(rank2Button).className).toContain("order-2 sm:order-none");
    expect(podiumItem(rank3Button).className).toContain("order-3 sm:order-none");
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
