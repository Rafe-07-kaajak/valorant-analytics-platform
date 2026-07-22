"use client";

import Image from "next/image";
import Link from "next/link";
import { buttonVariants, Card, cn, Container, ScrollReveal, Section } from "@repo/ui";
import { AmbientSectionBackground } from "../../components/effects/AmbientSectionBackground";
import { EnergyPulse } from "../../components/effects/EnergyPulse";
import { usePointerGlow } from "../../hooks/usePointerGlow";

export function FinalCta() {
  const glow = usePointerGlow<HTMLDivElement>();

  return (
    <Section data-theme="dark" className="relative">
      {/* Forces the whole section (not just the card) dark, regardless of
          the ambient page theme, so the area around the card and the
          footer immediately below it read as one continuous dark zone
          instead of a dark card floating on a light section in light mode. */}
      <div className="pointer-events-none absolute inset-0 bg-background" aria-hidden="true" />

      {/* Minimal ambient support only — a single restrained radial wash
          behind the card, never a raster layer, so the CTA artwork inside
          the Card stays the unobstructed focal point. */}
      <AmbientSectionBackground
        wash="radial-gradient(60% 70% at 50% 45%, color-mix(in oklab, var(--team-a) 16%, transparent) 0%, transparent 70%)"
        fade={false}
      />

      <Container className="relative">
        <ScrollReveal>
          <Card
            onPointerEnter={glow.onPointerEnter}
            onPointerMove={glow.onPointerMove}
            onPointerLeave={glow.onPointerLeave}
            className="pointer-glow relative flex flex-col items-center gap-md overflow-hidden py-2xl text-center"
          >
            <div className="absolute inset-0 md:hidden" aria-hidden="true">
              <Image
                src="/assets/redesign/cta/landing-final-cta-mobile.png"
                alt=""
                fill
                sizes="100vw"
                loading="lazy"
                className="object-cover"
              />
            </div>

            <div className="absolute inset-0 hidden md:block" aria-hidden="true">
              <Image
                src="/assets/redesign/cta/landing-final-cta.png"
                alt=""
                fill
                sizes="100vw"
                loading="lazy"
                className="object-cover"
              />
            </div>

            <div className="pointer-events-none absolute inset-0 bg-background/70" aria-hidden="true" />
            <EnergyPulse />
            <h2 className="relative text-foreground">
              Pick two teams. See the reasoning, not just the result.
            </h2>
            <p className="relative max-w-(--breakpoint-sm) text-lg text-muted-foreground">
              Prediction Studio is free to explore. No account required.
            </p>
            <Link href="/prediction-studio" className={cn(buttonVariants({ size: "lg" }), "relative")}>
              Open Prediction Studio
            </Link>
          </Card>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
