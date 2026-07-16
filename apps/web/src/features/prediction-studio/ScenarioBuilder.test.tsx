/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { maps } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { ScenarioBuilder } from "./ScenarioBuilder";

afterEach(cleanup);

const DISCLOSURE_TEXT = "Predictions use simulated team profiles for demonstration purposes.";

function renderBuilder(onSubmit = vi.fn()) {
  render(
    <ScenarioBuilder
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      maps={maps}
      disclosure={DISCLOSURE_TEXT}
      isSubmitting={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

function selectTeam(side: "A" | "B", regionName: string, teamName: string) {
  const regionGroup = screen.getByRole("group", { name: `Team ${side} region` });
  fireEvent.click(within(regionGroup).getByRole("button", { name: new RegExp(regionName) }));

  const teamGroup = screen.getByRole("group", { name: `Team ${side} team` });
  fireEvent.click(within(teamGroup).getByRole("button", { name: new RegExp(teamName) }));
}

describe("ScenarioBuilder", () => {
  it("shows the disclosure text near the controls", () => {
    renderBuilder();
    expect(screen.getByText(new RegExp(DISCLOSURE_TEXT))).toBeInTheDocument();
  });

  it("keeps Team A and Team B region state independent", () => {
    renderBuilder();

    const regionAGroup = screen.getByRole("group", { name: "Team A region" });
    fireEvent.click(within(regionAGroup).getByRole("button", { name: /Pacific/ }));

    const regionBGroup = screen.getByRole("group", { name: "Team B region" });
    fireEvent.click(within(regionBGroup).getByRole("button", { name: /EMEA/ }));

    expect(within(regionAGroup).getByRole("button", { name: /^VCT Pacific$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(regionBGroup).getByRole("button", { name: /^VCT EMEA$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Team A's own region group must not have picked up Team B's EMEA selection.
    expect(within(regionAGroup).getByRole("button", { name: /^VCT EMEA$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("resets only that side's team when its region changes", () => {
    renderBuilder();
    selectTeam("A", "Pacific", "Paper Rex");
    selectTeam("B", "Americas", "G2 Esports");

    // Change Team A's region to EMEA — Team A's team must reset, Team B must be untouched.
    const regionAGroup = screen.getByRole("group", { name: "Team A region" });
    fireEvent.click(within(regionAGroup).getByRole("button", { name: /EMEA/ }));

    expect(screen.queryByRole("button", { name: /Paper Rex/, pressed: true })).not.toBeInTheDocument();
    const teamBGroup = screen.getByRole("group", { name: "Team B team" });
    expect(within(teamBGroup).getByRole("button", { name: /G2 Esports/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("prevents the same team from being selected on both sides", () => {
    renderBuilder();
    selectTeam("A", "Pacific", "Paper Rex");

    const regionBGroup = screen.getByRole("group", { name: "Team B region" });
    fireEvent.click(within(regionBGroup).getByRole("button", { name: /Pacific/ }));
    const teamBGroup = screen.getByRole("group", { name: "Team B team" });
    const paperRexOnSideB = within(teamBGroup).getByRole("button", { name: /Paper Rex/ });

    expect(paperRexOnSideB).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(paperRexOnSideB);
    expect(paperRexOnSideB).toHaveAttribute("aria-pressed", "false");
  });

  it("re-enables a team on the other side once it is deselected there", () => {
    renderBuilder();
    selectTeam("A", "Pacific", "Paper Rex");

    const regionBGroup = screen.getByRole("group", { name: "Team B region" });
    fireEvent.click(within(regionBGroup).getByRole("button", { name: /Pacific/ }));
    const teamBGroup = screen.getByRole("group", { name: "Team B team" });
    expect(within(teamBGroup).getByRole("button", { name: /Paper Rex/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // Team A moves to a different team — Paper Rex should now be selectable on side B.
    const teamAGroup = screen.getByRole("group", { name: "Team A team" });
    fireEvent.click(within(teamAGroup).getByRole("button", { name: /T1/ }));

    expect(within(teamBGroup).getByRole("button", { name: /Paper Rex/ })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("keeps the submit button disabled until both teams and a map are selected", () => {
    renderBuilder();
    const submit = screen.getByRole("button", { name: "Generate Prediction" });
    expect(submit).toBeDisabled();

    selectTeam("A", "Pacific", "Paper Rex");
    expect(submit).toBeDisabled();

    selectTeam("B", "Americas", "G2 Esports");
    expect(submit).toBeDisabled(); // no map yet

    fireEvent.click(screen.getByRole("button", { name: "Ascent" }));
    expect(submit).toBeEnabled();
  });

  it("submits the scenario with the selected VctTeamIds", () => {
    const onSubmit = renderBuilder();
    selectTeam("A", "Pacific", "Paper Rex");
    selectTeam("B", "Americas", "G2 Esports");
    fireEvent.click(screen.getByRole("button", { name: "Ascent" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate Prediction" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ teamAId: "paper-rex", teamBId: "g2-esports", mapIds: ["ascent"] }),
    );
  });

  it("lets every team in every region be selected on Team A's side", () => {
    renderBuilder();
    const regionAGroup = screen.getByRole("group", { name: "Team A region" });

    for (const region of VCT_REGIONS) {
      fireEvent.click(within(regionAGroup).getByRole("button", { name: new RegExp(region.name.replace("VCT ", "")) }));
      const teamAGroup = screen.getByRole("group", { name: "Team A team" });

      for (const teamId of region.teamIds) {
        const team = VCT_TEAMS.find((candidate) => candidate.id === teamId)!;
        const card = within(teamAGroup).getByRole("button", { name: new RegExp(team.name) });
        fireEvent.click(card);
        expect(card).toHaveAttribute("aria-pressed", "true");
      }
    }
  });
});
