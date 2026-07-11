import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge, buttonVariants, Card, Container, Meter, ScrollReveal, Section, SplitBar } from "@repo/ui";

export function PredictionStudioPreview() {
  return (
    <Section>
      <Container className="flex flex-col items-start gap-xl">
        <ScrollReveal className="flex max-w-(--breakpoint-md) flex-col gap-sm">
          <h2>Every prediction comes with its reasoning attached.</h2>
          <p className="text-lg text-muted-foreground">
            Pick two teams in Prediction Studio and get more than a probability — win chance,
            confidence, and the factors that shaped the result.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="w-full max-w-(--breakpoint-sm)">
          <Card className="flex flex-col gap-md" aria-hidden="true">
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

        <ScrollReveal delay={0.16}>
          <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
            Try Prediction Studio
          </Link>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
