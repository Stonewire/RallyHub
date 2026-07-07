---
version: alpha
name: RallyHub
description: Warm neo-minimal design system for RallyHub — a live team-event platform (admin panels, facilitator controls, audience displays, participant play screens).
colors:
  primary: "#FFC107"
  on-primary: "#333333"
  charcoal: "#333333"
  neutral: "#FAF7F2"
  surface-elevated: "#FFFDF9"
  surface-muted: "#ECE6DD"
  surface-inset: "#E6E0D6"
  canvas-white: "#FFFFFF"
  sidebar: "#2B2B2B"
  text-primary: "#333333"
  text-secondary: "#66625C"
  text-muted: "#857F77"
  destructive: "#9B3F3F"
  status-active: "#1F9D55"
  status-demo: "#7C5CFF"
  status-draft: "#B8B8B8"
  dark-canvas: "#262626"
  dark-elevated: "#333333"
  dark-text: "#FAF7F2"
typography:
  display:
    fontFamily: Abril Fatface
    fontSize: 2.25rem
    fontWeight: 400
    lineHeight: 1.15
  h2:
    fontFamily: Abril Fatface
    fontSize: 1.5rem
    fontWeight: 400
    lineHeight: 1.2
  h3:
    fontFamily: Manrope
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: Manrope
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.25rem
  2xl: 1.5rem
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  2xl: 3rem
components:
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "#FAF7F3"
    rounded: "{rounded.md}"
    typography: "{typography.body-sm}"
  button-accent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    typography: "{typography.body-sm}"
  button-ghost:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  sidebar-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "#1A1A1A"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  badge-status:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
---

## Overview

**Warm neo-minimalism.** RallyHub feels like a well-lit workshop, not a cold dashboard: warm ivory surfaces, soft layered shadows, generous rounding, and a single confident gold accent against deep charcoal. The mood is friendly-professional — it runs live team events (quizzes, music bingo, photo challenges) for corporate clients, so it must feel playful enough for a party and trustworthy enough for an admin console.

Two personalities share one system:

- **Admin & facilitator surfaces** — calm, dense-but-airy control panels on white/ivory canvases with a permanently charcoal sidebar.
- **Live event surfaces** (audience display, participant play) — bolder, higher contrast, bigger type, same palette.

Both support a full dark mode (charcoal canvases, ivory text, unchanged gold accent).

## Colors

The palette is warm neutrals + one accent. Gold is precious — use it sparingly.

- **Primary / Gold (#FFC107):** The only accent. Hero CTAs (one per screen), active sidebar rows, focus rings, selection states. Always paired with charcoal text (#333333), never white.
- **Charcoal (#333333):** Brand ink. Primary buttons, headings, body text, and the elevated surface colour in dark mode.
- **Neutral / Warm Ivory (#FAF7F2):** The app's foundation. Softer and warmer than white — never use pure grey backgrounds.
- **Surface layers:** Elevated cards #FFFDF9, muted fills #ECE6DD, inset wells #E6E0D6. Admin content areas sit on a pure white canvas (#FFFFFF) with warm-ivory blocks lifted off it by soft shadows.
- **Sidebar (#2B2B2B):** Always charcoal in both themes; the active row is a gold block with near-black text.
- **Text:** primary #333333, secondary #66625C, muted #857F77 on light; ivory #FAF7F2 on dark.
- **Destructive (#9B3F3F):** Muted brick red — errors and destructive actions only.
- **Status dots:** active green #1F9D55, demo violet #7C5CFF, draft grey #B8B8B8, ready gold, archived warm grey.

**Dark mode:** canvas #262626, elevated surfaces #333333, deepest inset #1F1F1F, text #FAF7F2, borders at 10% ivory. Gold stays #FFC107 with dark text.

## Typography

- **Abril Fatface** (display serif) — H1/H2 and hero moments only. It's the brand's personality: theatrical, confident. Never for body text, labels, or anything below H2.
- **Manrope** (variable sans, weights 200–800) — everything else. UI text defaults to 400–500; buttons and labels 600; sub-headings 700.

Keep the pairing high-contrast: big expressive serif headlines over quiet, tidy sans body.

## Layout

- Generous whitespace; spacing follows a 0.25rem-based scale (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 rem).
- Admin: fixed charcoal sidebar, white content canvas, content organised into warm-ivory cards.
- Live event screens: single-focus layouts, large type, centred content for projector legibility.
- Cards use 24px internal padding; sections separated by 1.5–2rem.

## Elevation & Depth

Depth comes from soft, warm, layered shadows — not hard borders. Three levels:

- **Soft (resting):** `0 1px 2px rgb(62 61 62 / 0.04), 0 4px 12px rgb(62 61 62 / 0.05)`
- **Raised (hover / prominent):** adds a subtle white inner top highlight `0 1px 0 rgb(255 255 255 / 0.75) inset` plus wider blur — a neomorphic lift.
- **Pressed (active):** inset shadow, element translates back to 0.

Interactive cards lift 1px on hover and press flat on click. Gold elements may use an accent glow: `0 3px 12px rgb(255 193 7 / 0.28)`. Borders are whisper-thin: 8–12% charcoal on light, 10–16% ivory on dark.

## Shapes

Everything is softly rounded. Small controls 0.5rem, buttons and inputs 0.75rem, cards 1rem, large containers 1.25–1.5rem. No sharp corners, no full-pill buttons.

## Components

- **Primary button:** charcoal fill, warm-white text, raised shadow; hover darkens slightly and lifts 1px; active presses in. The workhorse action.
- **Accent button:** gold fill (softened ~88% toward white), charcoal text — the hero CTA. Strictly one per screen.
- **Ghost/secondary button:** transparent or ivory fill with a thin border.
- **Cards:** elevated ivory surface, thin border, soft shadow; interactive cards get the hover-lift treatment.
- **Sidebar navigation:** charcoal background, ivory text at rest, 7%-ivory hover fill, and a solid gold active row with near-black text and icon.
- **Inputs:** white fill, thin charcoal-tinted border, gold focus ring at ~35–45% opacity.
- **Status badges:** muted warm fill with a coloured status dot, small radius.
- **Transitions:** 180ms cubic-bezier(0.4, 0, 0.2, 1) on shadow, transform, and colour.

## Do's and Don'ts

- **Do** keep gold rare — one accent moment per screen; everything else is charcoal and ivory.
- **Do** use Abril Fatface only for H1/H2; it loses its magic when overused.
- **Do** create depth with soft warm shadows instead of hard outlines.
- **Do** keep the sidebar charcoal in both light and dark themes.
- **Don't** use pure white text on gold — gold always carries dark text.
- **Don't** introduce cool greys or pure-grey backgrounds; every neutral is warm.
- **Don't** use harsh pure-black (#000) anywhere; deepest ink is #1A1A1A.
- **Don't** add borders heavier than ~12% opacity; the aesthetic is border-light, shadow-led.
