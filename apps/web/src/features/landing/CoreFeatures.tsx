"use client";

import { BarChart3, Dna, MessageSquareText, Target } from "lucide-react";
import { motion } from "framer-motion";
import { Card, Container, ScrollReveal, Section } from "@repo/ui";

const FEATURES = [
  {
    icon: Target,
    title: "Interactive Match Prediction",
    description:
      "Select two professional teams and generate a prediction with win probability, confidence, and supporting analysis.",
  },
  {
    icon: Dna,
    title: "Team DNA",
    description:
      "Long-term team characteristics — aggression, consistency, adaptability, clutch performance — compressed into a single identity.",
  },
  {
    icon: MessageSquareText,
    title: "Explainable Predictions",
    description:
      "Every prediction includes the major factors behind it, ranked by how much each one actually mattered.",
  },
  {
    icon: BarChart3,
    title: "Interactive Data Visualization",
    description:
      "Complex analytical relationships presented through visualizations designed to improve understanding, not decorate a dashboard.",
  },
];

export function CoreFeatures() {
  return (
    <Section>
      <Container className="flex flex-col gap-xl">
        <ScrollReveal className="max-w-(--breakpoint-md)">
          <h2>Built around a small set of carefully designed features.</h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.08}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                <Card className="flex h-full flex-col gap-sm">
                  <span className="flex size-10 items-center justify-center rounded-full bg-badge-brand-bg text-badge-brand-text">
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3>{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
