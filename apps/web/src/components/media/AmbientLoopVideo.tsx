"use client";

import { cn } from "@repo/ui";
import type { MediaAsset } from "../../constants/media";
import type { AmbientVideoLoopConfig } from "../../constants/ambientVideoLoopConfig";
import { useSeamlessVideoLoop } from "../../hooks/useSeamlessVideoLoop";

export interface AmbientLoopVideoProps {
  asset: MediaAsset;
  config: AmbientVideoLoopConfig;
  className?: string;
}

/**
 * Background-video refinement task — the seamless-looping counterpart to
 * `MediaBackground`'s plain `autoPlay loop` video, used only by
 * `FeatureAmbientBackground`'s four page-persistent feature backdrops.
 * Deliberately its own component rather than a `MediaBackground` change:
 * `MediaBackground` is also used by unrelated, unmanaged loops elsewhere
 * (`ResultTimeline`, `ResultHeader`, `RealPipelineTimeline`) that this task
 * must not affect.
 *
 * A restrained `scale`/`translate` drift (see `styles/motion.css`) is
 * applied via a plain CSS animation, not JS — Tailwind/tokens.css already
 * neutralizes every `@keyframes` animation under `prefers-reduced-motion`
 * globally, so no separate branch is needed here, matching this codebase's
 * existing `AnimatedGradient`/`AmbientSectionBackground` drift convention.
 * The drift class only applies at `md:` and above (mobile keeps the video
 * itself, just without the continuous transform animation, for lighter
 * mobile compositing) — same convention as `AmbientSectionBackground`'s own
 * drift layer.
 */
export function AmbientLoopVideo({ asset, config, className }: AmbientLoopVideoProps) {
  const videoRef = useSeamlessVideoLoop(config);

  return (
    <video
      ref={videoRef}
      className={cn(
        "size-full object-cover",
        config.drift === "restrained" ? "md:animate-video-drift-restrained" : "md:animate-video-drift",
        className,
      )}
      style={{ objectPosition: config.objectPosition }}
      src={asset.path}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
