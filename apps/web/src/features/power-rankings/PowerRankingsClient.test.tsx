// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { maps, VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { PowerRankingsClient } from "./PowerRankingsClient";
import { EMPTY_POWER_RANKINGS_URL_STATE, type PowerRankingsUrlState } from "./rankingUrlState";
import { mockMatchMedia } from "../../test/mockMatchMedia";

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
  usePathname: () => "/power-rankings",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

afterEach(() => {
  cleanup();
  mockSearch = "";
  replaceCalls.length = 0;
});

function renderClient(initialUrlState: PowerRankingsUrlState = EMPTY_POWER_RANKINGS_URL_STATE) {
  render(
    <PowerRankingsClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={VCT_PROFILE_DISCLOSURE}
      initialUrlState={initialUrlState}
    />,
  );
}

describe("PowerRankingsClient", () => {
  it("renders the Global view by default with a sealed podium and visible board", () => {
    mockMatchMedia(() => false);
    renderClient();

    expect(screen.getByRole("heading", { level: 1, name: "Power Rankings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Global rank 1 team" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Global power ranking, rank 4 and below" })).toBeInTheDocument();
  });

  it("keeps a revealed Top 3 card revealed after switching to Regional and back to Global", () => {
    mockMatchMedia(() => false);
    renderClient();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Global rank 1 team" }));
    expect(screen.queryByRole("button", { name: "Reveal Global rank 1 team" })).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("tab", { name: "Regional" }));
    fireEvent.focus(screen.getByRole("tab", { name: "Global" }));

    expect(screen.queryByRole("button", { name: "Reveal Global rank 1 team" })).not.toBeInTheDocument();
  });

  it("opens the Team Dossier from a visible board row and closes it again", () => {
    mockMatchMedia(() => false);
    renderClient();

    const dossierButtons = screen.getAllByRole("button", { name: /^Open dossier for / });
    fireEvent.click(dossierButtons[0]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Power Score")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not put Top 3 reveal state in the URL", () => {
    mockMatchMedia(() => false);
    renderClient();
    replaceCalls.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "Reveal Global rank 1 team" }));
    expect(replaceCalls).toHaveLength(0);
  });
});
