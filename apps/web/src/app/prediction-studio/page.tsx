import type { Metadata } from "next";
import { teams, maps } from "@repo/prediction-engine";
import { PredictionStudioClient } from "../../features/prediction-studio/PredictionStudioClient";
import { MEDIA_ASSETS } from "../../constants/media";

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

export default function PredictionStudioPage() {
  return <PredictionStudioClient teams={teams} maps={maps} />;
}
