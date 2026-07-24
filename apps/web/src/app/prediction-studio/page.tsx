import type { Metadata } from "next";
import { maps } from "@repo/prediction-engine";
import { VCT_REGIONS, VCT_TEAMS } from "../../constants/vct";
import { PredictionStudioClient } from "../../features/prediction-studio/PredictionStudioClient";
import { MEDIA_ASSETS } from "../../constants/media";
import { parseUrlState, toUrlSearchParams } from "../../lib/urlState";

export const metadata: Metadata = {
  title: "Prediction Studio | Valorant Analytics Platform",
  description:
    "Select two professional VALORANT teams and generate an explainable win prediction backed by Team DNA and Match DNA.",
  openGraph: {
    title: "Prediction Studio | Valorant Analytics Platform",
    description:
      "Select two professional VALORANT teams and generate an explainable win prediction backed by Team DNA and Match DNA.",
    type: "website",
    images: [
      {
        url: MEDIA_ASSETS.predictionStudioDashboard.path,
        width: MEDIA_ASSETS.predictionStudioDashboard.width,
        height: MEDIA_ASSETS.predictionStudioDashboard.height,
        alt: "Prediction Studio",
      },
    ],
  },
};

interface PredictionStudioPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PredictionStudioPage({ searchParams }: PredictionStudioPageProps) {
  const resolvedSearchParams = await searchParams;
  const validMapIds = new Set(maps.map((map) => map.id));
  const initialUrlState = parseUrlState(toUrlSearchParams(resolvedSearchParams), { validMapIds });

  return (
    <PredictionStudioClient
      regions={VCT_REGIONS}
      teams={VCT_TEAMS}
      maps={maps}
      initialUrlState={initialUrlState}
    />
  );
}
