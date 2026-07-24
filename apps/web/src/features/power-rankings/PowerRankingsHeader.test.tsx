// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PowerRankingsHeader } from "./PowerRankingsHeader";

afterEach(cleanup);

describe("PowerRankingsHeader", () => {
  it("renders the literal 'Power Rankings' page title", () => {
    render(<PowerRankingsHeader />);
    expect(screen.getByRole("heading", { level: 1, name: "Power Rankings" })).toBeInTheDocument();
  });
});
