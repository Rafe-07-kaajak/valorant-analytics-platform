"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { buttonVariants, cn, EASE_EMPHASIZED, Section } from "@repo/ui";

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

// Render order matches docs/40's Hero Layers spec. `idleClassName` is a
// restrained, always-on CSS loop (apps/web/src/styles/motion.css) applied to
// the inner <Image> itself; the scroll-driven transform below is applied to
// the *outer* wrapper. Two separate elements, each owning exactly one
// `transform` source, so the idle loop and the scroll-driven dive never
// fight over the same CSS property.
const heroLayers = [
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-01-background.png",
    idleClassName: undefined,
  },
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-02-jett.png",
    idleClassName: "animate-hero-jett",
  },
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-03-omen.png",
    idleClassName: "animate-hero-omen",
  },
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-04-map-core.png",
    idleClassName: "animate-hero-core",
  },
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-05-hud.png",
    idleClassName: "animate-hero-hud",
  },
  {
    src: "/assets/redesign/hero/layers/landing-hero-layer-06-foreground.png",
    idleClassName: "animate-hero-foreground",
  },
] as const;

/**
 * Headline + CTA, shared between the desktop scroll stage (nested inside the
 * sticky panel, scroll-faded) and the mobile block (its own always-static
 * copy, since the desktop stage it would otherwise live in is `md:hidden`).
 * `shouldReduceMotion` is threaded through rather than read again with its
 * own `useReducedMotion()` call so both call sites share one source of truth
 * for the initial stagger state.
 */
function HeroCopy({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  return (
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
  );
}

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Whole-hero scroll progress (0-1), smoothed through a spring before any
  // transform reads it. Raw `scrollYProgress` only updates on the browser's
  // own scroll-event dispatch, which is bursty/irregular depending on input
  // device (trackpad vs. wheel vs. touch) and can read as choppy when fed
  // straight into a transform; `useSpring` re-samples it every animation
  // frame via Framer's internal RAF loop instead, so the value the layers
  // below actually animate toward is always continuous, regardless of how
  // sparse the underlying scroll events are. Every transform is still a
  // MotionValue written directly to `style` — never React state — so
  // scrolling the ~190vh hero container triggers zero re-renders.
  const { scrollYProgress: rawScrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });
  const scrollYProgress = useSpring(rawScrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1, 1.025]);

  const jettX = useTransform(scrollYProgress, [0, 1], [0, -42]);
  const jettY = useTransform(scrollYProgress, [0, 1], [0, 24]);
  const jettScale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  const omenX = useTransform(scrollYProgress, [0, 1], [0, 46]);
  const omenY = useTransform(scrollYProgress, [0, 1], [0, -18]);
  const omenScale = useTransform(scrollYProgress, [0, 1], [1, 1.065]);

  const coreY = useTransform(scrollYProgress, [0, 1], [0, -26]);
  const coreScale = useTransform(scrollYProgress, [0, 1], [1, 1.13]);

  const hudX = useTransform(scrollYProgress, [0, 1], [0, -14]);
  const hudY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const hudOpacity = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

  const fgY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const fgScale = useTransform(scrollYProgress, [0, 1], [1, 1.07]);

  const contentY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const contentOpacity = useTransform(scrollYProgress, [0.55, 1], [1, 0]);

  // Reduced motion: every scroll-linked style below is skipped (each layer
  // sits at its plain CSS rest position) rather than merely animated
  // instantly, since these are one-time-computed MotionValues, not
  // `motion.*` `animate`/`variants` targets MotionConfig can intercept.
  const layerScrollStyles = shouldReduceMotion
    ? ([undefined, undefined, undefined, undefined, undefined, undefined] as const)
    : ([
        { scale: backgroundScale },
        { x: jettX, y: jettY, scale: jettScale },
        { x: omenX, y: omenY, scale: omenScale },
        { y: coreY, scale: coreScale },
        { x: hudX, y: hudY, opacity: hudOpacity },
        { y: fgY, scale: fgScale },
      ] as const);

  return (
    // `pt-0 sm:pt-0` overrides Section's own `py-2xl sm:py-3xl` base padding
    // (top only — bottom is untouched, not part of this bug): that padding
    // was a second, redundant navbar offset stacked on top of the sticky
    // stage's own `top-16` below, pushing the whole hero down and exposing
    // a gap of the plain `<body>` background (light in light mode) above
    // it. `bg-background` (resolving to the dark value via `data-theme`)
    // guards the same gap from the other side — even a transient unpainted
    // moment reads as this section's own dark background, never the
    // ambient page background.
    <Section
      className="relative min-h-[calc(100dvh-4rem)] bg-background pt-0 sm:pt-0 md:min-h-0"
      data-theme="dark"
    >
      <div className="absolute inset-0 overflow-hidden md:hidden" aria-hidden="true">
        <Image
          src="/assets/redesign/hero/mobile/landing-hero-mobile.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/*
        Desktop scroll stage. Tall (~190vh) so there is real scroll distance
        for the dive; under reduced motion this collapses back to one
        viewport via pure CSS (motion-safe/motion-reduce are mutually
        exclusive media queries, so this never depends on Tailwind's
        cascade/source order) — a reduced-motion visitor never scrolls
        through an oversized, mostly-empty container. The inner stage stays
        `sticky` below the 4rem navbar for the scroll distance above.
      */}
      <div
        ref={scrollRef}
        className="relative hidden md:block md:motion-safe:h-[190vh] md:motion-reduce:h-[calc(100dvh-4rem)]"
      >
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col justify-center overflow-hidden">
          {heroLayers.map((layer, index) => (
            <motion.div
              key={layer.src}
              className="absolute inset-0"
              style={layerScrollStyles[index]}
            >
              <Image
                src={layer.src}
                alt=""
                fill
                priority={index === 0}
                sizes="100vw"
                className={cn(
                  "pointer-events-none select-none object-cover object-center motion-reduce:animate-none",
                  layer.idleClassName,
                )}
                style={{ zIndex: index }}
              />
            </motion.div>
          ))}

          <div
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-background/95 via-background/70 to-background/10"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-background/70 via-transparent to-background/20"
            aria-hidden="true"
          />

          <motion.div
            className="relative z-20"
            style={shouldReduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "1280px",
                marginInline: "auto",
                paddingInline: "clamp(16px, 4vw, 64px)",
              }}
            >
              <HeroCopy shouldReduceMotion={shouldReduceMotion} />
            </div>
          </motion.div>
        </div>
      </div>

      {/*
        Mobile-equivalent content: the layered scroll stage above is
        `md:hidden`-gated, so its headline/CTA never render below md. The
        mobile block gets the same `HeroCopy`, laid out with the same
        vertical centering the desktop stage used before this task's scroll
        rework.
      */}
      <div className="relative z-20 flex min-h-[calc(100dvh-4rem)] flex-col justify-center md:hidden">
        <div
          style={{
            width: "100%",
            maxWidth: "1280px",
            marginInline: "auto",
            paddingInline: "clamp(16px, 4vw, 64px)",
          }}
        >
          <HeroCopy shouldReduceMotion={shouldReduceMotion} />
        </div>
      </div>
    </Section>
  );
}
