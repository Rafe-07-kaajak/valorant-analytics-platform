import { ArrowRight, Brain, Database, Layers, MessageCircle, TrendingUp } from "lucide-react";
import { Container, ScrollReveal, Section } from "@repo/ui";

const PIPELINE = [
  { label: "Raw Match Data", icon: Database },
  { label: "Structured Features", icon: Layers },
  { label: "Analytical Knowledge", icon: Brain },
  { label: "Prediction", icon: TrendingUp },
  { label: "Explanation", icon: MessageCircle },
];

export function ProductStory() {
  return (
    <Section>
      <Container className="flex flex-col gap-xl">
        <ScrollReveal className="flex max-w-(--breakpoint-md) flex-col gap-sm">
          <h2>Statistics alone rarely answer the question that matters.</h2>
          <p className="text-lg text-muted-foreground">
            Most platforms tell you who won. Few explain why one team was favored, which factors
            mattered most, or how confident you should be in the result. This platform connects
            raw competitive data to a prediction through a transparent chain of reasoning — so
            every number comes with an explanation attached.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <ol className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
            {PIPELINE.map((stage, index) => (
              <li key={stage.label} className="flex items-center gap-md sm:flex-col sm:gap-2xs sm:text-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-badge-brand-bg text-badge-brand-text">
                  <stage.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-foreground">{stage.label}</span>
                {index < PIPELINE.length - 1 ? (
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground sm:hidden"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
