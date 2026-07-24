// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings } from "./rankingModel";
import { RankingBoard } from "./RankingBoard";

afterEach(cleanup);

const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES).slice(3);

describe("RankingBoard", () => {
  it("renders every entry as an accessible list with the expected label", () => {
    render(<RankingBoard entries={entries} scopeLabel="Global" useRegionalRank={false} onOpenDossier={vi.fn()} />);

    const list = screen.getByRole("list", { name: "Global power ranking, rank 4 and below" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(entries.length);
  });

  it("labels each row with its global rank when useRegionalRank is false", () => {
    render(<RankingBoard entries={entries} scopeLabel="Global" useRegionalRank={false} onOpenDossier={vi.fn()} />);
    expect(screen.getByText(`#${entries[0]!.globalRank}`)).toBeInTheDocument();
  });

  it("labels each row with its regional rank and a Global # secondary label when useRegionalRank is true", () => {
    render(<RankingBoard entries={entries} scopeLabel="Pacific" useRegionalRank onOpenDossier={vi.fn()} />);
    expect(screen.getAllByText(`#${entries[0]!.regionalRank}`).length).toBeGreaterThan(0);
    expect(screen.getByText(`Global #${entries[0]!.globalRank}`)).toBeInTheDocument();
  });
});
