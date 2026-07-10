import Link from "next/link";
import { buttonVariants, Container, Section } from "@repo/ui";

export function Hero() {
  return (
    <Section>
      <Container className="flex flex-col items-start gap-md">
        <h1>Understand professional VALORANT matches before they happen.</h1>
        <p className="max-w-(--breakpoint-sm) text-lg text-muted-foreground">
          Explainable predictions for Tier-1 VALORANT — built on Team DNA, Match DNA, and
          transparent reasoning instead of a single opaque probability.
        </p>
        <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
          Open Prediction Studio
        </Link>
      </Container>
    </Section>
  );
}
