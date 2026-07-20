/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardSpotlight } from "./CardSpotlight";

afterEach(cleanup);

describe("CardSpotlight — TASK-051 consolidation of TASK-034's card-local pointer glow", () => {
  it("carries the pointer-glow class and updates --spotlight-x/y on pointer move", () => {
    render(<CardSpotlight>Content</CardSpotlight>);
    const card = screen.getByText("Content");

    expect(card.className).toContain("pointer-glow");

    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    fireEvent.pointerMove(card, { pointerType: "mouse", clientX: 24, clientY: 8 });

    expect(card.style.getPropertyValue("--spotlight-x")).toBe("24px");
    expect(card.style.getPropertyValue("--spotlight-y")).toBe("8px");
  });

  it("applies a caller-provided --spotlight-color override", () => {
    render(<CardSpotlight spotlightColor="var(--team-a)">Team A</CardSpotlight>);
    const card = screen.getByText("Team A");
    expect(card.style.getPropertyValue("--spotlight-color")).toBe("var(--team-a)");
  });

  it("has no --spotlight-color when none is provided", () => {
    render(<CardSpotlight>Default</CardSpotlight>);
    const card = screen.getByText("Default");
    expect(card.style.getPropertyValue("--spotlight-color")).toBe("");
  });

  it("ignores touch pointer events, matching the underlying usePointerGlow behavior", () => {
    render(<CardSpotlight>Touch</CardSpotlight>);
    const card = screen.getByText("Touch");

    fireEvent.pointerEnter(card, { pointerType: "touch" });
    fireEvent.pointerMove(card, { pointerType: "touch", clientX: 5, clientY: 5 });

    expect(card.style.getPropertyValue("--spotlight-x")).toBe("");
  });

  it("merges a caller className alongside pointer-glow", () => {
    render(<CardSpotlight className="rounded-lg border">Merged</CardSpotlight>);
    const card = screen.getByText("Merged");
    expect(card.className).toContain("pointer-glow");
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
  });
});
