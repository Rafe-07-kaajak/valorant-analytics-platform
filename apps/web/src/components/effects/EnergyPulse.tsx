import { cn } from "@repo/ui";

/**
 * Effect 27 — a soft pulsing glow ring, used to draw attention to a primary
 * action. Pure CSS (radial-gradient rings animated on transform/opacity —
 * GPU-cheap). Disabled under prefers-reduced-motion via effects.css.
 */
export function EnergyPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
      aria-hidden="true"
    >
      <span
        className="animate-energy-pulse absolute size-3/4 rounded-full"
        style={{
          background: "radial-gradient(circle, color-mix(in oklab, var(--team-a) 35%, transparent) 0%, transparent 70%)",
        }}
      />
      <span
        className="animate-energy-pulse absolute size-1/2 rounded-full [animation-delay:0.8s]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-accent-violet) 30%, transparent) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
