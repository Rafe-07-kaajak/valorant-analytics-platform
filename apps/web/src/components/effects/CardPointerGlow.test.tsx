/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegionCard } from "../../features/prediction-studio/RegionCard";
import { TeamCard } from "../../features/prediction-studio/TeamCard";
import { SelectedTeamSummary } from "../../features/prediction-studio/SelectedTeamSummary";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";

afterEach(cleanup);

const region = VCT_REGIONS[0];
const [teamOne, teamTwo] = VCT_TEAMS.filter((team) => team.region === region.id);

describe("TASK-034 card-local pointer glow", () => {
  it("RegionCard carries the pointer-glow class and updates --spotlight-x/y on pointer move", () => {
    render(<RegionCard region={region} selected={false} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(region.name) });

    expect(card.className).toContain("pointer-glow");

    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    fireEvent.pointerMove(card, { pointerType: "mouse", clientX: 30, clientY: 12 });

    expect(card.style.getPropertyValue("--spotlight-x")).toBe("30px");
    expect(card.style.getPropertyValue("--spotlight-y")).toBe("12px");
  });

  it("TeamCard's enabled state carries pointer-glow and a side-appropriate --spotlight-color", () => {
    render(<TeamCard team={teamOne} side="A" selected={false} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(teamOne.name) });

    expect(card.className).toContain("pointer-glow");
    expect(card.style.getPropertyValue("--spotlight-color")).toContain("--team-a");
  });

  it("TeamCard's disabled state never gets the pointer-glow class or a --spotlight-color", () => {
    render(
      <TeamCard
        team={teamOne}
        side="B"
        selected={false}
        disabledReason="Already selected by Team A."
        onSelect={vi.fn()}
      />,
    );
    const card = screen.getByRole("button", { name: new RegExp(teamOne.name) });

    expect(card.className).not.toContain("pointer-glow");
    expect(card.style.getPropertyValue("--spotlight-color")).toBe("");

    // Even if a pointer event somehow reached it, no handler is attached to react.
    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    fireEvent.pointerMove(card, { pointerType: "mouse", clientX: 10, clientY: 10 });
    expect(card.style.getPropertyValue("--spotlight-x")).toBe("");
  });

  it("Team B cards use the coral team-b spotlight color, not team-a", () => {
    render(<TeamCard team={teamTwo} side="B" selected={false} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(teamTwo.name) });

    expect(card.style.getPropertyValue("--spotlight-color")).toContain("--team-b");
    expect(card.style.getPropertyValue("--spotlight-color")).not.toContain("--team-a");
  });

  it("SelectedTeamSummary carries a fainter pointer-glow than an interactive TeamCard", () => {
    render(<SelectedTeamSummary team={teamOne} side="A" />);
    const summary = screen.getByText(teamOne.name).closest(".pointer-glow");

    expect(summary).not.toBeNull();
    expect(summary?.getAttribute("style")).toContain("--spotlight-color");

    render(<TeamCard team={teamTwo} side="A" selected={false} onSelect={vi.fn()} />);
    const teamCard = screen.getByRole("button", { name: new RegExp(teamTwo.name) });

    // Both use color-mix percentages against --team-a — the summary's is the
    // smaller of the two, matching the "static display, weaker than an
    // interactive control" tier in the interaction hierarchy.
    const summaryPercent = Number(/(\d+)%/.exec(summary!.getAttribute("style") ?? "")?.[1]);
    const cardPercent = Number(/(\d+)%/.exec(teamCard.style.getPropertyValue("--spotlight-color"))?.[1]);
    expect(summaryPercent).toBeLessThan(cardPercent);
  });

  it("selected-state styling remains visually stronger than the hover glow (box-shadow ring present)", () => {
    render(<TeamCard team={teamOne} side="A" selected onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(teamOne.name) });

    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card.className).toMatch(/shadow-\[0_0_0_1px_var\(--color-team-a\)/);
  });
});
