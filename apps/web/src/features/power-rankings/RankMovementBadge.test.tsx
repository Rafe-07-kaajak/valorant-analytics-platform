// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RankMovementBadge } from "./RankMovementBadge";

afterEach(cleanup);

describe("RankMovementBadge", () => {
  it("renders the visible 'Baseline' label with an explanatory accessible name", () => {
    render(<RankMovementBadge />);
    const badge = screen.getByText("Baseline");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-label", "Baseline: no prior ranking snapshot exists yet");
  });
});
