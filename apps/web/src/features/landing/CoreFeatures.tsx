"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Dna,
  Map,
  MessageSquareText,
  Target,
} from "lucide-react";
import { buttonVariants, Section } from "@repo/ui";
import { AmbientSectionBackground } from "../../components/effects/AmbientSectionBackground";

const FEATURES = [
  {
    icon: Target,
    eyebrow: "Prediction Studio",
    title: "Interactive Match Prediction",
    description:
      "Select two professional teams and generate a prediction with win probability, confidence, and supporting analysis.",
    image: "/assets/redesign/supporting/prediction-result-visual.png",
    href: "/prediction-studio",
  },
  {
    icon: Dna,
    eyebrow: "Team Intelligence",
    title: "Team DNA",
    description:
      "Long-term team characteristics such as aggression, consistency, adaptability, and clutch performance are combined into a readable competitive identity.",
    image: "/assets/redesign/supporting/comparison-profile-visual.png",
    href: "/team-comparison",
  },
  {
    icon: MessageSquareText,
    eyebrow: "Transparent Reasoning",
    title: "Explainable Predictions",
    description:
      "Every prediction includes the major factors behind it, ranked by how much each signal influenced the final result.",
    image: "/assets/redesign/supporting/historical-reconstruction-visual.png",
    href: "/prediction-studio",
  },
  {
    icon: Map,
    eyebrow: "Map Intelligence",
    title: "Interactive Data Visualization",
    description:
      "Complex analytical relationships are presented through tactical maps and visual systems designed to improve understanding rather than decorate a dashboard.",
    image: "/assets/redesign/supporting/map-hologram-visual.png",
    href: "/map-matchup",
  },
] as const;

export function CoreFeatures() {
  return (
    <Section className="relative overflow-hidden">
      <AmbientSectionBackground
        wash="var(--gradient-mesh-subtle)"
        texture={{ src: "/assets/redesign/textures/blueprint-contours.png", opacity: 0.025 }}
      />

      <div
        className="relative z-10"
        style={{
          width: "100%",
          maxWidth: "1280px",
          marginInline: "auto",
          paddingInline: "clamp(16px, 4vw, 64px)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            maxWidth: "820px",
            flexDirection: "column",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <p
            className="text-sm font-semibold uppercase text-brand"
            style={{
              width: "100%",
              letterSpacing: "0.18em",
            }}
          >
            Core analytical systems
          </p>

          <h2
            style={{
              width: "100%",
              maxWidth: "780px",
            }}
          >
            Built around a small set of carefully designed features.
          </h2>

          <p
            className="text-lg leading-relaxed text-muted-foreground"
            style={{
              width: "100%",
              maxWidth: "700px",
            }}
          >
            Each tool turns competitive data into a focused analytical experience, from
            matchup prediction and team identity to tactical map understanding.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            width: "100%",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
            gap: "24px",
          }}
        >
          {FEATURES.map((feature) => {
            const FeatureIcon = feature.icon;

            return (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-surface-border bg-surface"
                style={{
                  display: "flex",
                  width: "100%",
                  minWidth: 0,
                  flexDirection: "column",
                }}
              >
                <div
                  className="relative w-full overflow-hidden"
                  style={{
                    aspectRatio: "8 / 5",
                  }}
                >
                  <Image
                    src={feature.image}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />

                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"
                    aria-hidden="true"
                  />

                  <div
                    className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
                    aria-hidden="true"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    minWidth: 0,
                    flex: 1,
                    flexDirection: "column",
                    gap: "16px",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-badge-brand-bg text-badge-brand-text">
                      <FeatureIcon className="size-5" aria-hidden="true" />
                    </span>

                    <BarChart3
                      className="size-5 shrink-0 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      minWidth: 0,
                      flex: 1,
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase text-brand"
                      style={{
                        width: "100%",
                        letterSpacing: "0.14em",
                      }}
                    >
                      {feature.eyebrow}
                    </p>

                    <h3
                      className="text-xl font-semibold text-foreground"
                      style={{
                        width: "100%",
                      }}
                    >
                      {feature.title}
                    </h3>

                    <p
                      className="leading-relaxed text-muted-foreground"
                      style={{
                        width: "100%",
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      paddingTop: "8px",
                    }}
                  >
                    <Link
                      href={feature.href}
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      Explore feature
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
