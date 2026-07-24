// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TeamLogo } from "./TeamLogo";

afterEach(cleanup);

const team = { name: "Paper Rex", shortName: "PRX", logoPath: "/assets/vct/teams/pacific/paper-rex.png" };

// The crest image is decorative (alt=""; the real accessible name comes from
// a sibling sr-only span), so it's queried directly rather than via role="img".
describe("TeamLogo", () => {
  it("renders the crest image and the accessible team name", () => {
    const { container } = render(<TeamLogo team={team} />);
    expect(container.querySelector("img")).toHaveAttribute("src", team.logoPath);
    expect(screen.getByText(team.name)).toBeInTheDocument();
  });

  it("falls back to the short-name badge when the image fails to load, keeping the accessible name", () => {
    const { container } = render(<TeamLogo team={team} />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText(team.shortName)).toBeInTheDocument();
    expect(screen.getByText(team.name)).toBeInTheDocument();
  });
});
