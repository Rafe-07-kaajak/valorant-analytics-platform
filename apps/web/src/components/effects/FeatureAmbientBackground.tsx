"use client";

import { useReducedMotion } from "framer-motion";
import { MediaBackground } from "../media/MediaBackground";
import { AmbientLoopVideo } from "../media/AmbientLoopVideo";
import type { MediaAsset } from "../../constants/media";
import type { AmbientVideoLoopConfig } from "../../constants/ambientVideoLoopConfig";
import { cn } from "@repo/ui";

export interface FeatureAmbientBackgroundProps {
  /** The feature's ambient video loop (`MEDIA_ASSETS.*AmbientVideo`). */
  video: MediaAsset;
  /** Still image shown instead of the video when `prefers-reduced-motion` is on — also used as the `<video>`'s `poster`. Omit to fall back to the tint/scrim alone. */
  poster?: MediaAsset;
  /** A CSS `background-image` value — the feature's mood-tint gradient (one of the `--gradient-*-video-tint` tokens in `gradients.css`). */
  tint: string;
  /** Per-feature playback rate, loop segment, transition, opacity, and drift tuning — see `constants/ambientVideoLoopConfig.ts`. Not consulted under `prefers-reduced-motion` (no video mounts at all in that case). */
  loop: AmbientVideoLoopConfig;
  /** Renders a soft radial darkening at the viewport edges for cinematic depth. Default true. */
  vignette?: boolean;
  className?: string;
}

/**
 * Page-persistent ambient video backdrop for a feature route — real-video
 * counterpart to `AmbientSectionBackground` (which stays section-scoped for
 * the landing page and nested sections like Historical Replay). Each of the
 * four feature pages renders exactly one of these, once, as a sibling
 * *before* their own `<Section>` — never nested inside it.
 *
 * That placement is deliberate, not arbitrary: this component is
 * `position: fixed`, but every feature `<Section>` is `overflow-hidden` (for
 * its own decorative layers), and `overflow: hidden` on an ancestor clips a
 * `position: fixed` descendant's paint in every major browser regardless of
 * the fixed element's own containing block — a well-known CSS gotcha. Fixed
 * positioning is what makes the background feel persistent through a long
 * scroll: it never needs to be "tall enough" for the page, and it never
 * scrolls away, unlike an `absolute inset-0` layer sized to its parent.
 *
 * Layer stack, bottom to top, all inside one `pointer-events-none`,
 * `aria-hidden` root sunk to `z-index: -1` (so it reliably paints behind
 * the navbar and every route's content without depending on DOM order):
 * 1. The video itself, at low opacity (`loop.baseOpacity`) — ambient motion
 *    only, never foreground media. Under `prefers-reduced-motion`, no video
 *    mounts at all (no autoplay, no loop-seam logic, no drift): only a
 *    still poster if one is supplied, via `MediaBackground`, else this
 *    layer is simply absent and the scrim/tint/vignette below carry the
 *    page's identity alone.
 * 2. A flat dark scrim, always on. This is what keeps heading text and any
 *    other content that sits directly on the page background (not inside a
 *    solid-background `Card`) readable regardless of how bright a given
 *    frame of footage is.
 * 3. The feature's mood tint (a `--gradient-*-video-tint` token).
 * 4. An optional soft vignette for cinematic depth.
 *
 * Deliberately no full-viewport blur: forcing the compositor to
 * re-rasterize every frame of an always-playing video costs scroll
 * smoothness for a purely decorative effect the opacity/scrim/tint stack
 * already renders subtle without it. The loop transition's own optional
 * blur (`loop.transitionBlurPx`) is scoped to the `<video>` element alone
 * and only active for a fraction of a second per loop — see
 * `AmbientLoopVideo`/`useSeamlessVideoLoop`.
 */
export function FeatureAmbientBackground({ video, poster, tint, loop, vignette = true, className }: FeatureAmbientBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)} aria-hidden="true">
      <div className="absolute inset-0">
        {prefersReducedMotion ? (
          <MediaBackground asset={poster ?? video} poster={poster} scrim="none" objectPosition={loop.objectPosition} className="absolute inset-0" />
        ) : (
          <AmbientLoopVideo asset={video} config={loop} className="absolute inset-0" />
        )}
      </div>

      {/* Base darkening — always on, independent of the video layer above,
          so text sitting directly on the page background (not inside a
          card) stays readable no matter how bright the current frame is,
          and stays fully readable even during the video's own opacity dip. */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="absolute inset-0" style={{ backgroundImage: tint }} />

      {vignette ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center, transparent 45%, color-mix(in oklab, var(--background) 65%, transparent) 100%)",
          }}
        />
      ) : null}
    </div>
  );
}
