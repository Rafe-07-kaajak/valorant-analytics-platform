"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { buttonVariants, EASE_EMPHASIZED, Section } from "@repo/ui";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: EASE_EMPHASIZED,
    },
  },
};

const heroLayers = [
  "/assets/redesign/hero/layers/landing-hero-layer-01-background.png",
  "/assets/redesign/hero/layers/landing-hero-layer-02-jett.png",
  "/assets/redesign/hero/layers/landing-hero-layer-03-omen.png",
  "/assets/redesign/hero/layers/landing-hero-layer-04-map-core.png",
  "/assets/redesign/hero/layers/landing-hero-layer-05-hud.png",
  "/assets/redesign/hero/layers/landing-hero-layer-06-foreground.png",
] as const;

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Section
      className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden"
      data-theme="dark"
    >
      <div className="absolute inset-0 md:hidden" aria-hidden="true">
        <Image
          src="/assets/redesign/hero/mobile/landing-hero-mobile.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="absolute inset-0 hidden md:block" aria-hidden="true">
        {heroLayers.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className="pointer-events-none select-none object-cover object-center"
            style={{ zIndex: index }}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-background/95 via-background/70 to-background/10"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-background/70 via-transparent to-background/20"
        aria-hidden="true"
      />

      <div
        className="relative z-20"
        style={{
          width: "100%",
          maxWidth: "1280px",
          marginInline: "auto",
          paddingInline: "clamp(16px, 4vw, 64px)",
        }}
      >
        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={containerVariants}
          style={{
            display: "flex",
            width: "100%",
            maxWidth: "720px",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          <motion.h1
            variants={itemVariants}
            className="text-foreground"
            style={{
              width: "100%",
              maxWidth: "720px",
            }}
          >
            Understand professional VALORANT matches before they happen.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg leading-relaxed text-muted-foreground"
            style={{
              width: "100%",
              maxWidth: "620px",
            }}
          >
            Explainable predictions for Tier-1 VALORANT, built on Team DNA, Match DNA, and
            transparent reasoning instead of a single opaque probability.
          </motion.p>

          <motion.div variants={itemVariants}>
            <Link href="/prediction-studio" className={buttonVariants({ size: "lg" })}>
              Open Prediction Studio
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </Section>
  );
}