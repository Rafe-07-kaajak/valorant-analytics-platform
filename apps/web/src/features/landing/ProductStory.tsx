import Image from "next/image";
import {
  ArrowRight,
  Brain,
  Database,
  GitBranch,
  Layers,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { Section } from "@repo/ui";

const PIPELINE = [
  {
    label: "Raw Match Data",
    description: "Match results, rounds, maps, rosters, events, and competitive context.",
    icon: Database,
    image: "/assets/redesign/pipeline/pipeline-scene-01-raw-data.png",
  },
  {
    label: "Structured Features",
    description: "Raw records become consistent team, matchup, form, and map-level features.",
    icon: Layers,
    image: "/assets/redesign/pipeline/pipeline-scene-02-structured-features.png",
  },
  {
    label: "Analytical Knowledge",
    description: "Competitive patterns are converted into reusable analytical signals.",
    icon: Brain,
    image: "/assets/redesign/pipeline/pipeline-scene-03-analytical-knowledge.png",
  },
  {
    label: "Model Core",
    description: "The model combines historical evidence with the current matchup context.",
    icon: GitBranch,
    image: "/assets/redesign/pipeline/pipeline-scene-04-model-core.png",
  },
  {
    label: "Prediction Output",
    description: "The result includes probabilities, confidence, and the expected advantage.",
    icon: TrendingUp,
    image: "/assets/redesign/pipeline/pipeline-scene-05-prediction-output.png",
  },
  {
    label: "Explanation Network",
    description: "Every prediction is connected back to the factors that influenced it.",
    icon: MessageCircle,
    image: "/assets/redesign/pipeline/pipeline-scene-06-explanation-network.png",
  },
] as const;

export function ProductStory() {
  return (
    <Section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/assets/redesign/textures/tactical-grid.png')] bg-repeat opacity-[0.035]"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background"
        aria-hidden="true"
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
            maxWidth: "800px",
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
            From data to explanation
          </p>

          <h2
            style={{
              width: "100%",
              maxWidth: "760px",
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
            Most platforms tell you who won. Few explain why one team was favored, which
            factors mattered most, or how confident you should be in the result. This
            platform connects raw competitive data to a prediction through a transparent
            chain of reasoning.
          </p>
        </div>

        <ol
          style={{
            display: "grid",
            width: "100%",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
            gap: "24px",
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {PIPELINE.map((stage, index) => {
            const StageIcon = stage.icon;

            return (
              <li
                key={stage.label}
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
                    aspectRatio: "21 / 9",
                  }}
                >
                  <Image
                    src={stage.image}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 900px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />

                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/15 to-transparent"
                    aria-hidden="true"
                  />

                  <div
                    className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
                    aria-hidden="true"
                  />

                  <span
                    className="absolute left-4 top-4 flex items-center justify-center rounded-full border border-white/10 bg-background/75 text-xs font-semibold text-foreground backdrop-blur-sm"
                    style={{
                      minWidth: "42px",
                      height: "32px",
                      paddingInline: "10px",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    minWidth: 0,
                    flex: 1,
                    alignItems: "flex-start",
                    gap: "16px",
                    padding: "24px",
                  }}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-badge-brand-bg text-badge-brand-text">
                    <StageIcon className="size-5" aria-hidden="true" />
                  </span>

                  <div
                    style={{
                      display: "flex",
                      minWidth: 0,
                      flex: 1,
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <h3
                      className="text-lg font-semibold text-foreground"
                      style={{
                        width: "100%",
                      }}
                    >
                      {stage.label}
                    </h3>

                    <p
                      className="text-sm leading-relaxed text-muted-foreground"
                      style={{
                        width: "100%",
                      }}
                    >
                      {stage.description}
                    </p>
                  </div>

                  {index < PIPELINE.length - 1 ? (
                    <ArrowRight
                      className="mt-1 hidden size-5 shrink-0 text-muted-foreground lg:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}