// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DataConfidenceBadge } from "./DataConfidenceBadge";

afterEach(cleanup);

describe("DataConfidenceBadge", () => {
  it("shows the verified label with a match count", () => {
    render(<DataConfidenceBadge confidence="verified" seriesCountInWindow={24} />);
    expect(screen.getByText("Verified data · 24 matches")).toBeInTheDocument();
  });

  it("singularizes the match count when it's exactly one", () => {
    render(<DataConfidenceBadge confidence="provisional" seriesCountInWindow={1} />);
    expect(screen.getByText("Provisional data · 1 match")).toBeInTheDocument();
  });

  it("shows the unrated label with no match count, even if one is passed", () => {
    render(<DataConfidenceBadge confidence="unrated" seriesCountInWindow={0} />);
    expect(screen.getByText("Unrated (no match data)")).toBeInTheDocument();
  });

  it("shows the plain label when seriesCountInWindow is omitted", () => {
    render(<DataConfidenceBadge confidence="verified" />);
    expect(screen.getByText("Verified data")).toBeInTheDocument();
  });
});
