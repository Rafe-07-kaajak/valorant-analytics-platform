import Link from "next/link";
import { buttonVariants, Card, Container, ScrollReveal, Section } from "@repo/ui";

export function FinalCta() {
  return (
    <Section>
      <Container>
        <ScrollReveal>
          <Card className="flex flex-col items-center gap-md py-2xl text-center">
            <h2>Pick two teams. See the reasoning, not just the result.</h2>
            <p className="max-w-(--breakpoint-sm) text-lg text-muted-foreground">
              Prediction Studio is free to explore — no account required.
            </p>
            <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
              Open Prediction Studio
            </Link>
          </Card>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
