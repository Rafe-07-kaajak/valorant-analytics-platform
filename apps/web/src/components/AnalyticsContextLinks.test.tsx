/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnalyticsContextLinks } from "./AnalyticsContextLinks";
import { EMPTY_CANONICAL_URL_STATE, type CanonicalUrlState } from "../lib/urlState";

vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

afterEach(cleanup);

const BOTH_TEAMS: CanonicalUrlState = {
  regionA: "pacific",
  teamA: "paper-rex",
  regionB: "americas",
  teamB: "g2-esports",
  maps: ["ascent", "haven"],
  format: "BO3",
};

describe("AnalyticsContextLinks", () => {
  it("renders nothing until both teams are selected", () => {
    const { container } = render(<AnalyticsContextLinks currentFeature="prediction-studio" state={EMPTY_CANONICAL_URL_STATE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing with only one team selected", () => {
    const { container } = render(
      <AnalyticsContextLinks currentFeature="prediction-studio" state={{ ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never links to the current feature", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    expect(screen.queryByRole("link", { name: /Prediction Studio/ })).not.toBeInTheDocument();
  });

  it("shows Prediction Studio's two destination links with correct labels", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    expect(screen.getByRole("link", { name: /Compare Teams/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Maps/ })).toBeInTheDocument();
  });

  it("shows Team Comparison Lab's two destination links with correct labels", () => {
    render(<AnalyticsContextLinks currentFeature="team-comparison" state={BOTH_TEAMS} />);
    expect(screen.getByRole("link", { name: /Open in Prediction Studio/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Map Matchup/ })).toBeInTheDocument();
  });

  it("shows Map Matchup Explorer's two destination links with correct labels", () => {
    render(<AnalyticsContextLinks currentFeature="map-matchup" state={BOTH_TEAMS} />);
    expect(screen.getByRole("link", { name: /Open in Prediction Studio/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare Teams/ })).toBeInTheDocument();
  });

  it("generates hrefs that preserve team context", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    const link = screen.getByRole("link", { name: /Compare Teams/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("teamA=paper-rex"));
    expect(link).toHaveAttribute("href", expect.stringContaining("teamB=g2-esports"));
  });

  it("uses a normal anchor element so it supports opening in a new tab", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    const link = screen.getByRole("link", { name: /Compare Teams/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href");
  });

  it("gives every link an accessible name describing both destination and context", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    const link = screen.getByRole("link", { name: /Compare Teams/ });
    expect(link).toHaveAccessibleName(expect.stringMatching(/Paper Rex/));
    expect(link).toHaveAccessibleName(expect.stringMatching(/G2 Esports/));
  });

  it("renders the Copy Link action by default", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} />);
    expect(screen.getByRole("button", { name: "Copy Link" })).toBeInTheDocument();
  });

  it("omits the Copy Link action when showCopyLink is false", () => {
    render(<AnalyticsContextLinks currentFeature="prediction-studio" state={BOTH_TEAMS} showCopyLink={false} />);
    expect(screen.queryByRole("button", { name: "Copy Link" })).not.toBeInTheDocument();
  });
});
