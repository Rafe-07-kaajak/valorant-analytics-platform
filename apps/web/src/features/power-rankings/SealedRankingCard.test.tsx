// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VCT_TEAMS } from "../../constants/vct";
import { buildPowerRankings } from "./rankingModel";
import { SealedRankingCard } from "./SealedRankingCard";
import { mockMatchMedia } from "../../test/mockMatchMedia";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";

afterEach(cleanup);

const entry = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES)[0]!;

describe("SealedRankingCard", () => {
  it("shows only the sealed affordance and a descriptive reveal button before reveal", () => {
    mockMatchMedia(() => false);
    render(
      <SealedRankingCard
        entry={entry}
        primaryRank={1}
        scopeLabel="Global"
        revealed={false}
        onReveal={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    const revealButton = screen.getByRole("button", { name: "Reveal Global rank 1 team" });
    expect(revealButton).toBeInTheDocument();
    expect(revealButton).toHaveTextContent("#1");
    expect(revealButton).not.toHaveTextContent(entry.team.name);
  });

  it("calls onReveal when the sealed card is activated", () => {
    mockMatchMedia(() => false);
    const onReveal = vi.fn();
    render(
      <SealedRankingCard
        entry={entry}
        primaryRank={1}
        scopeLabel="Global"
        revealed={false}
        onReveal={onReveal}
        onOpenDossier={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal Global rank 1 team" }));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("shows team identity, power score, and the Baseline movement badge once revealed", () => {
    mockMatchMedia(() => false);
    render(
      <SealedRankingCard
        entry={entry}
        primaryRank={1}
        scopeLabel="Global"
        revealed
        onReveal={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    expect(screen.getByText(entry.team.name, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Baseline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View full dossier" })).toBeInTheDocument();
  });

  it("calls onOpenDossier from the revealed card's dossier button", () => {
    mockMatchMedia(() => false);
    const onOpenDossier = vi.fn();
    render(
      <SealedRankingCard
        entry={entry}
        primaryRank={1}
        scopeLabel="Global"
        revealed
        onReveal={vi.fn()}
        onOpenDossier={onOpenDossier}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View full dossier" }));
    expect(onOpenDossier).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion, still renders full revealed content with no dependency on the flip animation", () => {
    mockMatchMedia((query) => query === "(prefers-reduced-motion: reduce)");
    render(
      <SealedRankingCard
        entry={entry}
        primaryRank={1}
        scopeLabel="Global"
        revealed
        onReveal={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    expect(screen.getByText(entry.team.name, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View full dossier" })).toBeInTheDocument();
  });
});
