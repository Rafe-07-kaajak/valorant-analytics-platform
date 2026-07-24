"use client";

import { useEffect, useRef } from "react";
import type { AmbientVideoLoopConfig } from "../constants/ambientVideoLoopConfig";

/**
 * Background-video refinement task — drives one `<video>` element's
 * seamless-loop behavior: real `playbackRate` (never a CSS animation-
 * duration trick), and a reset-to-`loopStart` transition instead of relying
 * on the native `loop` attribute, since these ambient clips have no
 * authored loop point (see `constants/ambientVideoLoopConfig.ts`).
 *
 * Sequence per loop, entirely via direct DOM writes (no React re-render —
 * this can fire every few seconds, and the video element is the only thing
 * that ever needs to change): shortly before `loopEnd`, fade the video
 * layer's own opacity/filter down to `transitionOpacity` over half of
 * `transitionDurationMs`; once fully dimmed, seek to `loopStart` (invisible
 * at that opacity, so a decoder hiccup on the seek is never seen); fade
 * back up to `baseOpacity` over the second half. Nothing else on the page —
 * scrim, tint, vignette, foreground content — is touched.
 *
 * Monitoring prefers `requestVideoFrameCallback` (fires once per actually
 * decoded frame, the most efficient way to watch `currentTime`) and falls
 * back to `timeupdate` in browsers without it (Safari, jsdom). Neither is a
 * global `requestAnimationFrame` loop: both are scoped to this one video
 * element and stop the moment it's paused, backgrounded, or unmounted.
 *
 * The native `loop` attribute is left on as a defensive fallback (never the
 * primary mechanism) — if `loopEnd`/`loopStart` turn out invalid or the
 * clip's metadata never resolves a usable duration, playback still loops
 * instead of stopping dead, just without the masked transition.
 */
export function useSeamlessVideoLoop(config: AmbientVideoLoopConfig) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let resolvedLoopStart = config.loopStart;
    let resolvedLoopEnd = config.loopEnd;
    let customLoopEnabled = false;
    let dimmed = false;
    let triggeredForCurrentApproach = false;
    let frameHandle: number | null = null;
    let seekTimeoutHandle: number | null = null;

    const halfTransitionMs = config.transitionDurationMs / 2;
    const halfTransitionSeconds = halfTransitionMs / 1000;

    video.playbackRate = config.playbackRate;
    video.style.opacity = String(config.baseOpacity);
    video.style.transitionProperty = "opacity, filter";
    video.style.transitionDuration = `${halfTransitionMs}ms`;
    video.style.transitionTimingFunction = "ease";

    function setDimmed(next: boolean) {
      if (dimmed === next) return;
      dimmed = next;
      video!.style.opacity = String(next ? config.transitionOpacity : config.baseOpacity);
      video!.style.filter = next && config.transitionBlurPx ? `blur(${config.transitionBlurPx}px)` : "";
    }

    /** Missing/invalid metadata (duration not yet known, or a misconfigured/too-short segment) falls back to the native `loop` attribute rather than running the masked transition against bad numbers. */
    function resolveLoopBounds() {
      const duration = video!.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        customLoopEnabled = false;
        return;
      }
      const durationMargin = 0.05;
      const minSegmentSeconds = halfTransitionSeconds * 2 + 0.5;
      let start = Math.max(0, config.loopStart);
      let end = config.loopEnd > 0 ? Math.min(config.loopEnd, duration - durationMargin) : duration - durationMargin;

      if (!(end > start) || end - start < minSegmentSeconds) {
        start = 0;
        end = duration;
        customLoopEnabled = false;
      } else {
        customLoopEnabled = true;
      }
      resolvedLoopStart = start;
      resolvedLoopEnd = end;
    }

    function checkLoopBoundary() {
      if (!customLoopEnabled) return;
      const distanceToEnd = resolvedLoopEnd - video!.currentTime;
      if (!triggeredForCurrentApproach && distanceToEnd <= halfTransitionSeconds && distanceToEnd >= -1) {
        triggeredForCurrentApproach = true;
        setDimmed(true);
        seekTimeoutHandle = window.setTimeout(() => {
          if (cancelled || !videoRef.current) return;
          videoRef.current.currentTime = resolvedLoopStart;
          setDimmed(false);
        }, halfTransitionMs);
      } else if (distanceToEnd > halfTransitionSeconds) {
        // Reset once safely back inside the loop body, so the next approach to loopEnd can trigger again.
        triggeredForCurrentApproach = false;
      }
    }

    function onLoadedMetadata() {
      resolveLoopBounds();
    }

    function onTimeUpdate() {
      checkLoopBoundary();
    }

    function onVideoFrame() {
      if (cancelled) return;
      checkLoopBoundary();
      if (typeof video!.requestVideoFrameCallback === "function") {
        frameHandle = video!.requestVideoFrameCallback(onVideoFrame);
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        video!.pause();
      } else {
        video!.play().catch(() => {
          // Autoplay can be rejected by the browser after certain focus/permission
          // changes — this is decorative background media, so a rejected resume
          // just leaves the last painted frame in place rather than surfacing an error.
        });
      }
    }

    if (video.readyState >= 1) resolveLoopBounds();
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const supportsFrameCallback = typeof video.requestVideoFrameCallback === "function";
    if (supportsFrameCallback) {
      frameHandle = video.requestVideoFrameCallback(onVideoFrame);
    } else {
      video.addEventListener("timeupdate", onTimeUpdate);
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (seekTimeoutHandle !== null) window.clearTimeout(seekTimeoutHandle);
      if (frameHandle !== null && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameHandle);
      }
    };
  }, [config]);

  return videoRef;
}
