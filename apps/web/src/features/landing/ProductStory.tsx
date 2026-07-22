"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import {
  Brain,
  Database,
  GitBranch,
  Layers,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { useRef } from "react";
import { cn, DURATION_SLOW, EASE_EMPHASIZED, Section, useScrollProgress } from "@repo/ui";
import { AmbientSectionBackground } from "../../components/effects/AmbientSectionBackground";

const PIPELINE = [
  {
    label: "Raw Match Data",
    description:
      "Match results, rounds, maps, rosters, events, and competitive context enter the system as raw evidence.",
    icon: Database,
    image: "/assets/redesign/pipeline/pipeline-scene-01-raw-data.png",
  },
  {
    label: "Structured Features",
    description:
      "Raw records become consistent team, matchup, form, roster, and map-level analytical features.",
    icon: Layers,
    image: "/assets/redesign/pipeline/pipeline-scene-02-structured-features.png",
  },
  {
    label: "Analytical Knowledge",
    description:
      "Competitive patterns are converted into reusable signals that describe style, strength, stability, and context.",
    icon: Brain,
    image: "/assets/redesign/pipeline/pipeline-scene-03-analytical-knowledge.png",
  },
  {
    label: "Model Core",
    description:
      "The model combines historical evidence with the current matchup to estimate the most likely outcome.",
    icon: GitBranch,
    image: "/assets/redesign/pipeline/pipeline-scene-04-model-core.png",
  },
  {
    label: "Prediction Output",
    description:
      "The result includes win probability, confidence, expected advantage, and the uncertainty surrounding the estimate.",
    icon: TrendingUp,
    image: "/assets/redesign/pipeline/pipeline-scene-05-prediction-output.png",
  },
  {
    label: "Explanation Network",
    description:
      "Every prediction is connected back to the factors that influenced it, producing a transparent chain of reasoning.",
    icon: MessageCircle,
    image: "/assets/redesign/pipeline/pipeline-scene-06-explanation-network.png",
  },
] as const;

// Cyan -> blue -> violet -> magenta energy sweep, cycled across the six
// stages so the pipeline reads as one continuous conduit rather than six
// identically-colored cards.
const ACCENT_COLORS = [
  "var(--color-accent-cyan)",
  "var(--color-accent-blue)",
  "var(--color-accent-violet)",
  "var(--color-accent-magenta)",
] as const;

// Text reveals first and quickly; the image is the main event — a larger
// movement, a scale settle, and a brief blur-to-sharp, on a slight delay so
// it clearly follows the text rather than arriving as one indistinguishable
// block. Both are driven by the same parent `motion.li`'s `whileInView`
// (variant propagation), not by their own separate viewport observers.
const textVariants: Variants = {
  inactive: { opacity: 0, y: 16 },
  active: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_EMPHASIZED } },
};

const imageVariants: Variants = {
  inactive: { opacity: 0, y: 28, scale: 0.965, filter: "blur(6px)" },
  active: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.75, delay: 0.12, ease: EASE_EMPHASIZED },
  },
};

const nodeVariants: Variants = {
  inactive: { opacity: 0.35, scale: 0.7 },
  active: { opacity: 1, scale: 1, transition: { duration: DURATION_SLOW, ease: EASE_EMPHASIZED } },
};

const branchVariants: Variants = {
  inactive: { opacity: 0.15 },
  active: { opacity: 1, transition: { duration: DURATION_SLOW, ease: EASE_EMPHASIZED } },
};

// A broad, low-opacity radial glow behind each step, tinted with that step's
// own accent and alternating sides with the zig-zag layout — restrained
// ambient support for the card, never a competing focal point. Fades in
// with the rest of the step via the same parent `motion.li` variant
// propagation as node/branch/text above.
const glowVariants: Variants = {
  inactive: { opacity: 0 },
  active: { opacity: 1, transition: { duration: DURATION_SLOW, ease: EASE_EMPHASIZED } },
};

export function ProductStory() {
  const listRef = useRef<HTMLOListElement>(null);
  // Whole-section scroll progress (0-1) driving the illuminated spine fill —
  // a MotionValue bound directly to `scaleY` below, never React state, so
  // scrolling this section triggers zero re-renders (same pattern as
  // ScrollProgress/ParallaxLayer in packages/ui).
  const progress = useScrollProgress({
    target: listRef,
    offset: ["start center", "end center"],
  });

  return (
    <Section className="relative overflow-hidden">
      <AmbientSectionBackground
        wash="var(--gradient-pipeline-ambient)"
        texture={{ src: "/assets/redesign/textures/tactical-grid.png", opacity: 0.06 }}
        overlay={{ src: "/assets/redesign/overlays/node-network.png", opacity: 0.12, drift: "slow" }}
      />

      <div
        className="relative z-10"
        style={{
          width: "100%",
          maxWidth: "1440px",
          marginInline: "auto",
          paddingInline: "clamp(16px, 4vw, 64px)",
        }}
      >
        <header
          style={{
            display: "flex",
            width: "100%",
            maxWidth: "820px",
            flexDirection: "column",
            gap: "16px",
            paddingBlock: "clamp(48px, 8vw, 96px)",
          }}
        >
          <p
            className="text-sm font-semibold uppercase text-brand"
            style={{ letterSpacing: "0.18em" }}
          >
            From data to explanation
          </p>

          <h2
            style={{
              width: "100%",
              maxWidth: "780px",
            }}
          >
            Statistics alone rarely answer the question that matters.
          </h2>

          <p
            className="text-lg leading-relaxed text-muted-foreground"
            style={{
              width: "100%",
              maxWidth: "720px",
            }}
          >
            Follow the full analytical journey from raw competitive records to an
            explainable prediction.
          </p>
        </header>

        <div className="relative pb-[clamp(48px,8vw,96px)]">
          {/* Faint inactive conduit — always fully visible, the resting
              state of the line. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-0 bottom-0 w-px bg-surface-border md:left-1/2 md:-translate-x-1/2"
          />

          {/* Illuminated progress conduit — fills downward with scroll
              progress through this section. transformOrigin: top + scaleY
              (not height) keeps this a compositor-only transform. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-0 bottom-0 w-px origin-top md:left-1/2 md:-translate-x-1/2"
            style={{
              scaleY: progress,
              background:
                "linear-gradient(180deg, var(--color-accent-cyan), var(--color-accent-blue), var(--color-accent-violet), var(--color-accent-magenta))",
              boxShadow: "0 0 14px -2px var(--color-accent-cyan)",
            }}
          />

          <ol
            ref={listRef}
            className="relative flex flex-col gap-16 md:gap-24"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {PIPELINE.map((stage, index) => {
              const StageIcon = stage.icon;
              const isLeft = index % 2 === 0;
              const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

              return (
                <motion.li
                  key={stage.label}
                  className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] md:gap-x-8"
                  initial="inactive"
                  whileInView="active"
                  viewport={{ once: true, amount: 0.4 }}
                >
                  {/* Node — sits on the conduit, one per stage. */}
                  <div className="relative col-start-1 flex items-center justify-center md:col-start-2">
                    <motion.span
                      aria-hidden="true"
                      variants={nodeVariants}
                      className="relative z-10 block size-3 rounded-full border border-white/50"
                      style={{ background: accent, boxShadow: `0 0 14px 2px ${accent}` }}
                    />
                  </div>

                  {/* Card — alternates sides on desktop, always the second
                      column on mobile. Plain positioning div: text and
                      image reveal independently below, not as one block. */}
                  <div
                    className={cn(
                      "relative col-start-2 flex flex-col gap-4",
                      isLeft ? "md:col-start-1" : "md:col-start-3",
                    )}
                  >
                    {/* Local glow — broad, low-opacity, tinted with this
                        step's accent. Sized/positioned relative to the card
                        box itself (not the viewport) so the section's own
                        overflow-hidden always keeps it from causing
                        horizontal scroll. Hidden below md, same as the
                        section-level overlay, per the mobile "one wash + one
                        texture" budget. */}
                    <motion.div
                      aria-hidden="true"
                      variants={glowVariants}
                      className={cn(
                        "pointer-events-none absolute top-1/2 hidden h-[28rem] w-[28rem] -translate-y-1/2 rounded-full md:block",
                        isLeft ? "left-[-6rem]" : "right-[-6rem]",
                      )}
                      style={{
                        background: `radial-gradient(circle, color-mix(in oklab, ${accent} 28%, transparent) 0%, transparent 70%)`,
                      }}
                    />

                    {/* Branch — connects this card back to its node. */}
                    <motion.span
                      aria-hidden="true"
                      variants={branchVariants}
                      className={cn(
                        "pointer-events-none absolute top-1/2 right-full h-px w-4 -translate-y-1/2 md:w-8",
                        isLeft && "md:left-full md:right-auto",
                      )}
                      style={{ background: accent }}
                    />

                    <motion.div variants={textVariants} className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-badge-brand-bg text-badge-brand-text">
                          <StageIcon className="size-5" aria-hidden="true" />
                        </span>

                        <span
                          className="text-sm font-semibold uppercase text-brand"
                          style={{ letterSpacing: "0.16em" }}
                        >
                          Step {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <h3
                        className="text-foreground"
                        style={{
                          width: "100%",
                          maxWidth: "560px",
                          fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                          lineHeight: 1.15,
                        }}
                      >
                        {stage.label}
                      </h3>

                      <p
                        className="leading-relaxed text-muted-foreground"
                        style={{
                          width: "100%",
                          maxWidth: "520px",
                        }}
                      >
                        {stage.description}
                      </p>
                    </motion.div>

                    <motion.div
                      variants={imageVariants}
                      className="relative mt-2 w-full overflow-hidden rounded-xl border border-surface-border"
                      style={{ aspectRatio: "21 / 9" }}
                    >
                      <Image
                        src={stage.image}
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        loading={index === 0 ? undefined : "lazy"}
                        priority={index === 0}
                        className="object-cover"
                      />

                      <div
                        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
                        aria-hidden="true"
                      />
                    </motion.div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
}
