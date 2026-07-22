import { cn } from "@repo/ui";

export interface AmbientTextureLayer {
  src: string;
  /** Decorative opacity — 0.04-0.07 for lighter sections, 0.05-0.07 for ProductStory's pipeline. */
  opacity: number;
  /** "tile" repeats the pattern (tactical-grid, blueprint-contours); "cover" fills the section (data-streams). Defaults to "tile". */
  size?: "tile" | "cover";
}

export interface AmbientOverlayLayer {
  src: string;
  opacity: number;
  /** Reuses the existing GPU-cheap drift keyframes from motion.css. */
  drift?: "slow" | "slower";
}

export interface AmbientSectionBackgroundProps {
  /** A CSS `background-image` value — typically one of the `--gradient-*` tokens in gradients.css. */
  wash?: string;
  texture?: AmbientTextureLayer;
  /** Large, soft, off-center art (node-network, radial-rings, chromatic-haze). Hidden below `md` to keep mobile to a base wash + texture only. */
  overlay?: AmbientOverlayLayer;
  /** Vertical vignette seaming this section's decorative layers back into the flat page background at the top/bottom edges. Default true. */
  fade?: boolean;
  className?: string;
}

/**
 * TASK-054 — shared ambient background layers for landing sections that
 * would otherwise read as flat black rectangles. Renders, bottom to top: an
 * optional color wash, an optional tiled/cover texture, an optional
 * drifting overlay (desktop/tablet only), and an optional edge fade. Every
 * layer is `pointer-events-none`/`aria-hidden` and painted with plain CSS
 * backgrounds (no next/image, no JS), matching the pattern already used for
 * the pipeline/features textures this component replaces.
 */
export function AmbientSectionBackground({
  wash,
  texture,
  overlay,
  fade = true,
  className,
}: AmbientSectionBackgroundProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {wash ? <div className="absolute inset-0" style={{ backgroundImage: wash }} /> : null}

      {texture ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${texture.src}')`,
            backgroundRepeat: texture.size === "cover" ? "no-repeat" : "repeat",
            backgroundSize: texture.size === "cover" ? "cover" : undefined,
            backgroundPosition: texture.size === "cover" ? "center" : undefined,
            opacity: texture.opacity,
          }}
        />
      ) : null}

      {overlay ? (
        <div
          className={cn("absolute inset-0 hidden md:block", overlay.drift === "slower" ? "animate-drift-slower" : "animate-drift-slow")}
          style={{
            backgroundImage: `url('${overlay.src}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: overlay.opacity,
          }}
        />
      ) : null}

      {/* Edge vignette only — opaque background right at the top/bottom
          seams so this section blends into its neighbors, fully transparent
          through the middle 80% so it never washes out the wash/texture/
          overlay layers above. The previous `via-background/96` stop kept
          the whole section >=96% opaque black end to end, which is what was
          silently cancelling every layer below it. */}
      {fade ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, var(--background) 0%, transparent 12%, transparent 88%, var(--background) 100%)",
          }}
        />
      ) : null}
    </div>
  );
}
