# Motion Engine and Scroll-Interaction Primitives

## Purpose

TASK-051 establishes the reusable motion and scroll-interaction system that later tasks apply page by page: composable components, hooks, CSS utilities, performance safeguards, reduced-motion behavior, tests, and a small isolated showcase, built on the motion tokens TASK-050 reserved (`--duration-slow`, `--ease-exit`, `--reveal-distance`) and the cursor/pointer system TASK-034 already built.

This task does not redesign the landing page or any tool page (Prediction Studio, Historical Replay, Comparison Lab, Map Explorer). No page composition changed. The only production-facing change is inside `ScrollReveal`, whose new props are additive and default to its exact prior behavior, so every existing call site (five landing sections) renders unchanged.

## Scope

In scope: the primitive catalog below, the hooks that back it, the showcase route that demonstrates it, and a documented consolidation of TASK-034's existing card-local pointer glow into one reusable wrapper.

Out of scope, explicitly: any production page redesign, the final landing scroll story, page transitions, a particle system, scroll hijacking, forced smooth scrolling, a cursor replacement, and any new image/video asset. `StickyStory` is a mechanism (N steps, one sticky companion panel, active step tracked by scroll position), not the landing page's eventual story content.

## Baseline audit

Before writing anything, the existing motion surface was inventoried:

- **`ScrollReveal`** (`packages/ui/src/components/ScrollReveal`) already existed (TASK-033), already used in five landing sections, already handled reduced motion for free via the app-wide `MotionConfig`. Extended in place rather than replaced.
- **`CursorTracker`/`CursorSpotlight`/`usePointerGlow`** (TASK-034, `apps/web/src/components/effects`, `apps/web/src/hooks`, `apps/web/src/styles/cursor-effects.css`) were already a mature, performance-correct system: one global `pointermove` listener, CSS-custom-property-driven, IntersectionObserver-gated where relevant, fully reduced-motion- and touch-aware. No IntersectionObserver was in use for reveal purposes yet; no raw `requestAnimationFrame` loop existed outside `InteractiveParticleField` (which is already correctly gated and out of this task's scope); scroll listeners did not exist at all yet (nothing in the repo read scroll position before this task).
- **`FloatingGlassObjects`** already used Framer's own `MotionConfig`-driven reduced-motion handling correctly and needed no change.
- **Framer Motion** (`^11.15.0`) was already a dependency of both `apps/web` and `packages/ui`, already used for `motion.*`, `useReducedMotion`, and `MotionConfig`. It additionally ships `useInView` (IntersectionObserver-backed), `useScroll`/`useTransform` (scroll-progress tracking, sharing one passive listener per container via an internal `WeakMap`, verified by reading `framer-motion`'s own `scrollInfo` source), and `animate()` as a standalone tweening function. None of this was in use yet. Per the "do not create a parallel animation framework" instruction, every new primitive that needs viewport-entry detection or scroll-progress tracking is a thin wrapper around one of these instead of a hand-rolled `IntersectionObserver`/scroll listener.
- No test coverage existed for `ScrollReveal` or any viewport-entry behavior. jsdom has no `IntersectionObserver` at all, which would break any such test; `apps/web/vitest.setup.ts` now installs a controllable mock (see "Testing").

Consolidation decision: TASK-034's card-local pointer glow (`usePointerGlow` + the `.pointer-glow` CSS class + an optional `--spotlight-color` override) was hand-written at four call sites (`RegionCard`, `TeamCard`, `SelectedTeamSummary`, `FinalCta`). It is now wrapped as `CardSpotlight` (`apps/web/src/components/effects/CardSpotlight.tsx`), but **not** applied to those four existing call sites: doing so would touch production markup for a pure refactor with no visible change, which conflicts with "no production page redesign" and "avoid changing every page merely to adopt new components." `CardSpotlight` exists so a future task reaches for one component instead of re-deriving the hook+class+style combination. `CursorSpotlight` was audited and needed no change: it was already a minimal, reusable, server-renderable primitive.

## Architecture

```
packages/ui/src/
  hooks/
    useMediaQuery.ts            the one matchMedia subscription primitive
    usePrefersReducedMotion.ts  built on useMediaQuery
    usePointerCapability.ts     built on useMediaQuery
    useViewportEntry.ts         thin wrapper around Framer's useInView
    useScrollProgress.ts        thin wrapper around Framer's useScroll
  lib/
    motion.ts                   + EASE_EXIT, DURATION_SLOW, REVEAL_DISTANCE
    revealVariants.ts           shared opacity/transform variant builder
  components/
    ScrollReveal/                extended in place (TASK-033 baseline)
    StaggerGroup/                StaggerGroup + StaggerItem
    ParallaxLayer/
    StickyStory/
    TextLineReveal/
    ImageMaskReveal/
    AnimatedGradient/
    MotionNumber/
    ScrollProgress/
apps/web/src/
  components/effects/
    CardSpotlight.tsx            consolidates TASK-034's pattern
  app/internal/motion-showcase/
    page.tsx                     the showcase route
  features/motion-showcase/
    MotionNumberDemo.tsx
    StickyStoryDemo.tsx
  server/motionAudit/
    scanMotionPerformance.ts     the static performance audit
  test/
    intersectionObserverMock.ts
    mockMatchMedia.ts
```

Generic, app-agnostic primitives live in `packages/ui`, matching `ScrollReveal`'s existing location. `CardSpotlight` stays in `apps/web` because it depends on app-specific tokens (`.pointer-glow`, `--spotlight-color`, `--team-a`/`--team-b`) that `packages/ui` has no knowledge of, the same reasoning `docs/38` already gives for `Button`'s `regionAccented` variant.

## Primitive catalog

### ScrollReveal (extended)

`children`, `className`, `delay`, `duration` (default `0.6`, prior value), `distance` (default `--reveal-distance` = 24), `direction` (`"up" | "down" | "left" | "right"`, default `"up"`, prior behavior), `once` (default `true`, prior behavior), `amount`, `disabled`, `as`. `disabled` skips the motion wrapper entirely and renders children in their final state with no `motion.*` element at all, for content that would otherwise flash hidden-then-visible on hydration.

Reduced motion needs no branch of its own: it's a `motion.*` component under the app-wide `MotionConfig reducedMotion="user"` (`MotionProvider`), which makes Framer apply its x/y transform instantly while still allowing the opacity fade, so content never stays invisible.

### StaggerGroup / StaggerItem

`StaggerGroup` sets `staggerChildren`/`delayChildren` via its own `variants` and triggers once via `whileInView`; `StaggerItem` children inherit the "hidden" -> "visible" state through Framer's variant propagation (React context), not `React.Children.map`/`cloneElement`. Order is exact JSX child order, deterministic, no `Math.random()` anywhere in this module. Nesting a `StaggerGroup` inside a `StaggerItem` does not cascade (the inner group's own `whileInView` re-triggers its own entry instead of inheriting); use one `StaggerGroup` per cascading reveal, and a second independent `StaggerGroup` for a second scroll moment.

### ParallaxLayer

`speed` (magnitude/direction, default `0.2`), `axis` (`"x" | "y"`), `clamp` (bound the output to its travel range under overscroll, default `true`), `disabledBelow` (px breakpoint, default `768`). Reads scroll progress via `useScrollProgress`, which shares one passive `scroll` listener per container across every mounted `ParallaxLayer` on the page. The offset is a `motion.div` `style.y`/`style.x` `MotionValue` write, never React state, so scrolling triggers no re-render. Disabled (offset frozen at 0) under reduced motion or below `disabledBelow`, the same code path in both cases. The pure travel-range math is exported as `computeParallaxRange` for unit testing without a real scroll container.

### StickyStory

Not final landing content. `steps: ReactNode[]` (always rendered in normal document flow, the only content a screen reader or reduced-motion/mobile visitor ever sees), `renderSticky: (activeIndex) => ReactNode` (the decorative companion panel, `aria-hidden`), `disabledBelow` (default `768`). Renders the stacked, non-sticky fallback unconditionally on the server and on first client render (`mounted` starts `false`), then upgrades to the sticky two-column layout only after mount confirms a wide, motion-safe viewport — the simple, always-accessible layout is the default; sticky is an opt-up, never a downgrade a visitor has to notice. `activeIndex` state changes only at step boundaries via `useMotionValueEvent`, not every scroll frame. The container ref is attached in both branches so `useScrollProgress`'s underlying `useScroll` always has a hydrated ref, even on the very first (stacked) render pass. The pure step-index math is exported as `computeActiveStepIndex`.

### TextLineReveal

Word-by-word reveal (not true rendered-line-level: grouping spans by actual wrapped line needs a layout-measurement pass that's brittle across breakpoints and font-load timing; word-level reads the same and needs none of that). The outer element carries `aria-label={text}`, the one accessible copy, read exactly once. A `<span>`/`<p>` has no default ARIA role that permits naming from `aria-label` (axe-core's `aria-prohibited-attr` rule), so those two `as` values also get `role="group"`; `<h1>`-`<h4>` are left without an explicit role, since the implicit `heading` role already supports `aria-label` and adding `role="group"` would strip the heading semantics a screen reader navigates by. The animated word spans live in an `aria-hidden` inner wrapper, decorative only.

### ImageMaskReveal

Reveals via a covering panel that translates away (`transform`, not an animated `clip-path`: a transform-only exit stays on the compositor in every browser, where an animated `clip-path` can force paint depending on engine/version). The image content is always mounted at full opacity behind the mask and never conditionally rendered, so decode is never blocked; the mask is `aria-hidden` and `pointer-events-none`.

### CardSpotlight (apps/web)

Wraps `usePointerGlow` + the `.pointer-glow` class + an optional `spotlightColor` (`--spotlight-color`) override into one component. See "Baseline audit" for why it isn't applied to the four existing hand-written call sites yet.

### CursorSpotlight (apps/web, unchanged)

Audited, not modified: already a minimal, pure-CSS, server-renderable primitive with no client JS of its own (`CursorTracker` is the one global pointer listener; `CursorSpotlight` just reads the CSS custom properties it writes).

### AnimatedGradient

Server component, CSS-driven: a plain `@keyframes` background-position drift (`.motion-gradient-drift`, `apps/web/src/styles/gradients.css`), not a Framer `animate()` loop. Five variants, all reading `--gradient-*` tokens `docs/38` already declared (no new color values). Reduced motion needs no component-level branch: the global `@media (prefers-reduced-motion: reduce)` rule in `tokens.css` already forces `animation-duration: 0.01ms !important` site-wide, which this plain CSS animation is fully covered by.

### MotionNumber

`value`, `format` (`"integer" | "decimal" | "percent"`), `decimals`, `duration` (fixed, default `0.6`; never derived from the size of the change — a deterministic tween, not a random count-up). Uses Framer's standalone `animate()` to write formatted text via `textContent` on a ref on every tick, not React state, so a fast-changing number never re-renders. `value` is also rendered as real JSX children, so server output and first paint already show the correct number before any tween logic runs. The outer `<span>` carries `role="group"` (same `aria-prohibited-attr` reasoning as `TextLineReveal`) plus `aria-label` with the plain formatted value; the animated inner span is `aria-hidden`. Under reduced motion the new value is written immediately with no tween.

### ScrollProgress

Not mounted anywhere by this task. `target` (omit for page-level), `label` (adds `role="progressbar"` + `aria-valuemin`/`max`/`now`, imperatively written via ref on each tick, not React state; omit for a purely decorative, `aria-hidden` bar). Binds `scaleX` directly to the `MotionValue` from `useScrollProgress`, a transform rather than an animated `width`, with no interpolation of its own, so there is no "reduced motion" branch to write: it always reflects real scroll position 1:1.

## Hooks

- **`useMediaQuery(query)`** — the one shared `matchMedia` subscription primitive. Always `false` on the first render (server and pre-hydration client agree), updates after mount. Every other capability hook is built on this one.
- **`usePrefersReducedMotion()`** — `useMediaQuery("(prefers-reduced-motion: reduce)")`.
- **`usePointerCapability()`** — `{ isFinePointer, hasHover, isCoarsePointer }`, mirroring the `(pointer: coarse), (hover: none)` gate `cursor-effects.css` already hand-writes, exposed to JavaScript so a component can skip mounting a listener entirely rather than only hiding the result with CSS.
- **`useViewportEntry(ref, options)`** — thin wrapper around Framer's `useInView`.
- **`useScrollProgress(options)`** — thin wrapper around Framer's `useScroll`, returning the raw `MotionValue<number>` (not React state).

Deliberately **not** added: a `useRafPointer`/pointer-position hook. `CursorTracker`'s global CSS-variable-driven pointer store and `usePointerGlow`'s cached-rect-on-enter approach are already the correct, performance-audited pattern (TASK-034); a second pointer-position hook would either duplicate that global listener or bypass its "exactly one `pointermove` listener for the whole app" guarantee. This is a documented "add reusable hooks only where needed" decision, not an oversight.

## Motion tokens

Reused, not reinvented: `--duration-slow` -> `DURATION_SLOW = 0.48`, `--ease-exit` -> `EASE_EXIT`, `--reveal-distance` -> `REVEAL_DISTANCE`, all added to `packages/ui/src/lib/motion.ts` alongside the pre-existing `EASE_EMPHASIZED`, mirroring the same "Framer needs a raw value, CSS has a custom property" pattern that constant already established. No new duration, easing, or distance value was introduced.

## Reduced-motion policy

Two independent layers, matching the pre-existing TASK-033/034 policy:

1. The global `@media (prefers-reduced-motion: reduce)` rule in `tokens.css` (unchanged) forces `transition-duration`/`animation-duration` to near-zero site-wide, covering `AnimatedGradient`'s plain CSS keyframe animation with no additional code.
2. Every JavaScript-driven primitive built on `motion.*` (`ScrollReveal`, `StaggerGroup`/`StaggerItem`, `TextLineReveal`, `ImageMaskReveal`) inherits instant-apply-on-reduced-motion for free from the app-wide `MotionConfig reducedMotion="user"`. Primitives that animate outside a declarative `motion.*` target (`ParallaxLayer`'s `useTransform` chain, `StickyStory`'s sticky/stacked branch, `MotionNumber`'s standalone `animate()`) call `usePrefersReducedMotion()` directly and branch on it.

Every primitive's final state is fully present and visible under reduced motion: no parallax, no animated gradient (frozen by the CSS rule), no pointer-follow motion, no count-up, no sticky-scroll dependence (StickyStory's default is the stacked, always-accessible layout).

## Mobile and pointer policy

- `ParallaxLayer` disables outright below `disabledBelow` (default 768px).
- `StickyStory` falls back to the stacked layout below `disabledBelow` (default 768px) and is that same stacked layout by default until mount confirms otherwise.
- `CardSpotlight`/`CursorSpotlight` (unchanged TASK-034 behavior) are hidden under `(pointer: coarse), (hover: none)`, and `CursorTracker` skips attaching its listener at all on such devices.
- Nothing here reads `touchmove`, device orientation, or battery-sensitive particle counts.

## Performance

- **Listeners**: `ParallaxLayer`/`StickyStory`/`ScrollProgress` all read scroll position through `useScrollProgress`, which shares one passive `scroll` listener per container (`framer-motion`'s own `scrollInfo`, keyed by container in a `WeakMap`) regardless of how many components subscribe.
- **RAF**: no primitive in this module runs its own `requestAnimationFrame` loop; `MotionNumber`'s tween and every `motion.*` transform ride Framer's own internal frame scheduler, which only runs while a value is actually animating.
- **Transforms**: every visual movement in this module is `transform`/`opacity` (or, for `ImageMaskReveal`, a transform-based mask exit chosen specifically over an animated `clip-path` for the compositor-only guarantee); `AnimatedGradient`'s `background-position` drift is the one exception, a plain CSS animation, not a JS-computed per-frame value.
- **Observers**: viewport entry goes through Framer's `useInView` (IntersectionObserver-backed) rather than a second hand-rolled observer.
- **React state**: `ParallaxLayer` and `ScrollProgress` never hold scroll position in React state at all (`MotionValue` writes only); `StickyStory` updates state only at step boundaries; `MotionNumber` writes its tween via `textContent` on a ref, never React state, per animation frame.
- **Bundle**: no new npm dependency (Framer Motion was already installed in both packages). `apps/web`'s production build succeeds with the showcase route as a small (~2 kB) statically-prerendered page; see "Verification" for the full route table. `packages/ui`'s `package.json` does not currently declare `"sideEffects": false`, which is a pre-existing condition (not introduced by this task) worth a future task's attention for tree-shaking headroom, noted here rather than changed, since it's a package-wide config decision outside this task's scope.

A small static audit (`apps/web/src/server/motionAudit/scanMotionPerformance.ts`, run via `pnpm motion-audit`) checks the fixed list of new files above for: an animated layout property (`width`/`height`/`top`/`left`/`right`/`bottom` used as a value key), an unbounded `blur()`, a raw `addEventListener("scroll", ...)`, a direct `requestAnimationFrame` call, unguarded direct `window` access, and that every file documents which of the three reduced-motion mechanisms above it uses. Deliberately not a general-purpose linter: a fixed file list and a handful of substring/regex checks, the same "small targeted audit" `scanCopyHygiene.ts` already established for copy hygiene.

## SSR and hydration

- `ScrollReveal`/`StaggerGroup`/`TextLineReveal`/`ImageMaskReveal` render their `initial` variant inline (Framer computes this synchronously, server and client agree) — no flash of the wrong state.
- `StickyStory` starts `mounted = false` unconditionally, so server HTML and the first client render are always the stacked fallback; the sticky upgrade only happens after mount confirms capability. This is a deliberate "simple state first, richer state as an opt-up" choice specifically to avoid ever downgrading a hydrated DOM tree.
- `useMediaQuery` (and everything built on it) returns `false` until mounted, for the same reason.
- `AnimatedGradient` and `ScrollProgress`/`ParallaxLayer`'s underlying `MotionValue`s need no hydration branch: their first computed value from real scroll/media state is correct as soon as the browser can measure it.

## Accessibility

- `TextLineReveal` and `MotionNumber` fixed a real `aria-prohibited-attr` violation found during this task's own verification (`aria-label` is not permitted on a `<span>`/`<p>` with no ARIA role) by adding `role="group"` to their non-heading wrapper elements.
- No primitive moves focus during its own animation.
- `StickyStory`'s sticky companion panel is `aria-hidden`; its `steps` content is the sole accessible copy, always in natural reading order.
- `MotionNumber` never announces an intermediate tween frame (`aria-hidden` on the animated span; the accessible name is the settled formatted value).
- No primitive in this catalog produces rapid alternating colors or a seizure-risk flash.

## Existing motion consolidation

See "Baseline audit" above for the full detail. Summary: `ScrollReveal` extended in place (zero behavior change for existing call sites); `CardSpotlight` created as a documented, not-yet-applied consolidation of TASK-034's pattern; `CursorSpotlight`, `CursorTracker`, `usePointerGlow`, `TacticalBlueprintGrid`, and `FloatingGlassObjects` audited and left unchanged, since each was already correct and none needed a replacement.

## Showcase route

`/internal/motion-showcase` (`apps/web/src/app/internal/motion-showcase/page.tsx`). `robots: { index: false, follow: false }` in its own metadata, plus a `Disallow: /internal` rule added to `apps/web/src/app/robots.ts`. Not linked from `SiteNavbar` or the footer (`e2e/motion-showcase.spec.ts` asserts this directly). Demonstrates every primitive above with local CSS/gradient-token placeholders, no external image dependency. `apps/web/src/features/motion-showcase/MotionNumberDemo.tsx` and `StickyStoryDemo.tsx` are small client-component wrappers that exist specifically because a Server Component page cannot pass a function prop (`renderSticky`, the randomize handler) across the client boundary.

## Testing

- **Unit** (`apps/web/src/components/MotionHooks.test.tsx`, `MotionPrimitives.test.tsx`, `effects/CardSpotlight.test.tsx`, `server/motionAudit/scanMotionPerformance.test.ts`): hook behavior (media-query reactivity, listener cleanup, reduced-motion/pointer-capability branching), the pure `buildRevealVariants`/`computeParallaxRange`/`computeActiveStepIndex` calculations, `ScrollReveal`'s disabled/initial-state/direction wiring, `StaggerGroup` ordering, `TextLineReveal`/`MotionNumber` accessible-name-without-duplication, `ImageMaskReveal`'s always-mounted image and aria-hidden mask, `AnimatedGradient`'s variant/static classes, `ScrollProgress`'s decorative-vs-labeled modes, `StickyStory`'s sticky-vs-stacked fallback across reduced motion and breakpoint, and the static performance audit itself.
- **jsdom polyfill** (`apps/web/src/test/intersectionObserverMock.ts`): jsdom has no native `IntersectionObserver`, which `useInView` calls unconditionally. The mock never fires on its own; a test grabs the instance and calls `.trigger(true/false)` explicitly, so reveal tests assert real state transitions instead of guessing at observer timing.
- **`mockMatchMedia`** (`apps/web/src/test/mockMatchMedia.ts`): a query-aware `matchMedia` mock supporting multiple simultaneous queries and a "change" event trigger, extending the single-query helper `CursorTracker.test.tsx` already used.
- Deliberately avoided: asserting exact mid-transition animation values or wall-clock timing anywhere. Tests check initial/final state, prop wiring, and pure calculation functions instead.
- **E2E** (`e2e/motion-showcase.spec.ts`, `e2e/motion-showcase-mobile.spec.ts`): showcase renders every primitive's accessible content, is excluded from indexing (page metadata and `robots.txt`) and not linked from primary navigation, `MotionNumber` visibly tweens on a real interaction, reduced-motion emulation reaches every primitive's final state, no console errors or failed requests while scrolling, zero axe violations, and the mobile viewport renders `StickyStory`'s stacked fallback with no horizontal overflow. The mobile-viewport spec is a separate file because `test.use(devices[...])` forces its own worker, the same reason `cursor-effects-touch.spec.ts` is split from `cursor-effects.spec.ts`.

## Anti-patterns

- Don't wrap every element on a page in `ScrollReveal`; per the approved direction, motion should stay subtle on tool pages.
- Don't nest a `StaggerGroup` inside a `StaggerItem` expecting the outer trigger to cascade into the inner one; see "StaggerGroup / StaggerItem" above.
- Don't animate `clip-path` for a reveal when a transform-based mask (`ImageMaskReveal`'s approach) achieves the same visual result on the compositor.
- Don't add a second global pointer or scroll listener; extend `CursorTracker`/`useScrollProgress`'s shared-listener pattern instead.
- Don't put the only copy of information inside a `StickyStory` `renderSticky` panel or any other `aria-hidden` decorative layer.

## Known limitations

- No landing page redesign occurred; the current landing sections keep their existing `ScrollReveal` usage unchanged.
- No final scroll story exists; `StickyStory` is the mechanism, not the content.
- No major image or video assets were added; the showcase uses CSS gradient-token placeholders.
- No page transitions, particle system, or production navigation integration were built.
- `TextLineReveal` reveals by word, not by actual rendered line (see "Primitive catalog").
- `role="text"` (a non-standard but increasingly supported ARIA role purpose-built for exactly this "labeled run of decorative markup" case) was considered for `TextLineReveal`/`MotionNumber` and rejected in favor of the universally standard `role="group"`, to avoid depending on inconsistent cross-browser/AT support.
- `packages/ui`'s `package.json` does not declare `"sideEffects": false`; a pre-existing condition, noted under "Performance" as a follow-up rather than changed in this task.

## Next step

TASK-052: asset art direction and generation. This task's motion primitives are ready for later tasks to opt into page by page; none of them have been applied to a production page's composition yet.
