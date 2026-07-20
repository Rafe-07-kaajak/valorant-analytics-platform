import { cn } from "../../lib/cn";

export type AnimatedGradientVariant = "cyanBlue" | "blueViolet" | "violetMagenta" | "coralAmber" | "mesh";

const variantClasses: Record<AnimatedGradientVariant, string> = {
  cyanBlue: "bg-[image:var(--gradient-cyan-blue)]",
  blueViolet: "bg-[image:var(--gradient-blue-violet)]",
  violetMagenta: "bg-[image:var(--gradient-violet-magenta)]",
  coralAmber: "bg-[image:var(--gradient-coral-amber)]",
  mesh: "bg-[image:var(--gradient-mesh-subtle)]",
};

export interface AnimatedGradientProps {
  /** Which token-based gradient to render. Defaults to "mesh" (the low-alpha ambient wash). */
  variant?: AnimatedGradientVariant;
  className?: string;
  /** Render without the drift animation, e.g. for a static preview or a print/export context. Defaults to false. */
  static?: boolean;
}

/**
 * TASK-051 — restrained, token-based ambient gradient surface. No new color
 * values: every variant reads one of the `--gradient-*` custom properties
 * `apps/web/src/styles/gradients.css` already declares (TASK-050), all of
 * which stay low-alpha by design. Server component — the drift animation is
 * a plain CSS `@keyframes` (`.motion-gradient-drift` in gradients.css), not
 * a Framer Motion loop, so this needs no client-side JS of its own.
 * Decorative only (`aria-hidden`).
 */
export function AnimatedGradient({ variant = "mesh", className, static: isStatic = false }: AnimatedGradientProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(variantClasses[variant], !isStatic && "motion-gradient-drift", className)}
    />
  );
}
