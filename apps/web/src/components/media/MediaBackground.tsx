"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { cn } from "@repo/ui";
import type { MediaAsset } from "../../constants/media";

export interface MediaBackgroundProps {
  asset: MediaAsset;
  /** A still image asset used as the video poster and the reduced-motion fallback. */
  poster?: MediaAsset;
  /** Above-the-fold placements should load eagerly instead of lazily. */
  priority?: boolean;
  /** Adds a gradient fade to the surface color, guaranteeing foreground text contrast. */
  scrim?: "bottom" | "full" | "none";
  /** CSS `object-position` for the cover-cropped video/image — lets a caller keep a source's most visually important area in frame when its aspect ratio doesn't match the container. Defaults to `"center"`, unchanged from every existing call site. */
  objectPosition?: string;
  className?: string;
}

/**
 * Full-bleed decorative image/video layer. Always non-interactive and
 * removed from the accessibility tree — none of the media assets carry
 * information the surrounding real content doesn't already provide.
 *
 * The caller supplies a positioning context (`relative overflow-hidden` for
 * a section-local fill, or `fixed inset-0` via `className` for a
 * page-persistent backdrop — see `FeatureAmbientBackground`); this
 * component's own root fills it with `absolute inset-0` by default,
 * overridable through `className` (Tailwind's position utilities are a
 * conflicting group, so a caller's own `fixed`/`inset-0` wins).
 */
export function MediaBackground({
  asset,
  poster,
  priority = false,
  scrim = "none",
  objectPosition = "center",
  className,
}: MediaBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const isVideo = asset.type === "video";
  const stillImage = isVideo ? poster : asset;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {isVideo && !prefersReducedMotion ? (
        <video
          className="size-full object-cover"
          style={{ objectPosition }}
          src={asset.path}
          poster={poster?.path}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "auto" : "metadata"}
        />
      ) : stillImage ? (
        <Image
          className="size-full object-cover"
          style={{ objectPosition }}
          src={stillImage.path}
          alt=""
          width={stillImage.width}
          height={stillImage.height}
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      ) : null}

      {scrim === "bottom" ? (
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
      ) : null}
      {scrim === "full" ? <div className="absolute inset-0 bg-background/70" /> : null}
    </div>
  );
}
