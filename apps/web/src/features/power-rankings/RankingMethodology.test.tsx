// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RankingMethodology } from "./RankingMethodology";

afterEach(cleanup);

describe("RankingMethodology", () => {
  it("renders the disclosure text and the weighting explanation", () => {
    render(<RankingMethodology disclosure="These rankings use simulated team profiles." />);
    expect(screen.getByText("These rankings use simulated team profiles.")).toBeInTheDocument();
    expect(screen.getByText(/overall rating \(35%\)/)).toBeInTheDocument();
    expect(screen.getByText(/not an official VCT ranking/)).toBeInTheDocument();
  });
});
