import { FloatingGlassObjects } from "../../components/effects/FloatingGlassObjects";
import { HolographicNoiseOverlay } from "../../components/effects/HolographicNoiseOverlay";

export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--surface-border)_1px,transparent_0)] [background-size:32px_32px] opacity-40" />
      <FloatingGlassObjects />
      <HolographicNoiseOverlay />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
