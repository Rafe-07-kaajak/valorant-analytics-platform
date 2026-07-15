import Link from "next/link";
import { buttonVariants, Card, cn, Container, ScrollReveal, Section } from "@repo/ui";
import { MediaBackground } from "../../components/media/MediaBackground";
import { EnergyPulse } from "../../components/effects/EnergyPulse";
import { MEDIA_ASSETS } from "../../constants/media";

export function FinalCta() {
  return (
    <Section>
      <Container>
        <ScrollReveal>
          <Card
            data-theme="dark"
            className="relative flex flex-col items-center gap-md overflow-hidden py-2xl text-center"
          >
            <MediaBackground asset={MEDIA_ASSETS.finalCta} scrim="full" />
            <EnergyPulse />
            <h2 className="relative text-foreground">
              Pick two teams. See the reasoning, not just the result.
            </h2>
            <p className="relative max-w-(--breakpoint-sm) text-lg text-muted-foreground">
              Prediction Studio is free to explore — no account required.
            </p>
            <Link href="/prediction-studio" className={cn(buttonVariants({ size: "lg" }), "relative")}>
              Open Prediction Studio
            </Link>
          </Card>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
