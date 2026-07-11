import type { Metadata } from "next";
import { teams, maps } from "@repo/prediction-engine";
import { PredictionStudioClient } from "../../features/prediction-studio/PredictionStudioClient";

export const metadata: Metadata = {
  title: "Prediction Studio | Valorant Analytics Platform",
  description:
    "Select two professional VALORANT teams and generate an explainable win prediction backed by Team DNA and Match DNA.",
  openGraph: {
    title: "Prediction Studio | Valorant Analytics Platform",
    description:
      "Select two professional VALORANT teams and generate an explainable win prediction backed by Team DNA and Match DNA.",
    type: "website",
  },
};

export default function PredictionStudioPage() {
  return <PredictionStudioClient teams={teams} maps={maps} />;
}
