import type { Metadata } from "next";
import { VCT_PROFILE_DISCLOSURE, VCT_TEAM_PROFILES, maps } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { TeamComparisonClient } from "../../features/team-comparison/TeamComparisonClient";
import { MEDIA_ASSETS } from "../../constants/media";
import { parseUrlState, toUrlSearchParams } from "../../lib/urlState";

export const metadata: Metadata = {
  title: "Team Comparison Lab | Valorant Analytics Platform",
  description:
    "Compare any two of the 32 VCT Stage 1 teams' modeled profiles — ratings, Team DNA, map strength, and the biggest differences between them — without generating a match prediction.",
  openGraph: {
    title: "Team Comparison Lab | Valorant Analytics Platform",
    description:
      "Compare any two of the 32 VCT Stage 1 teams' modeled profiles side by side — no match prediction required.",
    type: "website",
    images: [
      {
        url: MEDIA_ASSETS.teamComparison.path,
        width: MEDIA_ASSETS.teamComparison.width,
        height: MEDIA_ASSETS.teamComparison.height,
        alt: "Team Comparison Lab",
      },
    ],
  },
};

interface TeamComparisonPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TeamComparisonPage({ searchParams }: TeamComparisonPageProps) {
  const resolvedSearchParams = await searchParams;
  const validMapIds = new Set(maps.map((map) => map.id));
  const initialUrlState = parseUrlState(toUrlSearchParams(resolvedSearchParams), { validMapIds });

  return (
    <TeamComparisonClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      profiles={VCT_TEAM_PROFILES}
      maps={maps}
      disclosure={VCT_PROFILE_DISCLOSURE}
      initialUrlState={initialUrlState}
    />
  );
}
