import { Badge, Container, ScrollReveal, Section } from "@repo/ui";
import { MediaBackground } from "../../components/media/MediaBackground";
import { MEDIA_ASSETS } from "../../constants/media";

const TOURNAMENTS = ["VCT Americas", "VCT EMEA", "VCT Pacific", "VCT China", "Masters", "Champions"];

export function SupportedTournaments() {
  return (
    <Section className="relative overflow-hidden py-xl sm:py-2xl">
      <MediaBackground asset={MEDIA_ASSETS.dataStreamBackground} className="opacity-[0.06]" />
      <Container className="relative flex flex-col items-center gap-md text-center">
        <ScrollReveal>
          <p className="text-sm font-medium text-muted-foreground">
            Covering professional Tier-1 VALORANT
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.08} className="flex flex-wrap items-center justify-center gap-2xs">
          {TOURNAMENTS.map((tournament) => (
            <Badge key={tournament} tone="neutral">
              {tournament}
            </Badge>
          ))}
        </ScrollReveal>
      </Container>
    </Section>
  );
}
