import { cn } from "@repo/ui";

/**
 * Effect 26 — a subtle animated grain + scanline layer, evoking the HUD
 * texture in the asset library's tactical-analysis renders. Pure CSS
 * (SVG-noise data URI + repeating-gradient scanlines); no JS, no canvas.
 * Disabled under prefers-reduced-motion via .animate-* in effects.css.
 */
export function HolographicNoiseOverlay({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div
        className="animate-noise-flicker absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        className="animate-scanline-drift absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--team-a) 0, var(--team-a) 1px, transparent 1px, transparent 4px)",
        }}
      />
    </div>
  );
}
