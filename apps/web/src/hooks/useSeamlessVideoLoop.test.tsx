/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useSeamlessVideoLoop } from "./useSeamlessVideoLoop";
import type { AmbientVideoLoopConfig } from "../constants/ambientVideoLoopConfig";

/**
 * jsdom has no real media pipeline: `duration` defaults to `NaN` and
 * `currentTime` is a plain, unclamped read/write property with no actual
 * playback. Every test drives the hook by directly setting `currentTime`
 * and dispatching the same events a real browser would fire
 * (`loadedmetadata`, `timeupdate`) — `requestVideoFrameCallback` does not
 * exist in jsdom, so the hook always takes its `timeupdate` fallback path
 * here, which exercises the exact same `checkLoopBoundary` logic the
 * frame-callback path also calls.
 */
function baseConfig(overrides: Partial<AmbientVideoLoopConfig> = {}): AmbientVideoLoopConfig {
  return {
    playbackRate: 1,
    loopStart: 0.05,
    loopEnd: 9,
    transitionDurationMs: 1000,
    baseOpacity: 0.3,
    transitionOpacity: 0.05,
    objectPosition: "center",
    drift: "normal",
    ...overrides,
  };
}

function setDuration(video: HTMLVideoElement, duration: number) {
  Object.defineProperty(video, "duration", { value: duration, configurable: true });
}

function setCurrentTime(video: HTMLVideoElement, time: number) {
  Object.defineProperty(video, "currentTime", { value: time, configurable: true, writable: true });
}

function fireLoadedMetadata(video: HTMLVideoElement) {
  Object.defineProperty(video, "readyState", { value: 1, configurable: true });
  video.dispatchEvent(new Event("loadedmetadata"));
}

function fireTimeUpdate(video: HTMLVideoElement) {
  video.dispatchEvent(new Event("timeupdate"));
}

function Harness({ config }: { config: AmbientVideoLoopConfig }) {
  const videoRef = useSeamlessVideoLoop(config);
  return <video ref={videoRef} data-testid="probe-video" />;
}

/** Renders a real `<video ref={videoRef}>` via the actual hook, exactly like `AmbientLoopVideo` does. */
function setup(config: AmbientVideoLoopConfig) {
  const { unmount, getByTestId } = render(<Harness config={config} />);
  const video = getByTestId("probe-video") as HTMLVideoElement;
  return { video, unmount };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useSeamlessVideoLoop", () => {
  it("sets the real HTMLVideoElement.playbackRate from config, never a CSS trick", () => {
    const { video } = setup(baseConfig({ playbackRate: 0.55 }));
    expect(video.playbackRate).toBe(0.55);
  });

  it("keeps playbackRate at 1 for a config that doesn't request a slower rate", () => {
    const { video } = setup(baseConfig({ playbackRate: 1 }));
    expect(video.playbackRate).toBe(1);
  });

  it("seeks back to the configured loopStart once currentTime enters the transition window near loopEnd", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.2, loopEnd: 9, transitionDurationMs: 1000 });
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);

    setCurrentTime(video, 8.6); // 0.4s from loopEnd — inside the 0.5s (half of 1000ms) trigger window
    fireTimeUpdate(video);

    vi.advanceTimersByTime(600);
    expect(video.currentTime).toBe(0.2);
  });

  it("does not trigger the transition while currentTime is still far from loopEnd", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.2, loopEnd: 9, transitionDurationMs: 1000 });
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);

    setCurrentTime(video, 3);
    fireTimeUpdate(video);
    vi.advanceTimersByTime(2000);

    expect(video.currentTime).toBe(3);
  });

  it("dims only the video element's own opacity/filter during the loop transition, restoring baseOpacity after", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0, loopEnd: 9, transitionDurationMs: 1000, baseOpacity: 0.3, transitionOpacity: 0.02 });
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);
    expect(video.style.opacity).toBe("0.3");

    setCurrentTime(video, 8.6);
    fireTimeUpdate(video);
    expect(video.style.opacity).toBe("0.02");

    vi.advanceTimersByTime(600);
    expect(video.style.opacity).toBe("0.3");
  });

  it("never touches document body or any ancestor's opacity — only the video element itself", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0, loopEnd: 9, transitionDurationMs: 1000 });
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);

    setCurrentTime(video, 8.6);
    fireTimeUpdate(video);

    expect(document.body.style.opacity).toBe("");
    expect((video.parentElement as HTMLElement).style.opacity).toBe("");
  });

  it("does not re-trigger the transition repeatedly (no infinite seek loop) while currentTime sits inside the trigger window", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.2, loopEnd: 9, transitionDurationMs: 1000 });
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);

    setCurrentTime(video, 8.6);
    fireTimeUpdate(video);
    fireTimeUpdate(video); // still inside the window, before the scheduled seek fires
    fireTimeUpdate(video);
    vi.advanceTimersByTime(600); // seek to loopStart (0.2) happens here

    // currentTime is now 0.2 (far from loopEnd) — further timeupdate events must not seek again.
    fireTimeUpdate(video);
    fireTimeUpdate(video);
    expect(video.currentTime).toBe(0.2);
  });

  it("falls back to native looping (no custom transition) when duration never resolves to a finite number", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.2, loopEnd: 9, transitionDurationMs: 1000 });
    const { video } = setup(config);
    // duration left as NaN (default, unresolved metadata) — no loadedmetadata fired.
    setCurrentTime(video, 8.99);
    fireTimeUpdate(video);
    vi.advanceTimersByTime(2000);

    // No seek should have been scheduled: currentTime is left exactly as set.
    expect(video.currentTime).toBe(8.99);
  });

  it("falls back to native looping when the configured segment is too short for the transition", () => {
    vi.useFakeTimers();
    // transitionDurationMs 2000 needs >= 2.5s of segment; loopEnd-loopStart here is only 0.3s.
    const config = baseConfig({ loopStart: 0.1, loopEnd: 0.4, transitionDurationMs: 2000 });
    const { video } = setup(config);
    setDuration(video, 5);
    fireLoadedMetadata(video);

    setCurrentTime(video, 0.35);
    fireTimeUpdate(video);
    vi.advanceTimersByTime(3000);

    expect(video.currentTime).toBe(0.35);
  });

  it("clamps an out-of-range loopEnd to the resolved duration instead of seeking past the real clip end", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.1, loopEnd: 999, transitionDurationMs: 1000 });
    const { video } = setup(config);
    setDuration(video, 6);
    fireLoadedMetadata(video);

    setCurrentTime(video, 5.6); // within 0.5s of the clamped loopEnd (6 - 0.05 margin = 5.95)
    fireTimeUpdate(video);
    vi.advanceTimersByTime(600);

    expect(video.currentTime).toBe(0.1);
  });

  it("pauses on document hidden and resumes without jumping the current position", () => {
    const config = baseConfig();
    const { video } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);
    setCurrentTime(video, 4);

    const pauseSpy = vi.spyOn(video, "pause");
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    const playSpy = vi.spyOn(video, "play");
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(4);
  });

  it("removes every listener, timer, and scheduled seek on unmount", () => {
    vi.useFakeTimers();
    const config = baseConfig({ loopStart: 0.2, loopEnd: 9, transitionDurationMs: 1000 });
    const { video, unmount } = setup(config);
    setDuration(video, 9.5);
    fireLoadedMetadata(video);

    const removeEventListenerSpy = vi.spyOn(video, "removeEventListener");
    const removeDocListenerSpy = vi.spyOn(document, "removeEventListener");

    setCurrentTime(video, 8.6);
    fireTimeUpdate(video); // schedules the seek timeout

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("timeupdate", expect.any(Function));
    expect(removeDocListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    // The scheduled seek must never fire after unmount.
    vi.advanceTimersByTime(2000);
    expect(video.currentTime).toBe(8.6);
  });
});
