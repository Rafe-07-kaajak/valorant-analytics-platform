/**
 * Background-video refinement task — per-feature tuning for
 * `FeatureAmbientBackground`'s seamless-loop system (see
 * `hooks/useSeamlessVideoLoop.ts`).
 *
 * All four source clips (`apps/web/public/assets/redesign/Background/*.mp4`)
 * are continuous ambient/particle footage with no authored loop point: the
 * native `loop` attribute alone produces a visible jump at the wrap
 * (composition, particle field, and camera drift all differ between the
 * first and last frame to varying degrees per clip). Each entry below is
 * tuned from direct frame-by-frame inspection of that specific file, not a
 * shared default — see the task's final report for the exact frames
 * compared.
 *
 * `loopStart`/`loopEnd` are in the *source* media's own seconds (the
 * `HTMLVideoElement.currentTime` timeline), unaffected by `playbackRate`.
 */

export interface AmbientVideoLoopConfig {
  /** Real `HTMLVideoElement.playbackRate` — never faked via CSS animation duration. */
  playbackRate: number;
  /** Seconds into the source clip where a loop iteration begins. */
  loopStart: number;
  /** Seconds into the source clip where a loop iteration ends and the reset-to-`loopStart` transition begins. */
  loopEnd: number;
  /** Total crossfade duration in ms (dim-out + seek + fade-back-in), split evenly. Target ~800-1200ms per the design brief. */
  transitionDurationMs: number;
  /** The video layer's normal resting opacity (0-1). */
  baseOpacity: number;
  /** The video layer's opacity at the trough of the loop transition (0-1) — low enough to hide the seek, never fully removing the layer via `display`. */
  transitionOpacity: number;
  /** Optional extra `filter: blur()` (px) applied only while dipped, for clips whose seam needs more masking than opacity alone provides. */
  transitionBlurPx?: number;
  /** CSS `object-position` for the cover crop. */
  objectPosition: string;
  /** Which restrained-vs-normal drift keyframe (`styles/motion.css`) to use — kept separate from numeric fields since it selects a CSS class, not a value. */
  drift: "restrained" | "normal";
}

export const AMBIENT_VIDEO_LOOP_CONFIG = {
  // Source clip replaced (the previous 5.21s fluid-sim clip's timing/masking
  // no longer applies) — independently re-inspected at its own 10.03s
  // duration: floating embers/particles over a static lens-flare-lit
  // backdrop, whose flare position and particle density are already close
  // between first and last frame, so only a light dip is needed. Runs at
  // normal (1x) speed — the previous slow-motion override was specific to
  // the old, busier fluid-sim footage and doesn't apply to this content.
  predictionStudio: {
    playbackRate: 1,
    loopStart: 0.05,
    loopEnd: 9.93,
    transitionDurationMs: 900,
    baseOpacity: 0.3,
    transitionOpacity: 0.05,
    objectPosition: "center",
    drift: "restrained",
  },
  // Floating embers/particles over a static lens-flare-lit backdrop — the
  // flare position and particle density are already close between the
  // first and last frame, so only a light dip is needed.
  comparisonLab: {
    playbackRate: 1,
    loopStart: 0.05,
    loopEnd: 9.93,
    transitionDurationMs: 900,
    baseOpacity: 0.3,
    transitionOpacity: 0.05,
    objectPosition: "center",
    drift: "normal",
  },
  // Falling particles over a static vertical light-beam backdrop — the
  // backdrop is essentially fixed, only the falling particles' exact
  // positions differ at the wrap, which reads as ordinary continuous
  // "snowfall" rather than a cut.
  mapExplorer: {
    playbackRate: 1,
    loopStart: 0.05,
    loopEnd: 7.87,
    transitionDurationMs: 900,
    baseOpacity: 0.3,
    transitionOpacity: 0.05,
    objectPosition: "center",
    drift: "normal",
  },
  // Slow bokeh particle field — first and last frame are visually almost
  // identical (nearest to a naturally seamless loop of the four), so the
  // dip only needs to be a light safety margin.
  powerRankings: {
    playbackRate: 1,
    loopStart: 0.05,
    loopEnd: 14.9,
    transitionDurationMs: 800,
    baseOpacity: 0.3,
    transitionOpacity: 0.1,
    objectPosition: "center",
    drift: "normal",
  },
} as const satisfies Record<string, AmbientVideoLoopConfig>;

export type AmbientVideoLoopFeature = keyof typeof AMBIENT_VIDEO_LOOP_CONFIG;
