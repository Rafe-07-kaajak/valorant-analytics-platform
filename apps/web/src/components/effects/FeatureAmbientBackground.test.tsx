/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FeatureAmbientBackground } from "./FeatureAmbientBackground";
import { AMBIENT_VIDEO_LOOP_CONFIG } from "../../constants/ambientVideoLoopConfig";
import { MEDIA_ASSETS } from "../../constants/media";

/**
 * framer-motion's real `useReducedMotion` reads `window.matchMedia` through a
 * module-level singleton that's only ever initialized once per process (see
 * `framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs`) — a
 * `matchMedia` mock set up in one test has no effect on a later test in the
 * same file. Mocking the module directly gives each test real per-test
 * control, and covers both this component's own call and `MediaBackground`'s
 * (which imports the same hook from the same module).
 */
let reducedMotion = false;
vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion,
}));

beforeEach(() => {
  reducedMotion = false;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FeatureAmbientBackground — background-video refinement task", () => {
  it("mounts exactly one video element per feature background, never two", () => {
    const { container } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });

  it("Prediction Studio's replaced video mounts at normal (1x) playback rate, with no slow-motion override remaining", () => {
    const { container } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.playbackRate).toBe(1);
  });

  it.each([
    ["comparisonLab", MEDIA_ASSETS.comparisonLabAmbientVideo, "var(--gradient-comparison-lab-video-tint)"],
    ["mapExplorer", MEDIA_ASSETS.mapExplorerAmbientVideo, "var(--gradient-map-explorer-video-tint)"],
    ["powerRankings", MEDIA_ASSETS.powerRankingsAmbientVideo, "var(--gradient-power-rankings-video-tint)"],
  ] as const)("%s keeps normal (1x) playback speed", (featureKey, asset, tint) => {
    const { container } = render(
      <FeatureAmbientBackground video={asset} tint={tint} loop={AMBIENT_VIDEO_LOOP_CONFIG[featureKey]} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.playbackRate).toBe(1);
  });

  it("applies the restrained drift class for Prediction Studio and the normal drift class for the other three", () => {
    const { container: predictionStudio } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    expect(predictionStudio.querySelector("video")?.className).toContain("md:animate-video-drift-restrained");
    cleanup();

    const { container: powerRankings } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.powerRankingsAmbientVideo}
        tint="var(--gradient-power-rankings-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.powerRankings}
      />,
    );
    const rankingsVideoClass = powerRankings.querySelector("video")?.className ?? "";
    expect(rankingsVideoClass).toContain("md:animate-video-drift");
    expect(rankingsVideoClass).not.toContain("md:animate-video-drift-restrained");
  });

  it("under prefers-reduced-motion, never mounts a video (no autoplay, no loop-seam logic, no drift)", () => {
    reducedMotion = true;
    const { container } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    expect(container.querySelectorAll("video")).toHaveLength(0);
  });

  it("under prefers-reduced-motion, still renders the scrim and tint layers so the page keeps its feature identity", () => {
    reducedMotion = true;
    const { container } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    const tintLayer = Array.from(container.querySelectorAll("div")).find(
      (el) => el.style.backgroundImage === "var(--gradient-prediction-studio-video-tint)",
    );
    expect(tintLayer).toBeTruthy();
  });

  it("the video layer is non-interactive and non-focusable, and the whole root is hidden from the accessibility tree", () => {
    const { container } = render(
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.predictionStudioAmbientVideo}
        tint="var(--gradient-prediction-studio-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.className).toContain("pointer-events-none");

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video.tabIndex).toBe(-1);
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
  });
});
