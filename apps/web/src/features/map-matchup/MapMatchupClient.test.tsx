/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { maps, VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { MapMatchupClient } from "./MapMatchupClient";

afterEach(cleanup);

function renderClient() {
  render(
    <MapMatchupClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={VCT_PROFILE_DISCLOSURE}
    />,
  );
}

function selectTeam(side: "A" | "B", regionName: string, teamName: string) {
  const regionGroup = screen.getByRole("group", { name: `Team ${side} region` });
  fireEvent.click(within(regionGroup).getByRole("button", { name: new RegExp(regionName) }));

  const teamGroup = screen.getByRole("group", { name: `Team ${side} team` });
  fireEvent.click(within(teamGroup).getByRole("button", { name: new RegExp(teamName) }));
}

function selectBothTeams() {
  renderClient();
  selectTeam("A", "Pacific", "Paper Rex");
  selectTeam("B", "Americas", "G2 Esports");
}

describe("MapMatchupClient", () => {
  it("shows an empty state before either team is selected, with no ranking rendered", () => {
    renderClient();
    expect(screen.getByText(/Select a team for each side to begin/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows a partial state with the selected team's identity when only one side is chosen", () => {
    renderClient();
    selectTeam("A", "Pacific", "Paper Rex");
    expect(screen.getByText(/Paper Rex is selected for Team A/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows the adapted disclosure text visibly", () => {
    renderClient();
    expect(screen.getByText(/This comparison uses simulated team profiles/)).toBeInTheDocument();
  });

  it("prevents the same team from being selected on both sides", () => {
    renderClient();
    selectTeam("A", "Pacific", "Paper Rex");

    const regionBGroup = screen.getByRole("group", { name: "Team B region" });
    fireEvent.click(within(regionBGroup).getByRole("button", { name: /Pacific/ }));
    const teamBGroup = screen.getByRole("group", { name: "Team B team" });
    const paperRexOnSideB = within(teamBGroup).getByRole("button", { name: /Paper Rex/ });

    expect(paperRexOnSideB).toHaveAttribute("aria-disabled", "true");
  });

  describe("once both teams are selected", () => {
    it("renders the map pool controls and all three tabs", () => {
      selectBothTeams();
      expect(screen.getByRole("group", { name: /Map Pool/ })).toBeInTheDocument();

      const tablist = screen.getByRole("tablist", { name: "Map matchup views" });
      const tabs = within(tablist).getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Map Ranking", "Selected Pool", "Map Detail"]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    });

    it("shows the full map ranking by default, sorted by largest gap", () => {
      selectBothTeams();
      expect(screen.getByRole("list", { name: "Maps ranked by modeled gap" })).toBeInTheDocument();
      expect(screen.getByLabelText("Sort by")).toHaveValue("largest-gap");
    });

    it("changes the sort mode via the sort control", () => {
      selectBothTeams();
      fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "map-name" } });
      expect(screen.getByLabelText("Sort by")).toHaveValue("map-name");
    });

    it("toggles a map in and out of the pool via the pool controls", () => {
      selectBothTeams();
      const poolGroup = screen.getByRole("group", { name: /Map Pool/ });
      const ascentToggle = within(poolGroup).getByRole("button", { name: "Ascent" });

      expect(ascentToggle).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(ascentToggle);
      expect(ascentToggle).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(ascentToggle);
      expect(ascentToggle).toHaveAttribute("aria-pressed", "false");
    });

    it("selects every map via Select All", () => {
      selectBothTeams();
      fireEvent.click(screen.getByRole("button", { name: "Select All" }));
      const poolGroup = screen.getByRole("group", { name: /Map Pool/ });
      for (const button of within(poolGroup).getAllByRole("button")) {
        expect(button).toHaveAttribute("aria-pressed", "true");
      }
    });

    it("clears the pool via Clear", () => {
      selectBothTeams();
      fireEvent.click(screen.getByRole("button", { name: "Select All" }));
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      const poolGroup = screen.getByRole("group", { name: /Map Pool/ });
      for (const button of within(poolGroup).getAllByRole("button")) {
        expect(button).toHaveAttribute("aria-pressed", "false");
      }
    });

    it("selects only close maps via the Close Maps shortcut", () => {
      selectBothTeams();

      // Count how many maps the ranking list itself classifies as Close/Even
      // before touching the shortcut.
      const rankingList = screen.getByRole("list", { name: "Maps ranked by modeled gap" });
      const closeRowCount = within(rankingList).getAllByText("Close/Even").length;

      fireEvent.click(screen.getByRole("button", { name: "Close Maps" }));

      const poolGroup = screen.getByRole("group", { name: /Map Pool/ });
      const pressedCount = within(poolGroup)
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true").length;

      expect(pressedCount).toBe(closeRowCount);
    });

    it("sets the active map on the Map Detail tab when a ranking row is clicked", () => {
      selectBothTeams();
      const rankingList = screen.getByRole("list", { name: "Maps ranked by modeled gap" });
      const rows = within(rankingList).getAllByRole("button");
      // Pick the second row so the result can't be explained by the
      // "first ranked row" fallback alone.
      const secondRow = rows[1]!;
      const mapName = secondRow.getAttribute("aria-label")!.split(":")[0];

      fireEvent.click(secondRow);
      fireEvent.focus(screen.getByRole("tab", { name: "Map Detail" }));

      const panel = screen.getByRole("tabpanel");
      expect(within(panel).getByRole("heading", { level: 2 })).toHaveTextContent(mapName);
    });

    it("persists team selection and map pool state across tab switches", () => {
      selectBothTeams();
      const poolGroup = screen.getByRole("group", { name: /Map Pool/ });
      fireEvent.click(within(poolGroup).getByRole("button", { name: "Ascent" }));

      fireEvent.focus(screen.getByRole("tab", { name: "Selected Pool" }));
      fireEvent.focus(screen.getByRole("tab", { name: "Map Ranking" }));

      expect(screen.getAllByText("Paper Rex").length).toBeGreaterThan(0);
      expect(screen.getAllByText("G2 Esports").length).toBeGreaterThan(0);
      expect(within(screen.getByRole("group", { name: /Map Pool/ })).getByRole("button", { name: "Ascent" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("shows the Selected Pool aggregate once maps are selected", () => {
      selectBothTeams();
      fireEvent.click(screen.getByRole("button", { name: "Select All" }));
      fireEvent.focus(screen.getByRole("tab", { name: "Selected Pool" }));

      const panel = screen.getByRole("tabpanel");
      expect(within(panel).getByText(/The selected .*-map pool|is modeled as close overall/)).toBeInTheDocument();
    });

    it("never distinguishes Team A/B by color alone in advantage badges", () => {
      selectBothTeams();
      const rankingList = screen.getByRole("list", { name: "Maps ranked by modeled gap" });
      const badges = within(rankingList).getAllByText(/Close\/Even|Paper Rex|G2 Esports/);
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
