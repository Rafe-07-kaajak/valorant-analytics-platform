# Interaction System

Version: 1.1 (TASK-033, extended in TASK-034)

---

## Purpose

This document defines the unified micro-interaction system used across buttons, links, selectable controls, cards, and panels.

The goal is a website that feels responsive without feeling animated for its own sake.

---

## Tokens

Defined in `apps/web/src/styles/tokens.css`, consumed via arbitrary-value syntax (e.g. `duration-(--duration-fast)`, `-translate-y-(--lift-button)`).

Durations:

- `--duration-fast`: 160ms — buttons, links, icon color/background transitions.
- `--duration-base`: 200ms — transform/border/shadow on selectable controls and cards.
- `--duration-panel`: 280ms — dialogs, drawers, tooltips, and result-panel reveals.

Easing:

- `--ease-standard`: the default for interaction feedback.
- `--ease-emphasized`: reserved for entrance animation (`ScrollReveal`, `Hero`), imported as `EASE_EMPHASIZED` from `@repo/ui` rather than copy-pasted.

Movement limits:

- `--lift-button`: -2px
- `--lift-card-selectable`: -3px (region/team/feature-selector cards)
- `--lift-card-info`: -2px (reserved; static info cards should generally stay at 0)
- `--lift-card-feature`: -4px (ceiling for any larger promotional card)
- `--travel-icon`: 3px
- `--scale-logo-hover`: 1.03
- `--scale-press`: 0.98

---

## Interaction hierarchy

1. **Primary actions** (buttons, submit) — lift, background/shadow shift, press feedback.
2. **Selectable controls** (region/team cards, map buttons, tab triggers) — lift, border/glow on selection.
3. **Navigation and secondary controls** (nav/footer links, icon buttons) — color shift and underline only, no lift.
4. **Information cards** (landing feature cards, result cards) — very subtle border/background response only if the card is not clickable; no lift, no scale. A static card must never look clickable.
5. **Decorative background** — the global cursor spotlight and grid parallax (TASK-034, see below) sit at this tier: always the most subtle layer, never competing with a selected or hovered card.

---

## Shared primitives

`packages/ui/src/lib/motion.ts` exports the building blocks so hover/focus strings aren't hand-rolled per component:

- `focusRing` — the standard `focus-visible` outline.
- `linkInteraction` — Level 3 color-only transition + focus ring.
- `iconButtonInteraction` — shared icon-button treatment (dialog close, menu toggle) plus press feedback.
- `EASE_EMPHASIZED` — the Framer Motion equivalent of `--ease-emphasized`.

`Button`'s `buttonVariants()` composes these into the Level 1 treatment (lift, press, disabled handling) for every button-like element in the app, including `<Link className={buttonVariants(...)}>` usages.

---

## Reduced motion

Two layers:

1. Components gate their own transforms behind Tailwind's `motion-safe:` variant.
2. A global `@media (prefers-reduced-motion: reduce)` rule in `tokens.css` forces `transition-duration`/`animation-duration` to near-zero everywhere, as a safety net for color/background transitions that aren't individually gated (nav links, form controls, panels).

No information is conveyed by motion alone — selected/hover/focus/disabled states are always also expressed through color, border, or an icon.

---

## When not to animate

- Static, non-clickable cards (landing feature cards, result/insight cards) do not get lift or scale — only an optional, very subtle border/background response.
- Disabled controls never receive hover/lift/glow treatment (`disabled:pointer-events-none` on `Button`; `aria-disabled` + `pointer-events-none` on region/team cards).
- Chart primitives (`RadarChart`, `Meter`, `SplitBar`) are left as-is in this task — see "Deferred" below.

---

## Deferred to later tasks

- **TASK-037**: keyboard-reachable, per-point/per-bar chart interactivity (`RadarChart`'s data points currently rely on a native `<title>` tooltip and are not focusable — making them properly interactive requires managed focus state and a coordinated highlight with `KeyFactorsList`, which is a larger feature than a motion pass).

---

## TASK-034 — cursor-reactive effects

Three decorative, pointer-driven effects layered on top of the system above: a global cursor spotlight, a tactical-grid parallax/proximity glow, and a reusable card-local pointer spotlight. All three are pure CSS reading custom properties — no React state, no canvas, no new dependency.

### Global cursor provider

`CursorTracker` (`apps/web/src/components/effects/CursorTracker.tsx`), mounted once in `app/layout.tsx`, is the **one** global `pointermove` listener for the whole app. On a coarse/no-hover pointer it attaches nothing at all (checked via `(hover: hover) and (pointer: fine)`). It writes to two places:

- The plain `cursorPosition` object (`apps/web/src/lib/cursorPosition.ts`) — updated synchronously on every event, for the one JS consumer that needs raw coordinates (`InteractiveParticleField`'s canvas loop, which now reads this instead of registering its own `window` listener).
- `--cursor-x` / `--cursor-y` (px, viewport-relative) and `--cursor-x-normalized` / `--cursor-y-normalized` (0–1) on `<html>`, rAF-throttled — for every pure-CSS consumer.

`data-cursor-active` on `<html>` tracks whether the pointer is currently in the viewport (set on `pointermove`, cleared on `mouseleave` of `<html>` and on window `blur`), and is cleared again on unmount. Nothing here touches React state, so no page content ever rerenders as the cursor moves, and there is no server/client markup mismatch — `CursorTracker` always renders `null`, and every DOM write happens imperatively after mount.

### Global spotlight (`.cursor-spotlight`, `CursorSpotlight`)

A `position: fixed; inset: 0; z-index: -10` layer (`CursorSpotlight`, server-renderable, no client JS of its own) whose `::before` is a soft radial gradient translated to `var(--cursor-x, -9999px), var(--cursor-y, -9999px)`. Radius is a token (`--spotlight-radius`: 340px, 420px ≥1280px, 280px ≤767px). A `transform` transition (500ms) gives it a trailing lag rather than rigid pointer-attachment — no JS interpolation loop. Opacity is 0 until `html[data-cursor-active="true"]`, and the gradient itself uses a low `color-mix()` percentage (9% light / 16% dark) so it reads as ambient light, not a colored wash. `z-index: -10` plus DOM position (first child of `<body>`) keeps it behind all normal content; any section with its own opaque background (Hero's video, card surfaces) naturally occludes it, which is what prevents it from competing with Hero's existing effects. Disabled entirely via `display: none` under `(pointer: coarse), (hover: none)`.

### Tactical grid parallax + proximity glow

`TacticalBlueprintGrid` (effect 29) gained an opt-in `interactive` prop, applied at its one existing call site (`MatchDnaSection`, the prediction-result Match DNA panel) — no new placements were added. `interactive` adds:

- `.tactical-grid-parallax` — a small (±8px) `transform: translate3d(...)` driven by the **global** normalized cursor vars, 700ms transition (deliberately slower than the spotlight's 500ms, so it visibly lags behind it).
- `.tactical-grid-glow` — a soft local highlight using `--spotlight-x`/`--spotlight-y`, which requires a hovered ancestor carrying `usePointerGlow`'s handlers and the `tactical-grid-glow-host` class (`MatchDnaSection` itself, since the grid layer is `pointer-events-none` and can't receive events directly).

Both fall back to fully static under reduced motion or a coarse/no-hover pointer — parallax removes its transform entirely, the glow layer is `display: none`.

### Card-local pointer spotlight

`usePointerGlow<T>()` (`apps/web/src/hooks/usePointerGlow.ts`) is the one reusable hook behind every card-local glow. It caches `getBoundingClientRect()` on `pointerenter` and reuses it for subsequent `pointermove`s while hovered — no layout read on every move, and no read at all for cards that aren't hovered. It writes `--spotlight-x`/`--spotlight-y` directly via `element.style.setProperty`, no React state. The `.pointer-glow` CSS class (a `::before` at `z-index: -1` inside an `isolation: isolate` stacking context) reads those vars and fades in on `:hover`/`:focus-within` — the fade itself needs no JS.

Applied to: `RegionCard`, `TeamCard` (Team A → cyan, Team B → coral, via a `--spotlight-color` override — `TeamCard` never attaches the class or handlers at all when disabled), `SelectedTeamSummary` (a deliberately fainter tint — 12% vs `TeamCard`'s 20% — since it's a static display, not a control), and `FinalCta`'s promotional card. Intentionally **not** applied to `CoreFeatures`' static feature cards or any Prediction Studio result/insight card (`PredictionSummary`, `MatchDnaSection`'s own cards, `ExplanationCard`, etc.) — none of those are clickable as a whole card, and per the Level 4 rule above, a static card must never look clickable.

Effect strength hierarchy (strongest to weakest): a card's **selected** state (solid border + box-shadow ring, unchanged from TASK-033) → an interactive card's **hover** pointer-glow → the **global** spotlight → **grid parallax**. The global spotlight's low opacity and large, softly-fading radius keep it well below any card-local or selected-state signal.

### Mobile / touch and reduced motion

Every effect here shares two guards: `@media (prefers-reduced-motion: reduce)` and `@media (pointer: coarse), (hover: none)`. On touch devices nothing is disabled by JavaScript feature-detection alone — `CursorTracker` also skips attaching its listener there, so there's no dangling listener and no sticky-hover risk from any of these effects.

### Performance rules (kept from this task)

- One global `pointermove` listener, period — `InteractiveParticleField` was refactored to stop registering its own.
- No `getBoundingClientRect()`/layout read outside of a pointer-enter on the specific hovered element.
- `transform`/`opacity`/custom-property writes only; no `background-position` transitions.
- No canvas addition, no WebGL, no new dependency.

### When not to apply a cursor effect

- Never on a static, non-clickable card (implies false affordance) — apply the plain TASK-033 Level 4 border treatment instead, if anything.
- Never where it would compete visually with an existing autonomous effect in the same section without deliberately checking the layering (Hero's opaque background already occludes the global spotlight there, which is why nothing extra was needed for that section).
- Never as the sole way to convey state — selected/hover/disabled/focus all remain expressed through color, border, or an icon exactly as in TASK-033; cursor effects are strictly decorative.
