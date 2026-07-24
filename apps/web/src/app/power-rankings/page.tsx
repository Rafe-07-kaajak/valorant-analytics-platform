import type { Metadata } from "next";
import { maps, VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { PowerRankingsClient } from "../../features/power-rankings/PowerRankingsClient";
import { buildRealPowerRankings } from "../../features/power-rankings/rankingModel";
import { MEDIA_ASSETS } from "../../constants/media";
import { toUrlSearchParams } from "../../lib/urlState";
import { parsePowerRankingsUrlState } from "../../features/power-rankings/rankingUrlState";
import { getPowerRankingsRealData } from "../../server/prediction/powerRankingsRepository";

export const metadata: Metadata = {
  title: "Power Rankings | Valorant Analytics Platform",
  description:
    "Track all 32 VCT Stage 1 teams' modeled Power Score, globally and by region, with a premium Top 3 reveal and a detailed team dossier.",
  openGraph: {
    title: "Power Rankings | Valorant Analytics Platform",
    description: "All 32 VCT Stage 1 teams ranked by a transparent, modeled composite score.",
    type: "website",
    images: [
      {
        url: MEDIA_ASSETS.powerRankingsVisual.path,
        width: MEDIA_ASSETS.powerRankingsVisual.width,
        height: MEDIA_ASSETS.powerRankingsVisual.height,
        alt: "Power Rankings",
      },
    ],
  },
};

interface PowerRankingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function PowerRankingsPage({ searchParams }: PowerRankingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialUrlState = parsePowerRankingsUrlState(toUrlSearchParams(resolvedSearchParams));

  const realData = await getPowerRankingsRealData();

  if (!realData) {
    return (
      <PowerRankingsClient
        regions={VCT_REGIONS}
        teams={VCT_TEAMS}
        profiles={VCT_TEAM_PROFILES}
        maps={maps}
        disclosure={VCT_PROFILE_DISCLOSURE}
        initialUrlState={initialUrlState}
      />
    );
  }

  const realRankings = buildRealPowerRankings(VCT_TEAMS, realData.states, realData.verifiedTeamIds);
  const disclosure = `These rankings are computed from real ingested VCT match data, ${formatDateOnly(realData.canonicalWindow.windowStartIso)} onward (starting at ${realData.canonicalWindow.sourceEventName}) through the most recently ingested match. Each team's confidence tier (Verified, Provisional, or Unrated) reflects both identity-mapping confidence and how much real match history that team has in this window: a low-data team's score is shrunk toward the field average and penalized for uncertainty rather than shown with false confidence. Values are derived from official match results, not simulated.`;

  return (
    <PowerRankingsClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={disclosure}
      initialUrlState={initialUrlState}
      realRankings={realRankings}
    />
  );
}
