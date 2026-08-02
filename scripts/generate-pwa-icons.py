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


# iOS launch images have to match a device exactly. CSS points and the pixel
# ratio, not pixels: that is what the media query compares against.
# (width, height, dpr, what it covers)
DEVICES = [
    (320, 568, 2, 'iPhone SE 1st gen'),
    (375, 667, 2, 'iPhone 8, SE 2nd and 3rd gen'),
    (414, 736, 3, 'iPhone 8 Plus'),
    (375, 812, 3, 'iPhone X, XS, 11 Pro, 12 mini, 13 mini'),
    (390, 844, 3, 'iPhone 12, 13, 14'),
    (393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'),
    (402, 874, 3, 'iPhone 16 Pro'),
    (414, 896, 2, 'iPhone XR, 11'),
    (414, 896, 3, 'iPhone XS Max, 11 Pro Max'),
    (428, 926, 3, 'iPhone 12, 13, 14 Pro Max'),
    (430, 932, 3, 'iPhone 14 Pro Max, 15 Plus and Pro Max, 16 Plus'),
    (440, 956, 3, 'iPhone 16 Pro Max'),
    (768, 1024, 2, 'iPad 9.7 inch'),
    (810, 1080, 2, 'iPad 10.2 inch'),
    (820, 1180, 2, 'iPad Air 10.9 inch'),
    (834, 1112, 2, 'iPad Pro 10.5 inch'),
    (834, 1194, 2, 'iPad Pro 11 inch'),
    (1024, 1366, 2, 'iPad Pro 12.9 inch'),
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


def fit(mark: Image.Image, box: float) -> Image.Image:
    """Scale the mark to fit a square box without distorting it."""
    # resize, not thumbnail: thumbnail only ever shrinks, which silently left
    # the 512 icons at the mark's own smaller size.
    ratio = min(box / mark.width, box / mark.height)
    return mark.resize(
        (max(1, round(mark.width * ratio)), max(1, round(mark.height * ratio))),
        Image.LANCZOS,
    )


def compose(mark: Image.Image, width: int, height: int, box: float) -> Image.Image:
    """The mark centred on an opaque charcoal rectangle."""
    scaled = fit(mark, box)
    canvas = Image.new('RGBA', (width, height), (*CHARCOAL, 255))
    canvas.paste(
        scaled,
        ((width - scaled.width) // 2, (height - scaled.height) // 2),
        scaled,
    )
    # Flatten to RGB: no alpha channel at all, so no platform gets to pick its
    # own backdrop.
    return canvas.convert('RGB')


def build_icons(mark: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, size, scale in TARGETS:
        image = compose(mark, size, size, size * scale)
        image.save(OUT_DIR / name, 'PNG', optimize=True)
        print(f'{name}: {size}x{size}')


def build_splashes(mark: Image.Image) -> None:
    """
    iOS launch images, plus the link tags that select them.

    Safari shows a blank white screen while an installed app boots unless it
    finds an apple-touch-startup-image whose media query matches the device
    exactly, which is why this is a long list rather than one file: there is no
    scaling and no fallback. A device with no match simply gets the blank
    screen it would have had anyway, so the list degrades quietly as Apple ships
    new sizes.
    """
    splash_dir = OUT_DIR / 'splash'
    splash_dir.mkdir(parents=True, exist_ok=True)

    tags: list[str] = []
    for css_w, css_h, dpr, label in DEVICES:
        for orientation in ('portrait', 'landscape'):
            # The media query is in CSS points and swaps with the orientation;
            # the file itself is in device pixels.
            w, h = (css_w, css_h) if orientation == 'portrait' else (css_h, css_w)
            px_w, px_h = w * dpr, h * dpr

            name = f'{w}x{h}@{dpr}x.png'
            # A quarter of the short edge: big enough to read on a phone, small
            # enough that an iPad does not get a billboard.
            image = compose(mark, px_w, px_h, min(px_w, px_h) * 0.25)
            image.save(splash_dir / name, 'PNG', optimize=True)

            tags.append(
                '    <link\n'
                '      rel="apple-touch-startup-image"\n'
                f'      media="(device-width: {w}px) and (device-height: {h}px)'
                f' and (-webkit-device-pixel-ratio: {dpr})'
                f' and (orientation: {orientation})"\n'
                f'      href="/brand/pwa/splash/{name}"\n'
                '    />'
            )
        print(f'splash: {label}')

    # Beside the script, not under public/, so a build artefact is not served.
    fragment = Path(__file__).resolve().parent / 'pwa-splash-link-tags.html'
    fragment.write_text('\n'.join(tags) + '\n')
    print(f'\n{len(tags)} link tags written to {fragment.relative_to(ROOT)}')
    print('Paste them into index.html when this list changes.')


def main() -> None:
    mark = load_mark()
    print(f'mark rendered at {mark.width}x{mark.height}')
    build_icons(mark)
    build_splashes(mark)


if __name__ == '__main__':
    main()
