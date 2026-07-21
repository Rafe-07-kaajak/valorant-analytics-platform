import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge, buttonVariants, Card, Container, Meter, ScrollReveal, Section, SplitBar } from "@repo/ui";
import { InteractiveParticleField } from "../../components/effects/InteractiveParticleField";

export function PredictionStudioPreview() {
  return (
    <Section className="relative overflow-hidden">
      <Container className="flex flex-col gap-xl">
        <ScrollReveal className="flex max-w-(--breakpoint-md) flex-col gap-sm">
          <h2>Every prediction comes with its reasoning attached.</h2>
          <p className="text-lg text-muted-foreground">
            Pick two teams in Prediction Studio and get more than a probability: win chance,
            confidence, and the factors that shaped the result.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-xl lg:grid-cols-[24rem_28rem] lg:items-center lg:gap-2xl">
          <ScrollReveal delay={0.1} className="relative w-full">
            <InteractiveParticleField className="scale-125" />
            <Card className="relative flex flex-col gap-md" aria-hidden="true">
              <div className="flex items-center justify-between gap-sm">
                <span className="text-sm font-medium text-foreground">Win Probability</span>
                <Badge tone="brand">High Confidence</Badge>
              </div>
              <SplitBar
                segments={[
                  { id: "team-a", label: "Team A", value: 64, color: "var(--team-a)" },
                  { id: "team-b", label: "Team B", value: 36, color: "var(--team-b)" },
                ]}
              />
              <Meter label="Trust Score" value={82} />
              <p className="flex items-start gap-2xs text-sm text-muted-foreground">
                <Sparkles className="mt-[2px] size-4 shrink-0 text-brand-500" aria-hidden="true" />
                Recent form and map pool depth are the strongest factors behind this result.
              </p>
            </Card>
          </ScrollReveal>

          <ScrollReveal
            delay={0.16}
            className="relative aspect-[8/5] w-full overflow-hidden rounded-lg border border-surface-border"
          >
            <Image
              src="/assets/redesign/supporting/prediction-result-visual.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 28rem, 100vw"
              loading="lazy"
              className="object-cover"
            />
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.22}>
          <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
            Try Prediction Studio
          </Link>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
