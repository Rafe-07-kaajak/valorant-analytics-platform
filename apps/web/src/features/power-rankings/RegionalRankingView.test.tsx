// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings, groupEntriesByRegion } from "./rankingModel";
import { RegionalRankingView } from "./RegionalRankingView";
import { mockMatchMedia } from "../../test/mockMatchMedia";

afterEach(cleanup);

const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
const entriesByRegion = groupEntriesByRegion(entries);

describe("RegionalRankingView", () => {
  it("shows every team in the selected region face-up, with no reveal interaction", () => {
    mockMatchMedia(() => false);
    render(
      <RegionalRankingView
        regions={VCT_REGIONS}
        entriesByRegion={entriesByRegion}
        selectedRegion="pacific"
        onRegionChange={vi.fn()}
        onOpenDossier={vi.fn()}
      />,
    );

    // No sealed "Reveal ... team" buttons anywhere in Regional mode.
    expect(screen.queryByRole("button", { name: /^Reveal / })).not.toBeInTheDocument();

    const pacificTop3 = entriesByRegion.pacific!.slice(0, 3);
    for (const entry of pacificTop3) {
      expect(screen.getByText(entry.team.name, { selector: "p" })).toBeInTheDocument();
    }

    const list = screen.getByRole("list", { name: "VCT Pacific power ranking, rank 4 and below" });
    expect(list).toBeInTheDocument();
  });

  it("switching region tabs changes which region's teams are shown", () => {
    mockMatchMedia(() => false);
    const onRegionChange = vi.fn();
    render(
      <RegionalRankingView
        regions={VCT_REGIONS}
        entriesByRegion={entriesByRegion}
        selectedRegion="pacific"
        onRegionChange={onRegionChange}
        onOpenDossier={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByRole("tab", { name: /Americas/ }));
    expect(onRegionChange).toHaveBeenCalledWith("americas");
  });
});
