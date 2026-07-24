// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VCT_REGIONS } from "../../constants/vct";
import { RegionRankingTabs } from "./RegionRankingTabs";

afterEach(cleanup);

describe("RegionRankingTabs", () => {
  it("renders one tab per region and shows the selected region's content", () => {
    render(
      <RegionRankingTabs regions={VCT_REGIONS} selectedRegion="pacific" onRegionChange={vi.fn()}>
        {(region) => <p>Content for {region}</p>}
      </RegionRankingTabs>,
    );

    expect(screen.getByRole("tab", { name: /Pacific/ })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Content for pacific")).toBeInTheDocument();
  });

  it("calls onRegionChange when a different region tab is activated", () => {
    const onRegionChange = vi.fn();
    render(
      <RegionRankingTabs regions={VCT_REGIONS} selectedRegion="pacific" onRegionChange={onRegionChange}>
        {(region) => <p>Content for {region}</p>}
      </RegionRankingTabs>,
    );

    // Radix Tabs' default "automatic" activation mode switches on focus.
    fireEvent.focus(screen.getByRole("tab", { name: /EMEA/ }));
    expect(onRegionChange).toHaveBeenCalledWith("emea");
  });
});
