import type { Metadata } from "next";
import {
  AnimatedGradient,
  Badge,
  Card,
  Container,
  ImageMaskReveal,
  ParallaxLayer,
  ScrollProgress,
  ScrollReveal,
  Section,
  StaggerGroup,
  StaggerItem,
  TextLineReveal,
} from "@repo/ui";
import { CardSpotlight } from "../../../components/effects/CardSpotlight";
import { MotionNumberDemo } from "../../../features/motion-showcase/MotionNumberDemo";
import { StickyStoryDemo } from "../../../features/motion-showcase/StickyStoryDemo";

export const metadata: Metadata = {
  title: "Motion System Showcase (internal)",
  description: "TASK-051 developer showcase for the reusable motion and scroll-interaction primitives.",
  robots: { index: false, follow: false },
};

const STAGGER_ITEMS = ["Aggression", "Consistency", "Adaptability", "Clutch Factor", "Utility Usage", "Map Pool"];

export default function MotionShowcasePage() {
  return (
    <div className="pb-3xl">
      <div className="sticky top-0 z-10">
        <ScrollProgress label="Motion showcase scroll progress" className="bg-surface-border" />
      </div>

      <Container className="flex flex-col gap-2xs pt-2xl">
        <Badge tone="brand">Internal, not indexed, not linked from navigation</Badge>
        <h1>Motion System Showcase</h1>
        <p className="max-w-(--breakpoint-md) text-muted-foreground">
          TASK-051 developer reference for the reusable motion and scroll-interaction primitives in{" "}
          <code>@repo/ui</code>. This route demonstrates the system in isolation; it is not a redesign of any
          production page. See docs/39-motion-engine-and-scroll-primitives.md for the full catalog.
        </p>
      </Container>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>ScrollReveal</h2>
          <p className="text-muted-foreground">Opacity + transform entrance, one direction per card below.</p>
          {/* overflow-hidden: the "left"/"right" cards' hidden-state transform
              can sit slightly past a narrow viewport's edge before it enters
              view; clipping it here keeps that transient state from ever
              contributing to page-level horizontal scroll, the same
              "bounded movement" rule ParallaxLayer documents. */}
          <div className="grid grid-cols-1 gap-md overflow-hidden sm:grid-cols-4">
            {(["up", "down", "left", "right"] as const).map((direction) => (
              <ScrollReveal key={direction} direction={direction}>
                <Card className="flex h-24 items-center justify-center capitalize">{direction}</Card>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>StaggerGroup</h2>
          <p className="text-muted-foreground">Deterministic, index-ordered reveal, no random delay.</p>
          <StaggerGroup className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            {STAGGER_ITEMS.map((item) => (
              <StaggerItem key={item}>
                <Card className="flex h-16 items-center justify-center text-center">{item}</Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>ParallaxLayer</h2>
          <p className="text-muted-foreground">
            Bounded transform-only drift, three layers at different speeds. Disabled below 768px and under reduced
            motion.
          </p>
          <div className="relative h-64 overflow-hidden rounded-lg border border-surface-border">
            <ParallaxLayer speed={0.1} className="absolute inset-x-0 top-4">
              <div className="mx-auto h-16 w-3/4 rounded-md bg-[image:var(--gradient-cyan-blue)]" />
            </ParallaxLayer>
            <ParallaxLayer speed={0.3} className="absolute inset-x-0 top-24">
              <div className="mx-auto h-16 w-1/2 rounded-md bg-[image:var(--gradient-blue-violet)]" />
            </ParallaxLayer>
            <ParallaxLayer speed={-0.2} className="absolute inset-x-0 top-44">
              <div className="mx-auto h-16 w-2/3 rounded-md bg-[image:var(--gradient-coral-amber)]" />
            </ParallaxLayer>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>TextLineReveal</h2>
          <TextLineReveal
            as="p"
            text="Every word animates in on its own, and a screen reader still hears this sentence exactly once."
            className="text-heading-md"
          />
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>ImageMaskReveal</h2>
          <p className="text-muted-foreground">
            A covering panel translates away (transform, not clip-path) to reveal the content beneath. A CSS
            placeholder stands in for a next/image asset here.
          </p>
          <ImageMaskReveal className="h-48 w-full max-w-md rounded-lg">
            <div className="size-full bg-[image:var(--gradient-violet-magenta)]" role="img" aria-label="Placeholder reveal content" />
          </ImageMaskReveal>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>CardSpotlight</h2>
          <p className="text-muted-foreground">
            Consolidates TASK-034&apos;s existing card-local pointer glow into a reusable wrapper. Visible on
            fine-pointer, hover-capable devices only.
          </p>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <CardSpotlight className="rounded-lg border border-surface-border bg-surface p-md">
              Default brand tint
            </CardSpotlight>
            <CardSpotlight
              className="rounded-lg border border-surface-border bg-surface p-md"
              spotlightColor="color-mix(in oklab, var(--team-a) 20%, transparent)"
            >
              Team A tint
            </CardSpotlight>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>AnimatedGradient</h2>
          <p className="text-muted-foreground">Restrained, token-based, CSS-driven background drift.</p>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <AnimatedGradient variant="mesh" className="h-32 rounded-lg" />
            <AnimatedGradient variant="cyanBlue" className="h-32 rounded-lg" />
            <AnimatedGradient variant="violetMagenta" className="h-32 rounded-lg" />
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>MotionNumber</h2>
          <p className="text-muted-foreground">
            Deterministic tween between the previous and next value on prop change, not a random count-up.
          </p>
          <MotionNumberDemo />
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-lg">
          <h2>StickyStory</h2>
          <p className="text-muted-foreground">
            Renders stacked below 768px or under reduced motion; sticky two-column layout otherwise. Resize the
            viewport or enable reduced motion to see the fallback.
          </p>
          <StickyStoryDemo />
        </Container>
      </Section>
    </div>
  );
}
