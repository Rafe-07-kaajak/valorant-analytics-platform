/**
 * TASK-055 — per-map tile artwork for the Prediction Studio map pool.
 * `GameMap` (`@repo/prediction-engine` / `@repo/shared`) stays `{id, name}`
 * only — it's a domain type shared with the prediction engine, not a UI
 * concern. This lookup is the UI-only bridge from a map id to its artwork
 * in `public/assets/redesign/map`, keyed by id so replacing an image file
 * never requires touching `MapSelector` itself.
 */
const MAP_ARTWORK_PATHS: Record<string, string> = {
  ascent: "/assets/redesign/map/Ascent.jpg",
  haven: "/assets/redesign/map/Haven.jpg",
  bind: "/assets/redesign/map/Bind.jpg",
  lotus: "/assets/redesign/map/Lotus.jpg",
  pearl: "/assets/redesign/map/Pearl.jpg",
  split: "/assets/redesign/map/Split.jpg",
  sunset: "/assets/redesign/map/Sunset.webp",
  icebox: "/assets/redesign/map/Icebox.jpg",
  abyss: "/assets/redesign/map/Abyss.webp",
  corrode: "/assets/redesign/map/Corrode.jpg",
  summit: "/assets/redesign/map/Summit.png",
  fracture: "/assets/redesign/map/Fracture.jpg",
  breeze: "/assets/redesign/map/Breeze.jpg",
};

export function getMapArtworkPath(mapId: string): string | undefined {
  return MAP_ARTWORK_PATHS[mapId];
}
