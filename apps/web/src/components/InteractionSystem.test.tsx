/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@repo/ui";
import { RegionCard } from "../features/prediction-studio/RegionCard";
import { TeamCard } from "../features/prediction-studio/TeamCard";
import { VCT_REGIONS, VCT_TEAMS } from "../constants/vct";

afterEach(cleanup);

const region = VCT_REGIONS[0];
const [teamOne, teamTwo] = VCT_TEAMS.filter((team) => team.region === region.id);

describe("Button — TASK-033 unified interaction system", () => {
  it("applies the shared lift, press, and focus-visible treatment", () => {
    render(<Button>Generate Prediction</Button>);
    const button = screen.getByRole("button", { name: "Generate Prediction" });

    expect(button.className).toContain("motion-safe:hover:-translate-y-(--lift-button)");
    expect(button.className).toContain("motion-safe:active:scale-(--scale-press)");
    expect(button.className).toContain("focus-visible:outline-2");
    expect(button.className).toContain("focus-visible:outline-brand-500");
  });

  it("suppresses hover/lift feedback via pointer-events-none when disabled", () => {
    render(<Button disabled>Generate Prediction</Button>);
    const button = screen.getByRole("button", { name: "Generate Prediction" });

    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:pointer-events-none");
    expect(button.className).toContain("disabled:opacity-50");
    expect(button.className).toContain("disabled:translate-y-0");
  });
});

describe("RegionCard / TeamCard — refactored onto shared motion tokens", () => {
  it("RegionCard references the shared lift and logo-scale tokens, not one-off values", () => {
    render(<RegionCard region={region} selected={false} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(region.name) });

    expect(card.className).toContain("--lift-card-selectable");
    expect(card.className).toContain("--scale-press");
    expect(card.className).not.toContain("translate-y-[3px]");
    expect(card.className).not.toContain("scale-[0.97]");
  });

  it("TeamCard's disabled (opposing-side) state carries no hover/lift interaction classes", () => {
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

    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card.className).not.toContain("--lift-card-selectable");
    expect(card.className).not.toContain("--scale-press");
    expect(card.className).toContain("pointer-events-none");
  });

  it("TeamCard's enabled state carries the shared lift/press/logo-scale tokens and toggles aria-pressed", () => {
    const onSelect = vi.fn();
    render(<TeamCard team={teamTwo} side="A" selected={false} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: new RegExp(teamTwo.name) });

    expect(card.className).toContain("--lift-card-selectable");
    expect(card.className).toContain("--scale-press");
    expect(card.querySelector("img")?.className).toContain("--scale-logo-hover");
    expect(card).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps a visible focus-visible outline on both cards for keyboard users", () => {
    render(<RegionCard region={region} selected={false} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: new RegExp(region.name) });
    expect(card.className).toContain("focus-visible:outline-2");
  });
});
