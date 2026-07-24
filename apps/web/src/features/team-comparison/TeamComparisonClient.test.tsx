/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { maps, VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { TeamComparisonClient } from "./TeamComparisonClient";
import { EMPTY_CANONICAL_URL_STATE, type CanonicalUrlState } from "../../lib/urlState";

// TASK-039: TeamComparisonClient now syncs its selection to the URL via
// useCanonicalUrlState, which requires a Next.js App Router context. This
// stub mirrors the real App Router: a `replace` call is reflected in the
// next `useSearchParams()` read, not just recorded as a call — otherwise
// the hook would (correctly) treat every render as an external navigation
// back to the empty URL and reset state on every interaction.
let mockSearch = "";
const replaceCalls: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      replaceCalls.push(url);
      const queryIndex = url.indexOf("?");
      mockSearch = queryIndex === -1 ? "" : url.slice(queryIndex + 1);
    },
  }),
  usePathname: () => "/team-comparison",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

afterEach(() => {
  cleanup();
  mockSearch = "";
  replaceCalls.length = 0;
});

function renderClient(initialUrlState: CanonicalUrlState = EMPTY_CANONICAL_URL_STATE) {
  render(
    <TeamComparisonClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={VCT_PROFILE_DISCLOSURE}
      initialUrlState={initialUrlState}
    />,
  );
}

function selectTeam(side: "A" | "B", regionName: string, teamName: string) {
  const regionGroup = screen.getByRole("group", { name: `Team ${side} region` });
  fireEvent.click(within(regionGroup).getByRole("button", { name: new RegExp(regionName) }));

  const teamGroup = screen.getByRole("group", { name: `Team ${side} team` });
  fireEvent.click(within(teamGroup).getByRole("button", { name: new RegExp(teamName) }));
}

describe("TeamComparisonClient", () => {
  it("shows an empty state before either team is selected, with no charts rendered", () => {
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
    function selectBothTeams() {
      renderClient();
      selectTeam("A", "Pacific", "Paper Rex");
      selectTeam("B", "Americas", "G2 Esports");
    }

    it("renders all four tabs with correct ARIA tab semantics", () => {
      selectBothTeams();
      const tablist = screen.getByRole("tablist", { name: "Comparison views" });
      const tabs = within(tablist).getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Overview", "Team DNA", "Maps", "Factors"]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    });

    it("shows the Overview tab's content by default, including the neutral summary", () => {
      selectBothTeams();
      expect(screen.getAllByText(/Paper Rex/).length).toBeGreaterThan(0);
      expect(screen.getByText("Overall Rating")).toBeInTheDocument();
    });

    it("switches to the Team DNA tab on activation and keeps both teams selected", () => {
      selectBothTeams();
      // Radix Tabs' default "automatic" activation mode switches on focus
      // (matching real browser behavior, where a click also focuses its
      // target). fireEvent.focus dispatches through React's synthetic event
      // system the way that real focus would, unlike a raw element.focus()
      // DOM call, which doesn't reliably reach Radix's onFocus handler here.
      fireEvent.focus(screen.getByRole("tab", { name: "Team DNA" }));

      expect(screen.getByRole("tab", { name: "Team DNA" })).toHaveAttribute("aria-selected", "true");
      // Selection state persists — the selector still shows both teams.
      expect(screen.getAllByText("Paper Rex").length).toBeGreaterThan(0);
      expect(screen.getAllByText("G2 Esports").length).toBeGreaterThan(0);
    });

    it("switches to the Maps tab and renders map rows", () => {
      selectBothTeams();
      fireEvent.focus(screen.getByRole("tab", { name: "Maps" }));
      expect(screen.getByRole("list", { name: "Modeled map strength by map" })).toBeInTheDocument();
    });

    it("switches to the Factors tab and renders derived factors", () => {
      selectBothTeams();
      fireEvent.focus(screen.getByRole("tab", { name: "Factors" }));
      expect(screen.getByText("Aggression Advantage")).toBeInTheDocument();
    });

    it("activates a tab via keyboard (Enter) once it has focus, without a pointer", () => {
      // Radix's roving-tabindex ArrowRight/Left focus-move relies on real
      // browser focus timing that jsdom doesn't reproduce reliably — full
      // arrow-key traversal is covered in e2e (a real browser) instead.
      // Enter/Space activation is a direct keydown handler with no such
      // dependency, so it's reliable here and still exercises real
      // "keyboard, no pointer" activation.
      selectBothTeams();
      const dnaTab = screen.getByRole("tab", { name: "Team DNA" });
      fireEvent.keyDown(dnaTab, { key: "Enter" });

      expect(dnaTab).toHaveAttribute("aria-selected", "true");
    });

    it("never distinguishes Team A/B by color alone — advantage badges always include the team name", () => {
      selectBothTeams();
      const overallRatingLabel = screen.getByText("Overall Rating");
      const row = overallRatingLabel.closest("div")?.parentElement;
      expect(row).not.toBeNull();
      // The advantage badge text is either "Even" or contains an actual team name — never just a color swatch.
      const badgeText = within(row!).getAllByText(/Even|Paper Rex|G2 Esports/)[0]?.textContent;
      expect(badgeText).toBeTruthy();
    });

    it("does not update the URL when switching tabs", () => {
      selectBothTeams();
      replaceCalls.length = 0;
      fireEvent.focus(screen.getByRole("tab", { name: "Maps" }));
      fireEvent.focus(screen.getByRole("tab", { name: "Factors" }));
      expect(replaceCalls).toHaveLength(0);
    });
  });

  it("initializes both teams and renders the full comparison directly from URL state", () => {
    renderClient({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: [],
      format: null,
      mode: null,
    });

    expect(screen.getByRole("tablist", { name: "Comparison views" })).toBeInTheDocument();
    expect(screen.getAllByText("Paper Rex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("G2 Esports").length).toBeGreaterThan(0);
  });

  it("shows the normal partial state for an incomplete URL-provided selection", () => {
    renderClient({ ...EMPTY_CANONICAL_URL_STATE, regionA: "pacific", teamA: "paper-rex" });
    expect(screen.getByText(/Paper Rex is selected for Team A/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("updates the URL when a team is selected", () => {
    renderClient();
    selectTeam("A", "Pacific", "Paper Rex");
    expect(replaceCalls.at(-1)).toBe("/team-comparison?regionA=pacific&teamA=paper-rex");
  });

  it("shows cross-feature links preserving both teams once selected", () => {
    renderClient();
    selectTeam("A", "Pacific", "Paper Rex");
    selectTeam("B", "Americas", "G2 Esports");

    const link = screen.getByRole("link", { name: /Open in Prediction Studio/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("teamA=paper-rex"));
    expect(link).toHaveAttribute("href", expect.stringContaining("teamB=g2-esports"));
  });
});
