#!/usr/bin/env python3
"""Build the home-screen icon set from the brand mark.

    python3 scripts/generate-pwa-icons.py

Needs Pillow (`pip3 install Pillow`) and macOS, because it rasterises the logo
with `sips`. The generated PNGs are committed, so this only has to run when the
mark itself changes.

The mark is taken from public/powered-by-rallyhub-dark.svg rather than
public/brand/icon-yellow.png, because that PNG is only 285x271 and a 512 icon
would have to be upscaled. The SVG is rendered large, the mark is cropped out of
the lockup, and only its alpha channel is kept, so the charcoal fill in the file
is irrelevant and the mark is repainted in brand yellow at full sharpness.

Every icon is that mark centred on an opaque charcoal square. Opaque matters:
iOS composites a transparent home-screen icon onto black and Android does the
same behind a maskable icon, so leaving the alpha in produces a different colour
on each platform.

Two crops are produced. The `any` icons sit the mark at 76% of the canvas, which
is what a browser tab or a desktop shortcut shows verbatim. The `maskable` icons
sit it at 56%, because Android crops a maskable icon to an arbitrary shape and
only guarantees the circle covering the middle 80% survives: a square of side s
has a diagonal of s * 1.414, so s must stay under 0.8 / 1.414 = 56.5% of the
canvas for the corners of the mark to be safe in every mask.
"""

import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_SVG = ROOT / 'public' / 'powered-by-rallyhub-dark.svg'
OUT_DIR = ROOT / 'public' / 'brand' / 'pwa'

YELLOW = (255, 193, 7)  # #FFC107, --nm-yellow
CHARCOAL = (26, 26, 26)  # #1a1a1a

RENDER_WIDTH = 4096

# The lockup is "Powered By:" across the top and the mark to the left of the
# wordmark below it. This window holds the mark and nothing else; the exact
# bounds are then found from the alpha channel, so it only has to be roughly
# right.
MARK_WINDOW = (0.0, 0.34, 0.23, 1.0)  # left, top, right, bottom as fractions

ANY_SCALE = 0.76
MASKABLE_SCALE = 0.56

# (filename, canvas size, mark scale)
TARGETS = [
    ('icon-192.png', 192, ANY_SCALE),
    ('icon-512.png', 512, ANY_SCALE),
    ('maskable-192.png', 192, MASKABLE_SCALE),
    ('maskable-512.png', 512, MASKABLE_SCALE),
    ('apple-touch-icon-180.png', 180, ANY_SCALE),
    ('favicon-32.png', 32, ANY_SCALE),
    ('favicon-16.png', 16, ANY_SCALE),
]


def load_mark() -> Image.Image:
    """Render the logo, cut the mark out of it, and repaint it yellow."""
    with tempfile.TemporaryDirectory() as tmp:
        rendered = Path(tmp) / 'logo.png'
        subprocess.run(
            ['sips', '-s', 'format', 'png', '-Z', str(RENDER_WIDTH),
             str(SOURCE_SVG), '--out', str(rendered)],
            check=True, capture_output=True,
        )
        lockup = Image.open(rendered).convert('RGBA')

    width, height = lockup.size
    left, top, right, bottom = MARK_WINDOW
    window = lockup.crop((
        round(width * left), round(height * top),
        round(width * right), round(height * bottom),
    ))

    bounds = window.getbbox()
    if not bounds:
        raise SystemExit('No mark found in the crop window; MARK_WINDOW is wrong.')
    window = window.crop(bounds)

    # Keep the shape, drop the colour: a flat yellow layer wearing the mark's
    # alpha, so the antialiased edges stay clean instead of fading to charcoal.
    mark = Image.new('RGBA', window.size, (*YELLOW, 0))
    mark.putalpha(window.getchannel('A'))
    return mark


def main() -> None:
    mark = load_mark()
    print(f'mark rendered at {mark.width}x{mark.height}')

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, size, scale in TARGETS:
        box = size * scale
        # Fit inside the box without distorting: whichever side is longer sets
        # the scale. resize, not thumbnail, so small canvases shrink and the
        # 512s are not silently left at the mark's own size.
        ratio = min(box / mark.width, box / mark.height)
        scaled = mark.resize(
            (max(1, round(mark.width * ratio)), max(1, round(mark.height * ratio))),
            Image.LANCZOS,
        )

        canvas = Image.new('RGBA', (size, size), (*CHARCOAL, 255))
        canvas.paste(
            scaled,
            ((size - scaled.width) // 2, (size - scaled.height) // 2),
            scaled,
        )

        # Flatten to RGB: no alpha channel at all, so no platform gets to pick
        # its own backdrop.
        canvas.convert('RGB').save(OUT_DIR / name, 'PNG', optimize=True)
        print(f'{name}: {size}x{size} (mark {scaled.width}x{scaled.height})')


if __name__ == '__main__':
    main()
