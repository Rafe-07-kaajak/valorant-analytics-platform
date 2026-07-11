import { Hero } from "../features/landing/Hero";
import { ProductStory } from "../features/landing/ProductStory";
import { CoreFeatures } from "../features/landing/CoreFeatures";
import { SupportedTournaments } from "../features/landing/SupportedTournaments";
import { FinalCta } from "../features/landing/FinalCta";

export default function Home() {
  return (
    <>
      <Hero />
      <ProductStory />
      <CoreFeatures />
      <SupportedTournaments />
      <FinalCta />
    </>
  );
}
