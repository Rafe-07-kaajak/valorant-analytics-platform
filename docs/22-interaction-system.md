# Interaction System

Version: 1.0 (TASK-033)

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
5. **Decorative background** — untouched by this system (cursor spotlight / parallax is TASK-034).

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

- **TASK-034**: global cursor spotlight, tactical grid parallax, card-local cursor spotlight.
- **TASK-037**: keyboard-reachable, per-point/per-bar chart interactivity (`RadarChart`'s data points currently rely on a native `<title>` tooltip and are not focusable — making them properly interactive requires managed focus state and a coordinated highlight with `KeyFactorsList`, which is a larger feature than a motion pass).
