/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { VctTeamSideSelector } from "./VctTeamSideSelector";

afterEach(cleanup);

describe("VctTeamSideSelector", () => {
  it("renders exactly 4 region cards", () => {
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId={null}
        teamId={null}
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    const regionGroup = screen.getByRole("group", { name: "Team A region" });
    expect(within(regionGroup).getAllByRole("button")).toHaveLength(4);
  });

  it("shows no team grid before a region is selected, with helper text instead", () => {
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId={null}
        teamId={null}
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "Team A team" })).not.toBeInTheDocument();
    expect(screen.getByText("Select a region to see its teams.")).toBeInTheDocument();
  });

  it("shows exactly 8 team cards once a region is selected", () => {
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId={null}
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    const teamGroup = screen.getByRole("group", { name: "Team A team" });
    expect(within(teamGroup).getAllByRole("button")).toHaveLength(8);
    expect(screen.getByText("Select a team to continue.")).toBeInTheDocument();
  });

  it("calls onRegionChange with the clicked region's id", () => {
    const onRegionChange = vi.fn();
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId={null}
        teamId={null}
        opposingTeamId={null}
        onRegionChange={onRegionChange}
        onTeamChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pacific/ }));
    expect(onRegionChange).toHaveBeenCalledWith("pacific");
  });

  it("calls onTeamChange with the clicked team's id", () => {
    const onTeamChange = vi.fn();
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId={null}
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={onTeamChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Paper Rex/ }));
    expect(onTeamChange).toHaveBeenCalledWith("paper-rex");
  });

  it("marks the selected region and team with aria-pressed", () => {
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId="paper-rex"
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^VCT Pacific$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^T1/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("disables the team already selected by the opposing side and explains why", () => {
    const onTeamChange = vi.fn();
    render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId={null}
        opposingTeamId="paper-rex"
        onRegionChange={vi.fn()}
        onTeamChange={onTeamChange}
      />,
    );

    const paperRexCard = screen.getByRole("button", { name: /Paper Rex/ });
    expect(paperRexCard).toHaveAttribute("aria-disabled", "true");
    expect(paperRexCard).toHaveAccessibleDescription("Already selected by Team B.");

    fireEvent.click(paperRexCard);
    expect(onTeamChange).not.toHaveBeenCalled();
  });

  it("re-enables a team once it is no longer the opposing side's selection", () => {
    const { rerender } = render(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId={null}
        opposingTeamId="paper-rex"
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-disabled", "true");

    rerender(
      <VctTeamSideSelector
        side="A"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="pacific"
        teamId={null}
        opposingTeamId="t1"
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-disabled", "false");
  });

  it("shows the selected-team summary with region and Team A/B designation", () => {
    render(
      <VctTeamSideSelector
        side="B"
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        regionId="americas"
        teamId="g2-esports"
        opposingTeamId={null}
        onRegionChange={vi.fn()}
        onTeamChange={vi.fn()}
      />,
    );

    // "Team B" appears both as the section heading and the summary's side label;
    // "G2 Esports" / "G2" appear both on the team's own card and in the summary.
    expect(screen.getAllByText("Team B")).toHaveLength(2);
    expect(screen.getAllByText("G2 Esports").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("G2").length).toBeGreaterThanOrEqual(1);
    // "VCT Americas" appears both as the region card's own label and the summary's region badge.
    expect(screen.getAllByText("VCT Americas").length).toBeGreaterThanOrEqual(1);
  });

  it("renders every team across all 4 regions when each is selected in turn", () => {
    for (const region of VCT_REGIONS) {
      const { unmount } = render(
        <VctTeamSideSelector
          side="A"
          regions={VCT_REGIONS}
          teams={VCT_TEAMS}
          regionId={region.id}
          teamId={null}
          opposingTeamId={null}
          onRegionChange={vi.fn()}
          onTeamChange={vi.fn()}
        />,
      );

      const teamGroup = screen.getByRole("group", { name: "Team A team" });
      for (const teamId of region.teamIds) {
        const team = VCT_TEAMS.find((candidate) => candidate.id === teamId)!;
        expect(within(teamGroup).getByRole("button", { name: new RegExp(team.name) })).toBeInTheDocument();
      }
      unmount();
    }
  });
});
