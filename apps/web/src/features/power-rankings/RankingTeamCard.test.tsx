// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { buildPowerRankings } from "./rankingModel";
import { RankingTeamCard } from "./RankingTeamCard";

afterEach(cleanup);

const entry = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES)[3]!;

describe("RankingTeamCard", () => {
  it("renders as a visible list row with rank, name, region, score, and the Baseline movement badge", () => {
    render(<RankingTeamCard entry={entry} primaryRank={4} onOpenDossier={vi.fn()} />);

    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText(entry.team.name, { selector: ".truncate" })).toBeInTheDocument();
    expect(screen.getByText(entry.powerScore.toFixed(2))).toBeInTheDocument();
    expect(screen.getByText("Baseline")).toBeInTheDocument();
  });

  it("shows the optional secondary rank label when provided", () => {
    render(<RankingTeamCard entry={entry} primaryRank={2} secondaryRankLabel="Global #4" onOpenDossier={vi.fn()} />);
    expect(screen.getByText("Global #4")).toBeInTheDocument();
  });

  it("calls onOpenDossier when the row is activated", () => {
    const onOpenDossier = vi.fn();
    render(<RankingTeamCard entry={entry} primaryRank={4} onOpenDossier={onOpenDossier} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpenDossier).toHaveBeenCalledTimes(1);
  });
});
