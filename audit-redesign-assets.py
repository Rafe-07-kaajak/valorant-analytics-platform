from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path('apps/web/public/assets/redesign')

@dataclass(frozen=True)
class AssetRule:
    relative_path: str
    expected_size: tuple[int, int] | None = None
    require_alpha: bool = False
    require_transparent_pixels: bool = False

RULES = (
    AssetRule('hero/desktop/landing-hero-master.png'),
    AssetRule('hero/mobile/landing-hero-mobile.png', (1080, 1440)),
    AssetRule('hero/layers/landing-hero-layer-01-background.png'),
    AssetRule('hero/layers/landing-hero-layer-02-jett.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('hero/layers/landing-hero-layer-03-omen.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('hero/layers/landing-hero-layer-04-map-core.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('hero/layers/landing-hero-layer-05-hud.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('hero/layers/landing-hero-layer-06-foreground.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('pipeline/pipeline-scene-01-raw-data.png', (2520, 1080)),
    AssetRule('pipeline/pipeline-scene-02-structured-features.png', (2520, 1080)),
    AssetRule('pipeline/pipeline-scene-03-analytical-knowledge.png', (2520, 1080)),
    AssetRule('pipeline/pipeline-scene-04-model-core.png', (2520, 1080)),
    AssetRule('pipeline/pipeline-scene-05-prediction-output.png', (2520, 1080)),
    AssetRule('pipeline/pipeline-scene-06-explanation-network.png', (2520, 1080)),
    AssetRule('tool-headers/prediction-studio-header.png', (2520, 1080)),
    AssetRule('tool-headers/prediction-studio-header-mobile.png', (1080, 1440)),
    AssetRule('tool-headers/historical-replay-header.png', (2520, 1080)),
    AssetRule('tool-headers/historical-replay-header-mobile.png', (1080, 1440)),
    AssetRule('tool-headers/comparison-lab-header.png', (2520, 1080)),
    AssetRule('tool-headers/comparison-lab-header-mobile.png', (1080, 1440)),
    AssetRule('tool-headers/map-explorer-header.png', (2520, 1080)),
    AssetRule('tool-headers/map-explorer-header-mobile.png', (1080, 1440)),
    AssetRule('supporting/prediction-result-visual.png', (1920, 1200)),
    AssetRule('supporting/historical-archive-visual.png', (1920, 1200)),
    AssetRule('supporting/historical-reconstruction-visual.png', (1920, 1200)),
    AssetRule('supporting/comparison-rivalry-visual.png', (1920, 1200)),
    AssetRule('supporting/comparison-profile-visual.png', (1920, 1200)),
    AssetRule('supporting/map-hologram-visual.png', (1920, 1200)),
    AssetRule('supporting/map-control-zones-visual.png', (1920, 1200)),
    AssetRule('supporting/tournament-coverage-visual.png', (1920, 1200)),
    AssetRule('cta/landing-final-cta.png', (2520, 1080)),
    AssetRule('cta/landing-final-cta-mobile.png', (1080, 1440)),
    AssetRule('cta/prediction-studio-cta.png', (2520, 1080)),
    AssetRule('cta/comparison-lab-cta.png', (2520, 1080)),
    AssetRule('cta/map-explorer-cta.png', (2520, 1080)),
    AssetRule('textures/tactical-grid.png', (2048, 2048)),
    AssetRule('textures/blueprint-contours.png', (2048, 2048)),
    AssetRule('textures/chromatic-fog.png', (2048, 1024)),
    AssetRule('textures/subtle-grain.png', (2048, 2048)),
    AssetRule('textures/particle-field.png', (2048, 2048)),
    AssetRule('textures/scan-lines.png', (2048, 2048)),
    AssetRule('textures/data-streams.png', (2048, 1024)),
    AssetRule('textures/map-coordinates.png', (2048, 2048)),
    AssetRule('overlays/blueprint-scratches.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('overlays/radial-rings.png', (2048, 2048), True, True),
    AssetRule('overlays/light-streaks.png', (2048, 1024), True, True),
    AssetRule('overlays/glass-fragments.png', (2048, 2048), True, True),
    AssetRule('overlays/tactical-brackets.png', (2048, 2048), True, True),
    AssetRule('overlays/spatial-scan-wave.png', require_alpha=True, require_transparent_pixels=True),
    AssetRule('overlays/map-scan.png', (2048, 2048), True, True),
    AssetRule('overlays/node-network.png', (2048, 2048), True, True),
    AssetRule('overlays/chromatic-haze.png', (2048, 1024), True, True),
)

BANNED_NAME_PARTS = ('.png.png', 'final-final', 'final-2', 'gemini-output', 'checkerboard', '-old', '_old', '-test', '_test')


def inspect_png(path: Path):
    with Image.open(path) as image:
        size = image.size
        mode = image.mode
        if 'A' not in image.getbands():
            return size, mode, None, None
        alpha = image.getchannel('A')
        lo, hi = alpha.getextrema()
        return size, mode, int(lo), int(hi)


def main() -> int:
    errors = []
    warnings = []

    print(f'Auditing: {ROOT.resolve()}')
    print()

    if not ROOT.exists():
        print(f'[FAIL] Asset root does not exist: {ROOT}')
        return 1

    for file_path in (p for p in ROOT.rglob('*') if p.is_file()):
        rel = file_path.relative_to(ROOT)
        lower_name = file_path.name.lower()
        if file_path.suffix.lower() != '.png':
            warnings.append(str(rel))
            print(f'[WARN] Non-PNG production asset: {rel}')
        if lower_name != file_path.name:
            errors.append(str(rel))
            print(f'[FAIL] Filename is not lowercase: {rel}')
        if ' ' in file_path.name or '_' in file_path.name:
            errors.append(str(rel))
            print(f'[FAIL] Filename is not lowercase kebab-case: {rel}')
        if any(part in lower_name for part in BANNED_NAME_PARTS):
            errors.append(str(rel))
            print(f'[FAIL] Suspicious draft or duplicate filename: {rel}')

    print('\nChecking documented assets\n--------------------------')
    layer_sizes = {}

    for rule in RULES:
        path = ROOT / rule.relative_path
        if not path.exists():
            errors.append(rule.relative_path)
            print(f'[FAIL] Missing file: {rule.relative_path}')
            continue
        try:
            size, mode, alpha_min, alpha_max = inspect_png(path)
        except Exception as exc:
            errors.append(rule.relative_path)
            print(f'[FAIL] Cannot open {rule.relative_path}: {exc}')
            continue

        ok = True
        if rule.expected_size and size != rule.expected_size:
            ok = False
            errors.append(rule.relative_path)
            print(f'[FAIL] Wrong size: {rule.relative_path} is {size[0]}x{size[1]}, expected {rule.expected_size[0]}x{rule.expected_size[1]}')
        if rule.require_alpha and alpha_min is None:
            ok = False
            errors.append(rule.relative_path)
            print(f'[FAIL] No alpha channel: {rule.relative_path} mode={mode}')
        if rule.require_transparent_pixels and alpha_min is not None and alpha_min != 0:
            ok = False
            errors.append(rule.relative_path)
            print(f'[FAIL] No fully transparent pixels: {rule.relative_path} alpha_min={alpha_min}')
        if rule.relative_path.startswith('hero/layers/'):
            layer_sizes[rule.relative_path] = size
        if ok:
            alpha_note = '' if alpha_min is None else f', alpha={alpha_min}..{alpha_max}'
            print(f'[ OK ] {rule.relative_path}: {size[0]}x{size[1]}, mode={mode}{alpha_note}')

    print('\nChecking hero layer alignment\n-----------------------------')
    unique_sizes = set(layer_sizes.values())
    if len(unique_sizes) > 1:
        detail = ', '.join(f'{Path(path).name}={size[0]}x{size[1]}' for path, size in sorted(layer_sizes.items()))
        errors.append('hero-layer-size-mismatch')
        print(f'[FAIL] Hero layer canvases do not match: {detail}')
    elif len(unique_sizes) == 1:
        size = next(iter(unique_sizes))
        print(f'[ OK ] All hero layer canvases match: {size[0]}x{size[1]}')

    print('\nSummary\n-------')
    print(f'Errors:   {len(errors)}')
    print(f'Warnings: {len(warnings)}')
    if errors:
        print('\nTASK 052 asset audit failed. Fix every [FAIL] item, then run again.')
        return 1
    print('\nTASK 052 asset audit passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
