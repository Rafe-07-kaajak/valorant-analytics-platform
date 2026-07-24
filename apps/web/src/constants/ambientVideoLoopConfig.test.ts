import { describe, expect, it } from "vitest";
import { AMBIENT_VIDEO_LOOP_CONFIG } from "./ambientVideoLoopConfig";

describe("AMBIENT_VIDEO_LOOP_CONFIG — background-video refinement task", () => {
  it("Prediction Studio's replaced source plays at normal (1x) speed, with no slow-motion override remaining", () => {
    expect(AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio.playbackRate).toBe(1);
  });

  it("keeps Comparison Lab, Map Explorer, and Power Rankings at normal (1x) speed", () => {
    expect(AMBIENT_VIDEO_LOOP_CONFIG.comparisonLab.playbackRate).toBe(1);
    expect(AMBIENT_VIDEO_LOOP_CONFIG.mapExplorer.playbackRate).toBe(1);
    expect(AMBIENT_VIDEO_LOOP_CONFIG.powerRankings.playbackRate).toBe(1);
  });

  it("every configured loop segment is well-formed: loopEnd strictly after loopStart, both non-negative", () => {
    for (const config of Object.values(AMBIENT_VIDEO_LOOP_CONFIG)) {
      expect(config.loopStart).toBeGreaterThanOrEqual(0);
      expect(config.loopEnd).toBeGreaterThan(config.loopStart);
    }
  });

  it("keeps every transition duration within the 800-1200ms design target", () => {
    for (const config of Object.values(AMBIENT_VIDEO_LOOP_CONFIG)) {
      expect(config.transitionDurationMs).toBeGreaterThanOrEqual(800);
      expect(config.transitionDurationMs).toBeLessThanOrEqual(1200);
    }
  });

  it("only Prediction Studio uses the restrained drift variant", () => {
    expect(AMBIENT_VIDEO_LOOP_CONFIG.predictionStudio.drift).toBe("restrained");
    expect(AMBIENT_VIDEO_LOOP_CONFIG.comparisonLab.drift).toBe("normal");
    expect(AMBIENT_VIDEO_LOOP_CONFIG.mapExplorer.drift).toBe("normal");
    expect(AMBIENT_VIDEO_LOOP_CONFIG.powerRankings.drift).toBe("normal");
  });

  it("keeps every opacity value within the valid 0-1 range", () => {
    for (const config of Object.values(AMBIENT_VIDEO_LOOP_CONFIG)) {
      expect(config.baseOpacity).toBeGreaterThanOrEqual(0);
      expect(config.baseOpacity).toBeLessThanOrEqual(1);
      expect(config.transitionOpacity).toBeGreaterThanOrEqual(0);
      expect(config.transitionOpacity).toBeLessThanOrEqual(1);
    }
  });
});
