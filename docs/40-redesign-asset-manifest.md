python -c "from pathlib import Path; Path('docs').mkdir(exist_ok=True); Path('docs/40-redesign-asset-manifest.md').write_text('''# Redesign Asset Manifest

## Asset Root

Public directory:

`apps/web/public/assets/redesign`

Runtime URL prefix:

`/assets/redesign`

## Global Rules

- Production assets only
- Do not keep drafts, failed outputs, or duplicate files in the public directory
- Desktop pipeline and CTA artwork use 2520 x 1080 unless noted otherwise
- Supporting visuals use 1920 x 1200
- Mobile artwork uses 1080 x 1440
- Hero layers must use the same canvas dimensions and absolute alignment
- Only the hero background layer may contain a full opaque background
- All other hero layers and overlays require real RGBA transparency
- Decorative images use empty alt text
- Preserve official logos, map thumbnails, charts, icons, and data diagrams
- Respect prefers-reduced-motion
- Do not display generated readable text, fake logos, or fake interface labels

# Landing Hero Layers

Render order:

1. Background
2. Jett
3. Omen
4. Map core
5. HUD
6. Foreground

## Layer 01 Background

File: `/assets/redesign/hero/layers/landing-hero-layer-01-background.png`

Transparency: Not required
Full opaque canvas: Allowed

## Layer 02 Jett

File: `/assets/redesign/hero/layers/landing-hero-layer-02-jett.png`

Transparency: Required, real RGBA alpha
Full opaque canvas: Not allowed

## Layer 03 Omen

File: `/assets/redesign/hero/layers/landing-hero-layer-03-omen.png`

Transparency: Required, real RGBA alpha
Full opaque canvas: Not allowed

## Layer 04 Map Core

File: `/assets/redesign/hero/layers/landing-hero-layer-04-map-core.png`

Transparency: Required, real RGBA alpha
Full opaque canvas: Not allowed

## Layer 05 HUD

File: `/assets/redesign/hero/layers/landing-hero-layer-05-hud.png`

Transparency: Required, real RGBA alpha
Full opaque canvas: Not allowed

## Layer 06 Foreground

File: `/assets/redesign/hero/layers/landing-hero-layer-06-foreground.png`

Transparency: Required, real RGBA alpha
Full opaque canvas: Not allowed

# Pipeline Story

- `/assets/redesign/pipeline/pipeline-scene-01-raw-data.png`
- `/assets/redesign/pipeline/pipeline-scene-02-structured-features.png`
- `/assets/redesign/pipeline/pipeline-scene-03-analytical-knowledge.png`
- `/assets/redesign/pipeline/pipeline-scene-04-model-core.png`
- `/assets/redesign/pipeline/pipeline-scene-05-prediction-output.png`
- `/assets/redesign/pipeline/pipeline-scene-06-explanation-network.png`

Dimensions: 2520 x 1080
Aspect ratio: 21:9
Crop: Do not crop

# Tool Headers

## Desktop

- `/assets/redesign/tool-headers/prediction-studio-header.png`
- `/assets/redesign/tool-headers/historical-replay-header.png`
- `/assets/redesign/tool-headers/comparison-lab-header.png`
- `/assets/redesign/tool-headers/map-explorer-header.png`

Dimensions: 2520 x 1080

## Mobile

- `/assets/redesign/tool-headers/prediction-studio-header-mobile.png`
- `/assets/redesign/tool-headers/historical-replay-header-mobile.png`
- `/assets/redesign/tool-headers/comparison-lab-header-mobile.png`
- `/assets/redesign/tool-headers/map-explorer-header-mobile.png`

Dimensions: 1080 x 1440

# Supporting Visuals

- `/assets/redesign/supporting/prediction-result-visual.png`
- `/assets/redesign/supporting/historical-archive-visual.png`
- `/assets/redesign/supporting/historical-reconstruction-visual.png`
- `/assets/redesign/supporting/comparison-rivalry-visual.png`
- `/assets/redesign/supporting/comparison-profile-visual.png`
- `/assets/redesign/supporting/map-hologram-visual.png`
- `/assets/redesign/supporting/map-control-zones-visual.png`
- `/assets/redesign/supporting/tournament-coverage-visual.png`

Dimensions: 1920 x 1200
Aspect ratio: 8:5

# CTA Artwork

- `/assets/redesign/cta/landing-final-cta.png`
- `/assets/redesign/cta/landing-final-cta-mobile.png`
- `/assets/redesign/cta/prediction-studio-cta.png`
- `/assets/redesign/cta/comparison-lab-cta.png`
- `/assets/redesign/cta/map-explorer-cta.png`

Desktop dimensions: 2520 x 1080
Mobile dimensions: 1080 x 1440

# Textures

- `/assets/redesign/textures/tactical-grid.png`
- `/assets/redesign/textures/blueprint-contours.png`
- `/assets/redesign/textures/chromatic-fog.png`
- `/assets/redesign/textures/subtle-grain.png`
- `/assets/redesign/textures/particle-field.png`
- `/assets/redesign/textures/scan-lines.png`
- `/assets/redesign/textures/data-streams.png`
- `/assets/redesign/textures/map-coordinates.png`

# Overlays

- `/assets/redesign/overlays/blueprint-scratches.png`
- `/assets/redesign/overlays/radial-rings.png`
- `/assets/redesign/overlays/light-streaks.png`
- `/assets/redesign/overlays/glass-fragments.png`
- `/assets/redesign/overlays/tactical-brackets.png`
- `/assets/redesign/overlays/spatial-scan-wave.png`
- `/assets/redesign/overlays/map-scan.png`
- `/assets/redesign/overlays/node-network.png`
- `/assets/redesign/overlays/chromatic-haze.png`

All overlay assets require real RGBA transparency.

# Final Validation Checklist

- All files exist at the documented paths
- Filenames use lowercase kebab-case
- No duplicate extensions
- Dimensions match this manifest
- Hero layers align on the same canvas
- Transparency is real where required
- No generated readable text
- No fake logos
- No watermarks
- Public directory contains production assets only