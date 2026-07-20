# Visual Foundation and Design Tokens

## Purpose

TASK-050 establishes the design-system foundation for the platform's visual redesign roadmap: the Cinematic Multicolor Tactical Experience.

This document defines the typography system, color system, gradient tokens, surface hierarchy, shape language, spacing conventions, shadow and glow tokens, motion tokens, and the button/card/form component hierarchy that TASK-051 and later tasks will apply page by page.

This task does not redesign any page. No page composition changed. The only visually observable changes from this task are the two-font typography swap (approved and required by this task) and a barely perceptible off-white shift in the light-theme page background. Every other token, gradient, surface, and component variant introduced here is additive and unused by any existing page until a future task opts in.

## Approved art direction

- Cinematic Multicolor Tactical Experience.
- Dark-first: the dark theme is the primary authored experience; light theme stays fully functional and readable.
- Multicolor, visually stimulating, but controlled. Accents are not used randomly; each accent, region color, and gradient has one documented purpose.
- Tactical luxury and experimental editorial design. Not generic cyberpunk, not a standard enterprise dashboard, not flat black and white, not neon everywhere, not a gaming cafe RGB aesthetic.
- Stronger typography contrast and stronger shape language, while remaining premium, expressive, and usable.
- Future pages will use VALORANT-related agents, maps, and tactical imagery. This task does not introduce any new imagery or large visual assets.

## Typography

### Font pairing

- Body and UI face: **Inter**, loaded via `next/font/google` as `--font-inter`.
- Heading and statement face: **Space Grotesk**, loaded via `next/font/google` as `--font-space-grotesk`.
- Numeric/code face: **Geist Mono** (unchanged from the prior foundation), used for code blocks and available for tabular numeral contexts.

### Why Space Grotesk instead of Clash Display

The approved direction named Clash Display as the preferred heading face, with a fallback order of Cabinet Grotesk, Satoshi, and General Sans if Clash Display could not be safely integrated. All four of those faces are Fontshare-exclusive: none are available through `next/font/google`, and no licensed local font file for any of them exists in this repository. Downloading font binaries from a third party during this task would violate the "do not download or bundle untrusted font files" constraint and could not be verified for license terms from within this environment.

This was raised to the user directly. The decision: wire `--font-display` to Space Grotesk, a geometric Google Font in the same expressive-display register, as a same-family substitute until licensed Clash Display (or Cabinet Grotesk) files are supplied. Swapping the real face in later only requires changing the `next/font` import in `apps/web/src/app/layout.tsx`; no consumer of `--font-display` needs to change, since every heading and future display-text usage reads the face through that token, never a hardcoded font name.

### Font loading

Both faces are loaded via `next/font/google` in `apps/web/src/app/layout.tsx` with `display: "swap"`. `next/font` self-hosts the font files at build time (no runtime request to `fonts.googleapis.com`) and injects size-adjusted fallback metrics, so there is no layout shift on load and no external network dependency at runtime.

### Token architecture

`apps/web/src/styles/typography.css` exposes three semantic CSS variables, each resolving to the `next/font`-injected variable with a system-font fallback chain:

- `--font-body` → Inter
- `--font-display` → Space Grotesk, falling back to Inter
- `--font-mono` → Geist Mono (unchanged)
- `--font-sans` is kept mapped to Inter as well, since Tailwind's default `font-sans` utility and any existing `font-sans` class usage should keep resolving to the body face.

Global `h1`–`h4` now read `font-family: var(--font-display)`, so every existing heading site-wide now renders in Space Grotesk rather than the prior Geist Sans. This is the one intentional, foundational visual change this task makes to existing pages: it is the literal deliverable of the two-font hierarchy, not a composition redesign.

The heading face must not be used for dense UI (tables, compact metadata, form labels). Nothing in this task applies `--font-display` outside the `h1`–`h4` global rule; the semantic type scale below documents where each face is intended, but a future task must apply it deliberately per component.

### Type scale

`typography.css` keeps the pre-existing numeric scale (`--text-xs` through `--text-5xl`, used by existing components) and adds a semantic scale, each paired with a line-height (and letter-spacing, where relevant) via Tailwind v4's `--text-{name}--line-height` / `--text-{name}--letter-spacing` convention:

| Token | Size | Line-height | Letter-spacing | Intended face | Intended use |
|---|---|---|---|---|---|
| `display-xl` | 4.5rem | 1.05 | -0.02em | `--font-display` | Hero statements |
| `display-lg` | 3.5rem | 1.08 | -0.02em | `--font-display` | Large CTA statements |
| `heading-xl` | 2.75rem | 1.12 | -0.01em | `--font-display` | Page titles |
| `heading-lg` | 2.25rem | 1.15 | -0.01em | `--font-display` | Section headings |
| `heading-md` | 1.75rem | 1.2 | -0.01em | `--font-display` | Subsection headings, large numbers |
| `body-lg` | 1.125rem | 1.6 | — | `--font-body` | Lead paragraphs |
| `body-md` | 1rem | 1.6 | — | `--font-body` | Body copy |
| `body-sm` | 0.875rem | 1.55 | — | `--font-body` | Secondary/helper text |
| `label-md` | 0.875rem | 1.3 | 0.01em | `--font-body` | Form labels, buttons |
| `label-sm` | 0.75rem | 1.3 | 0.02em | `--font-body` | Compact labels, badges |
| `caption` | 0.6875rem | 1.35 | 0.02em | `--font-body` | Captions, timestamps |

Two named letter-spacing tokens (`--tracking-display: -0.02em`, `--tracking-label: 0.02em`) are available beyond Tailwind's default `tracking-*` scale, which already covers the general case and stays in use as-is elsewhere in the repository.

### Tabular numerals

Tailwind's built-in `tabular-nums` utility (the `font-variant-numeric` core plugin) is the established convention for probability, model score, and metric displays where digits must not shift width as they change, e.g. prediction confidence percentages and live-updating stat rows. No new token was introduced for this since Tailwind already provides it.

## Color system

### Design principle

The color system is layered, not replaced. Every pre-existing semantic token (`--background`, `--foreground`, `--surface`, `--brand-*`, `--success`/`--warning`/`--danger`, `--team-a`/`--team-b`, existing badge pairs) keeps its exact prior value, so no existing page repaints. New tokens are additive: a wider accent palette, a full five-color semantic set, VCT region identity colors, and a second surface elevation step. Pages adopt these deliberately, one at a time, starting in TASK-051.

The one intentional exception is `--background` in light theme, which moved from `#ffffff` to `#fafbfd`, a one-step cool off-white, per the explicit "do not leave pure white everywhere" requirement. The shift is small enough that foreground/text contrast is unaffected (still far above WCAG AAA) and no other token changed alongside it.

### Base neutrals

The existing dark-theme surface ladder already covers void black through off-white (`--background: #05070a`, `--surface: #10141b`, `--foreground: #f2f4f8`). TASK-050 does not introduce a separate named neutral ramp on top of these; the surface elevation tokens below extend the same ladder by one step in each theme.

### Global accent palette

Declared once (not theme-swapped, matching the existing `--color-brand-*` and `--color-accent-violet` convention) in `apps/web/src/styles/tokens.css`:

| Token | Value | Role |
|---|---|---|
| `--color-accent-cyan` | `#22d3ee` | Multicolor system, gradients, data viz |
| `--color-accent-blue` | `#3b82f6` | Multicolor system, gradients, data viz |
| `--color-accent-violet` | `#8b7cf6` | Pre-existing; restrained secondary accent |
| `--color-accent-magenta` | `#d946ef` | Multicolor system, gradients |
| `--color-accent-coral` | `#ff6f59` | Multicolor system, gradients |
| `--color-accent-amber` | `#f59e0b` | Multicolor system, gradients |
| `--color-accent-lime` | `#a3e635` | Multicolor system, gradients |

`--color-brand-*` (the existing cyan/blue "primary intelligence" interactive color) remains the only color used for default interactive UI (buttons, links, focus rings). The accent palette is for gradients, region identity, and data visualization, not for restyling existing interactive elements.

### Semantic status colors

Rounded out to the full five-color set (`success`, `warning`, `danger`, `info`, `neutral`), each theme-aware and validated at ≥4.5:1 contrast against its theme's background:

| Token | Light | Dark |
|---|---|---|
| `--success` | `#15803d` (pre-existing) | `#4ade80` (pre-existing) |
| `--warning` | `#b45309` (pre-existing) | `#fbbf24` (pre-existing) |
| `--danger` | `#b91c1c` (pre-existing) | `#f87171` (pre-existing) |
| `--info` | `#1d4ed8` (6.70:1) | `#60a5fa` (7.93:1) |
| `--neutral` | `#475569` (7.58:1) | `#94a3b8` (7.87:1) |

`--neutral` is distinct from the pre-existing `--muted-foreground`: `--muted-foreground` styles secondary text everywhere; `--neutral` is the neutral member of the status-color family, for indicators like "pending" or "no data".

### VCT region identity

Each region has a primary color (text/icon/border safe, validated ≥4.5:1 against its theme background) and an alt color (decorative only: gradients and chip fills alongside a fixed text color, never used as text-on-background by itself, the same convention as `--color-accent-violet`):

| Region | Primary (light) | Alt (light) | Primary (dark) | Alt (dark) |
|---|---|---|---|---|
| Americas | `#c2410c` orange (5.18:1) | `#ff6f59` coral | `#fb923c` orange (8.91:1) | `#ff6f59` coral |
| EMEA | `#4338ca` cobalt (7.90:1) | `#94a3b8` silver | `#818cf8` cobalt (6.76:1) | `#cbd5e1` silver |
| Pacific | `#0e7490` cyan (5.36:1) | `#2dd4bf` aqua | `#22d3ee` cyan (11.16:1) | `#5eead4` aqua |
| China | `#be123c` crimson (6.29:1) | `#f472b6` pink | `#fb7185` crimson (7.49:1) | `#f9a8d4` pink |

Every badge background/text pair for these regions (`--badge-region-{id}-bg` / `--badge-region-{id}-text`) is validated directly against itself (not derived from the primary color's contrast against a page background), following the same rule the pre-existing `--badge-success-*` / `--badge-danger-*` / `--badge-brand-*` pairs use. All twelve new badge pairs (info, neutral, and the four regions, in both themes) clear 4.5:1; the tightest is `--badge-region-americas` in light theme at 4.52:1.

### Contrast validation method

All new color pairs above were checked with a standalone WCAG relative-luminance/contrast-ratio calculation (not eyeballed), the same formula the platform's existing tokens document using. Values are chosen from the same Tailwind-palette-derived hue families the pre-existing tokens already use, for visual consistency with the established brand/status/team colors.

## Gradients

`apps/web/src/styles/gradients.css` (new file, imported from `globals.css` immediately after `typography.css`) declares reusable `linear-gradient()` / `radial-gradient()` values as CSS custom properties, consumed via Tailwind arbitrary-value syntax against the variable, e.g. `className="bg-[image:var(--gradient-cyan-blue)]"`. This mirrors the existing convention for motion tokens (`duration-(--duration-fast)`).

| Token | Composition |
|---|---|
| `--gradient-cyan-blue` | accent-cyan → accent-blue |
| `--gradient-blue-violet` | accent-blue → accent-violet |
| `--gradient-violet-magenta` | accent-violet → accent-magenta |
| `--gradient-coral-amber` | accent-coral → accent-amber |
| `--gradient-region-americas` / `-emea` / `-pacific` / `-china` | each region's primary → alt |
| `--gradient-button` | brand-400 → brand-600 (single hue family, for a future high-emphasis CTA) |
| `--gradient-selected` | low-alpha brand/violet wash, for a selected-row/card background |
| `--gradient-mesh-subtle` | three low-alpha radial washes (cyan, violet, coral), for large ambient panels |
| `--gradient-spotlight` | the radial falloff already used by `.cursor-spotlight`, extracted as a reusable token |
| `--gradient-ambient` | theme-aware: mesh-subtle in light theme, a low-alpha blue vertical wash in dark theme |

None of these are applied to any component or page by this task. Gradients are decorative surfaces: text placed over one must use a solid, theme-appropriate foreground color chosen deliberately for that gradient's darkest/lightest stop, never assumed white-on-everything, when a future task adopts them. Every gradient stays low-alpha by design; a full-saturation multicolor mesh is exactly the "uncontrolled rainbow gradient" the approved direction rules out.

## Surfaces

Surface hierarchy extends the pre-existing `--background` / `--surface` pair by one elevation step, plus glass and overlay surfaces, in both themes:

| Token | Role | Light | Dark |
|---|---|---|---|
| `--background` | Page background | `#fafbfd` | `#05070a` (unchanged) |
| `--surface` | Card / section background (unchanged) | `#f7f9fb` | `#10141b` |
| `--surface-raised` | Elevated card / elevated section | `#eef1f6` | `#171d28` |
| `--surface-glass` | Glass surface | `color-mix(in oklab, var(--surface) 72%, transparent)` | `color-mix(in oklab, var(--surface) 55%, transparent)` |
| `--overlay-scrim` | Modal / drawer backdrop | `rgb(10 14 20 / 0.45)` | `rgb(2 3 5 / 0.72)` |

None of these back any component's default styling in this task; they back the new `Card` variants (`metric`, `feature`, `glass`) documented below, which are opt-in.

## Shape

- `--radius-sm` / `-md` / `-lg` / `-xl` / `-full` are unchanged.
- `--radius-pill: 9999px` is a new, semantically distinct alias for the same 9999px value as `--radius-full`: `--radius-full` means "make this a circle/stadium" (avatars, dots); `--radius-pill` means "capsule-shaped control" (nav items, filter chips, the future tactical capsule navigation named in the approved direction). TASK-050 establishes this primitive only; no navigation redesign happens here.

## Spacing and layout

No spacing values changed. Documenting the existing conventions, since TASK-050 was asked to record them rather than invent new ones:

- Page gutters: `Container` uses `px-sm sm:px-lg` (1rem, growing to 2rem at the `sm` breakpoint).
- Content max width: `Container` caps at `--breakpoint-xl` (80rem / 1280px).
- Section spacing: `Section` uses `py-2xl sm:py-3xl` (4rem, growing to 6rem).
- Card padding: `Card`'s `informational` (default) and `interactive` variants keep `p-md` (1.5rem); the `feature` and `editorial` variants use `p-lg` (2rem) for more generous, editorial spacing.
- Dense UI padding: `Badge` uses `px-2xs py-[0.125rem]`; `Input`/`Select` use `px-3` at a fixed `h-10`. No new dense-UI token was needed.
- Responsive adjustments follow the existing `sm:`/`lg:` breakpoint tokens (`--breakpoint-sm` through `--breakpoint-2xl`), unchanged.

## Shadow, glow, and border

`--shadow-sm` / `-md` / `-lg` are unchanged. New tokens:

- `--shadow-floating`: reserved for a future floating/sticky header (TASK-051+), not applied to any component.
- `--glow-cyan` / `--glow-violet` / `--glow-coral`: restrained radial glows built from `color-mix()` against the accent palette. Stronger in dark theme (55-70% mix) than light theme, so light theme never looks "dirty" per the approved direction.
- `--glow-focus`: a soft brand-colored ring, available for a stronger focus treatment in a future task. The existing `focusRing` shared primitive (`packages/ui/src/lib/motion.ts`) is unchanged by this task; every existing interactive element keeps its current focus-visible outline.
- `--glow-selected`: extracted from the exact shadow string `RegionCard.tsx` already hand-writes for its selected state (`0 0 0 1px var(--color-brand-400), 0 0 16px -6px var(--color-brand-400)`), so a future refactor of `RegionCard` (and any new selectable card) can reference the token instead of repeating the arbitrary-value string. `RegionCard.tsx` itself is unchanged by this task.
- `--shadow-inset-highlight`: a subtle top inner highlight for glass/premium surfaces.
- `--border-hairline`: a 1px border color derived from `color-mix(in oklab, var(--foreground) 12%, transparent)`, automatically theme-correct since it derives from the already-theme-swapped `--foreground`.
- `--border-accent`: a direct alias for `--color-brand-400`.

## Motion tokens

`--duration-fast` / `-base` / `-panel`, `--ease-standard` / `-emphasized`, and every existing lift/scale/travel token from TASK-033 are unchanged. New tokens, none consumed by this task:

- `--duration-slow: 480ms`, reserved for the TASK-051 scroll-driven motion engine.
- `--ease-exit`, a mirror of `--ease-emphasized`'s entrance curve for exit/dismiss transitions.
- `--reveal-distance: 24px`, reserved for TASK-051's scroll-reveal system. The existing `ScrollReveal.tsx` component keeps its own current values.

### Reduced-motion policy

Unchanged: the global `prefers-reduced-motion: reduce` block in `tokens.css` already collapses all animation/transition durations to near-zero and disables smooth scrolling site-wide. Any future consumer of the new duration/easing/distance tokens must still gate its own transform-based motion behind `motion-safe:`, exactly as every existing TASK-033/034 interaction does; the blanket duration override does not by itself remove transform/opacity keyframe animations declared with raw `@keyframes`.

## Theme behavior

Dark theme remains the primary authored experience: near-black backgrounds (`#05070a`), a distinct card surface (`#10141b`), and now a further `--surface-raised` step (`#171d28`) for meaningful separation between elevation levels. Glows are stronger in dark theme so accents stay visible without oversaturation.

Light theme keeps its pre-existing surfaces (`--surface: #f7f9fb`, already off-white) and gains the one-step `--background` shift to `#fafbfd` so no page reads as stark pure white. Glows are deliberately weaker in light theme (avoiding a "dirty" look), and every new color pair was contrast-validated against light theme's actual background, not assumed safe by analogy to dark theme.

The theme toggle itself is unchanged by this task.

## Components

### Button (`packages/ui/src/components/Button/Button.tsx`)

`primary`, `secondary`, and `ghost` keep their exact prior class strings; every existing call site renders unchanged. New variants: `tertiary` (text-only, brand-tinted hover), `destructive` (danger token, for irreversible actions), `highEmphasis` (gradient CTA via `--gradient-button`, intended for a single high-emphasis moment per view), and `regionAccented` (domain-agnostic: `packages/ui` has no knowledge of VCT regions, so the caller sets the accent via a `--button-region-color` CSS custom property, falling back to the brand color if unset).

A new `icon` size (`size-10`, square) joins `sm`/`md`/`lg`. A new `loading` prop disables the button, sets `aria-busy`, and swaps its children for the pre-existing shared `Spinner` component (no new spinner implementation).

### Card (`packages/ui/src/components/Card/Card.tsx`)

The pre-existing variant-less `Card` classes are now the `informational` variant and the component's default, so every current call site (which passes no `variant`) renders byte-for-byte identical classes. New variants: `interactive` (hover lift, brand-tinted border, cursor-pointer), `selected` (references `--glow-selected`), `metric` (uses `--surface-raised`), `result` (a top accent border via `--border-accent`, for prediction result cards), `feature` (larger radius/padding/shadow, for landing-page feature cards), `glass` (uses `--surface-glass` with a backdrop blur), and `editorial` (borderless except a bottom hairline, for article-style content blocks).

### Badge (`packages/ui/src/components/Badge/Badge.tsx`)

The pre-existing `neutral` (default), `success`, `danger`, and `brand` tones are unchanged. New tones: `info`, `neutralStatus` (the neutral member of the status-color family, distinct from the pre-existing generic-gray `neutral` tone), and `regionAmericas` / `regionEmea` / `regionPacific` / `regionChina`.

### Input / Select (`packages/ui/src/components/Input`, `.../Select`)

Both gained an `aria-invalid:border-danger aria-invalid:focus-visible:outline-danger` class addition, standardizing the error-state affordance across both controls using the existing `--danger` token. No other change; each renders identically when `aria-invalid` is absent or false.

### Deferred: checkbox, radio, chip, tag, segmented control

The approved direction's form-foundation section calls for standardizing checkbox, radio, chip, tag, and segmented-control primitives. None of these exist anywhere in `packages/ui` today; there is no pre-existing implementation to standardize. Building four to five new components from scratch is a larger scope than "establish the foundation for existing primitives" and was not attempted in this task, consistent with the instruction to implement only the current task and document rather than implement identified improvements. Helper/validation text has an established convention documented here instead of a new component: informational helper text uses `text-body-sm text-muted-foreground`; error/validation text uses `text-body-sm text-danger`. A future task should build the missing form primitives on top of the token foundation established here (the `--danger`/`--info`/`--neutral` semantic colors, the region badge tones, and the shared `focusRing` primitive are all already in place for them to consume).

### RadarChart tooltip

One pre-existing user-facing string (`packages/ui/src/charts/RadarChart/RadarChart.tsx`) used an em dash inside an SVG `<title>` tooltip; it was rewritten to a comma as part of the copy hygiene pass below. No other change to the chart.

## Copy hygiene

### Rule

No em dash (U+2014) or en dash (U+2013) in web-facing copy anywhere in the application: landing page, navigation, footer, Prediction Studio, Comparison Lab, Map Explorer, loading states, error states, helper text, CTA text, badges, and user-facing accessibility labels. Plain ASCII hyphens remain allowed where technically necessary (file names, technical identifiers, CSS class names, date ranges, established hyphenated terms). This does not apply to code comments, engineering documentation, or `docs/*.md`, which are not web-facing copy and keep using conventional prose punctuation.

### What was fixed

30 em dash occurrences were found and rewritten across landing copy, Prediction Studio (breakdown, historical replay, simulator), Comparison Lab, Map Explorer, and one shared chart tooltip, using periods, commas, colons, or a shorter sentence in place of each dash, per the approved style. No en dash occurrences existed. No other copy was rewritten beyond what removing the dash required; broader copy polish is TASK-059.

### Automated protection

`apps/web/src/server/copyHygiene/scanCopyHygiene.ts` walks the TypeScript AST (via the `typescript` compiler API) of every `.ts`/`.tsx` file under `apps/web/src` and `packages/ui/src`, checking only nodes that can render to the page or an accessible name: string literals, template literals, and JSX text. Comments never produce a false positive, since they are not part of the AST for those node kinds, unlike a raw line-based grep, which this codebase's own JSDoc/inline comments (which do use em dashes as prose punctuation) would otherwise trip constantly.

Exclusions: `*.test.ts(x)` / `*.spec.ts(x)` files (not shipped copy), and a small, explicit, documented allowlist of two files that contain real string literals but are not web-facing copy: `apps/web/src/constants/media.ts` (internal asset-manifest engineering notes, never rendered) and `apps/web/src/server/release/releaseSmokeChecks.ts` (CLI/ops smoke-check output, not browser-rendered). The allowlist is intentionally narrow and reviewable rather than a broad directory exclusion, so a genuinely user-facing string added to either file in the future is still caught.

Run it directly with `pnpm copy-hygiene` (root) or `pnpm --filter web run copy-hygiene`. It exits non-zero and prints `file:line:column` plus a source excerpt for every violation, safe to wire into CI with no network access and no build step required. `apps/web/src/server/copyHygiene/scanCopyHygiene.test.ts` unit-tests the detector against fixtures (comment exclusion, ASCII-hyphen non-detection, test-file exclusion, JSX text/string-literal/template-literal detection) and includes a regression test that runs the real scan against this repository's own source tree and fails with the full violation list if anything regresses.

Current scan result: **211 files checked, 0 violations.**

## Migration strategy

This task migrated only the shared primitives explicitly named as safe candidates: global typography (all pages, intentionally), `Button`, `Card`, `Badge`, `Input`, `Select`, and the copy hygiene pass. It did not touch: landing page composition, Prediction Studio layout, Historical Replay, Comparison Lab, Map Explorer, navigation structure, or footer structure. Every new color, gradient, surface, shape, and component variant is additive and unused by any existing page. TASK-051 and later tasks are expected to apply this vocabulary page by page, deliberately, not all at once.

## Accessibility

- Every new color pair (semantic status colors, region colors, and their badge pairs, in both themes) was checked against WCAG's relative-luminance contrast formula and clears 4.5:1 against its theme's actual background; the tightest is 4.52:1 (`--badge-region-americas` in light theme).
- The existing `focusRing` shared primitive, and every existing component's focus-visible treatment, is unchanged.
- `Input`/`Select`'s new `aria-invalid` styling is purely visual (a border/outline color change); it does not alter existing `aria-invalid` semantics or screen-reader behavior.
- `Button`'s new `loading` state sets `aria-busy` and reuses the pre-existing `Spinner`, which already carries `role="status"` and an `aria-label`.
- The full Playwright accessibility suite (axe-core checks across landing, Prediction Studio, Comparison Lab, and Map Explorer, in both themes) passes unchanged after this task's changes.

## Performance

- Both new font faces load via `next/font/google` with `display: "swap"`, self-hosted at build time; there is no `fonts.googleapis.com` runtime request and no layout shift from font-metric mismatch, since `next/font` injects size-adjusted fallback metrics automatically.
- The production bundle's First Load JS is unchanged (192 kB shared, matching the pre-task build) since no new JavaScript dependency was added; the token/CSS additions add a small amount of CSS, not JS.
- No new npm dependency was added anywhere in this task.

## Known limitations

- No page has been visually redesigned. The landing page, Prediction Studio, Comparison Lab, and Map Explorer look the same as before, aside from the font swap and the imperceptible light-theme background shift.
- No scroll-driven motion, parallax, sticky scenes, cursor spotlight change, animated gradients, or page transitions were implemented; `--duration-slow`, `--ease-exit`, and `--reveal-distance` are reserved tokens only.
- Clash Display (or a licensed Cabinet Grotesk/Satoshi/General Sans file) is not yet wired in; `--font-display` currently resolves to Space Grotesk as a documented, user-approved substitute.
- Checkbox, radio, chip, tag, and segmented-control primitives were not built; they do not exist anywhere in the component library yet and were out of scope for a foundation-only task.
- The tactical capsule navigation implied by `--radius-pill` has not been built; only the shape primitive exists.
- Header/footer structure is unchanged; the footer identity update (Phan Huy Hoang, also known as Bernazlt) is scoped to a later task.

## Next step

TASK-051: the motion engine. Scroll-driven storytelling, parallax, sticky scenes, and page transitions, built on top of the `--duration-slow`, `--ease-exit`, and `--reveal-distance` tokens reserved (but unused) by this task.
