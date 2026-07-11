"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { buttonVariants, Container, Section } from "@repo/ui";
import { AnimatedBackground } from "./AnimatedBackground";

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function Hero() {
  return (
    <Section className="relative overflow-hidden">
      <AnimatedBackground />
      <Container className="relative">
        <motion.div
          className="flex flex-col items-start gap-md"
          initial="hidden"
          animate="visible"
          variants={container}
        >
          <motion.h1 variants={item}>
            Understand professional VALORANT matches before they happen.
          </motion.h1>
          <motion.p variants={item} className="max-w-(--breakpoint-sm) text-lg text-muted-foreground">
            Explainable predictions for Tier-1 VALORANT — built on Team DNA, Match DNA, and
            transparent reasoning instead of a single opaque probability.
          </motion.p>
          <motion.div variants={item}>
            <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
              Open Prediction Studio
            </Link>
          </motion.div>
        </motion.div>
      </Container>
    </Section>
  );
}
