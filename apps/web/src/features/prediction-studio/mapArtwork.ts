/**
 * TASK-055 — per-map tile artwork for the Prediction Studio map pool.
 * `GameMap` (`@repo/prediction-engine` / `@repo/shared`) stays `{id, name}`
 * only — it's a domain type shared with the prediction engine, not a UI
 * concern. This lookup is the UI-only bridge from a map id to its artwork
 * in `public/assets/redesign/map`, keyed by id so replacing an image file
 * never requires touching `MapSelector` itself.
 */
const MAP_ARTWORK_PATHS: Record<string, string> = {
  ascent: "/assets/redesign/map/ascent.jpg",
  haven: "/assets/redesign/map/haven.jpg",
  bind: "/assets/redesign/map/bind.jpg",
  lotus: "/assets/redesign/map/lotus.jpg",
  pearl: "/assets/redesign/map/pearl.jpg",
  split: "/assets/redesign/map/split.jpg",
  sunset: "/assets/redesign/map/sunset.webp",
  icebox: "/assets/redesign/map/icebox.jpg",
  abyss: "/assets/redesign/map/abyss.webp",
  corrode: "/assets/redesign/map/corrode.jpg",
  summit: "/assets/redesign/map/summit.png",
  fracture: "/assets/redesign/map/fracture.jpg",
  breeze: "/assets/redesign/map/breeze.jpg",
};

export function getMapArtworkPath(mapId: string): string | undefined {
  return MAP_ARTWORK_PATHS[mapId];
}
