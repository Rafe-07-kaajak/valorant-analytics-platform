import type { Metadata } from "next";
import { VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES, maps } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { MapMatchupClient } from "../../features/map-matchup/MapMatchupClient";
import { MEDIA_ASSETS } from "../../constants/media";
import { parseUrlState, toUrlSearchParams } from "../../lib/urlState";

export const metadata: Metadata = {
  title: "Map Matchup Explorer | Valorant Analytics Platform",
  description:
    "Compare any two of the 32 VCT Stage 1 teams' modeled strength across every supported map. See which maps favor which side, which are close, and why.",
  openGraph: {
    title: "Map Matchup Explorer | Valorant Analytics Platform",
    description:
      "Inspect a modeled map-by-map matchup for any two VCT Stage 1 teams: ranking, aggregate pool view, and per-map explanations.",
    type: "website",
    images: [
      {
        url: MEDIA_ASSETS.tacticalMapHeroBackground.path,
        width: MEDIA_ASSETS.tacticalMapHeroBackground.width,
        height: MEDIA_ASSETS.tacticalMapHeroBackground.height,
        alt: "Map Matchup Explorer",
      },
    ],
  },
};

interface MapMatchupPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MapMatchupPage({ searchParams }: MapMatchupPageProps) {
  const resolvedSearchParams = await searchParams;
  const validMapIds = new Set(maps.map((map) => map.id));
  const initialUrlState = parseUrlState(toUrlSearchParams(resolvedSearchParams), { validMapIds });

  return (
    <MapMatchupClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={VCT_PROFILE_DISCLOSURE}
      initialUrlState={initialUrlState}
    />
  );
}
