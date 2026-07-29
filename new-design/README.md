# Handoff: RallyHub Team-Gaming Dashboard

## Overview
A web dashboard for a corporate team-building gaming platform ("RallyHub"). Organisers create games (Photo/Video/Text/Puzzle/Quiz/Music Bingo), assemble them into multi-stage live Events (Quest/Quiz/Bingo/Break stages) for teams, manage a Music Library, an Organisation profile, Billing, Support tickets, and their own Account.

## About the Design Files
The file in this bundle (`Gaming Dashboard - Professional.dc.html`) is a **design reference built in HTML/inline-React** — a prototype showing intended look, layout and interaction, not production code to copy directly. The task is to **recreate this design in your app's real environment** (whatever framework/component library/state management you already use) — or choose the most suitable stack if this is greenfield. Do not literally embed this HTML file in the app; treat every color, spacing value, and interaction pattern below as the spec to reimplement with real components, real data, and real auth/session/API integration.

## Fidelity
**High-fidelity.** Colors, type, spacing and component states are final; recreate pixel-for-pixel where practical, adapting only to your codebase's component primitives.

## Global layout
- App shell: fixed-height flex row — collapsible left sidebar (`168px` expanded / `64px` collapsed, animates via `transition: width .15s ease`) + a `40px`-tall header + a scrollable main content area.
- Sidebar: logo, 5 nav items with icon + label (Dashboard/Overview, Games, Events, Organisation, Billing), a collapse toggle, and a bottom-anchored "Support" button + user-menu gear icon.
- Header (40px): search input (240px) → New Game / New Event buttons → divider → theme toggle, Help, Exit icons → divider → 24px circular avatar (opens Account page).
- Color system (light mode):
  - `--color-bg:#F7F7F8` `--color-surface:#FFFFFF` `--color-text:#1F2126` `--color-divider:rgba(31,33,38,.14)`
  - Accent (gold): `--color-accent:#FEC10A` with tints `100…900` from `#FFF4D6` to `#453400`
  - Accent-2 (slate): `--color-accent-2:#2B2E36` with tints `100…900` from `#EDEEF0` to `#121317`
  - Neutral ramp `100…900`: `#F7F7F8 → #1A1B1F`
  - Danger red used ad hoc: `#C0392B`
- Dark mode: same component styles, only the CSS custom properties swap (see Design Tokens) — bg/surface/text/divider invert, and the neutral + accent-2 ramps mirror (100↔900). Implement as a theme provider / CSS variable swap, not per-component overrides.
- Typography: Inter throughout; headings use `font-family: var(--font-heading)` at weight 700; body text default; `.text-muted` for secondary text (neutral-500/600).
- Radii: `--radius-sm:3px` `--radius-md:6px` `--radius-lg:10px`. Buttons/pills that need fully round use `border-radius:999px`.
- Cards: white surface, `1px solid var(--color-divider)` border (implicit via `.card` styles), consistent internal padding, `.card-title` / `.card-body` / `.card-kicker` (uppercase 10–11px label) text roles.

## Screens / Views

### 1. Dashboard (Overview)
- Purpose: landing page with stat cards (Available Games, Upcoming Events), a chart placeholder, and a Recent Activity feed (icon + text + relative time).

### 2. Games (3 tabs: Games Library / Music Library / Deleted Games)
- **Games Library**: filter chips (All/Photo/Video/Text/Quiz/Bingo), a Group filter `<select>` (All Groups + custom groups), an "+ Add Games" button that appears once a specific group is selected, and a responsive grid of small game cards (cover placeholder + type badge, name, points).
- **"Add Group" quick action**: modal — name field (create mode) or "Add Games to {group}" header (add-to mode), a source-group `<select>`, type filter chips, select-all, scrollable checkbox list of games, Cancel/Confirm.
- **New Game flow**: "+ New Game" opens a 3×2 icon-grid type picker (Photo/Video/Text/Puzzle/Quiz/Music Bingo) modal → opens the Game Editor as a **right slide-over panel (560px, or full-screen via an expand icon)** with: Primary Settings (name, rich-text description via `contenteditable` + a small formatting toolbar, Static↔Range points flip-switch, cover image file-button + URL + preview), type-specific fields (Photo/Video: video link; Text: Type↔Choose style flip-switch + Auto↔Review approval flip-switch + answers/options; Puzzle: 3-way pill toggle Wordle/Crossword/Match-Pairs + a mini puzzle designer incl. a 6×6 crossword grid; Quiz: rounds/time/points + per-round question builder; Music Bingo: clip length + generate button, winning lines, diagonals checkbox), a Facilitator-only panel (solution description/image), and a Preview modal showing a TV/host mock and a phone mock side-by-side.
- **Music Library**: playlist rail (click to filter) + a song table (title/artist/playlists/date/duration) + a mini player bar.
- **Deleted Games**: bulk-select list (checkbox rows) with Restore/Delete actions, a days-left countdown, and the same group/type chip filtering.

### 3. Events
- Header: "+ Games" (opens the New Game type-picker) and "+ Event" (opens the New Event editor). Filter chips (All/Draft/Ready/Demo/Active) + a Date-range picker popover.
- Event cards: name, inline status `<select>` (color-coded pill), date/location row, a 4-column stat strip (Display / UI Colour / Branding swatches / Teams), and actions (Event Links, View, Delete/Archive).
- **Event Links modal**: 3-up grid of QR-code placeholders (Player Join / Spectator View / Host Console) with copy/open/download icons.
- **New/Edit Event editor** (always full-screen; opened either via "+ Event" — blank — or "View" on an existing card — pre-filled, with a Danger Zone):
  - Two-column top row: **Primary Settings** (name, status, date, location, then one row with 3 side-by-side toggles: Display Rank-List↔Orbit, UI Colour White↔Black, Purchase Items Off↔On) | **Branding** (on/off flip-switch, logo upload + tiny preview, 3 colour swatches with hex inputs, and live 16:9 + 9:16 preview cards using a gradient of the brand colours).
  - **Teams** (full width): stepper (min 5; a message shows the per-extra-team cost once above 5), then one row per team = colour-wheel input + name input + hex input.
  - **Stages** (full width): each stage is a card with an editable name, a 4-way pill toggle (Quest/Quiz/Bingo/Break, sliding highlight), and:
    - Quest = multi-select: pick a Group, filter by type chips (All/Photo/Video/Puzzle/Text), select-all, checkbox list, "Save" merges checked into a "Selected — Player Order" list with a **drag-handle to reorder** (native HTML5 drag/drop, opacity + inset-highlight feedback) and a trash-can delete icon per row; once saved the picker collapses behind an "+ Add More" button.
    - Quiz / Bingo = single-select (same picker, but choosing one auto-replaces and the picker stays hidden until removed).
    - Break = a message textarea plus a small minutes/seconds duration field on the same row (right-aligned).
    - "+ Add Stage" and a duplicate Save button both appear again at the bottom of the stage list (not just the header).
    - Any checked-but-unsaved picker selections auto-commit when you switch stage type, change group, add a stage, or hit Save (never silently lost).
  - **Danger Zone** (edit mode only, i.e. only after the event has been saved once): Download all event files / Reset event data (clears teams+stages+branding, keeps name/status/date/location) / Delete this event — styled as a red-bordered card with a red title and a red solid "Delete" button, matching the same Danger Zone pattern used on Organisation and Account pages.

### 4. Organisation
- Two-column: Brand Identity (name, logo dropzone, 3 brand-colour swatches with a popover colour-picker: hex + R/G/B sliders) | Legal & Billing Details (VAT, address, "Manage Payment Details" button).
- Tablet Access card: 4-digit tablet password field, Save button appears only when dirty.
- Team table + role tags.
- Danger Zone (red-bordered card): Delete this account.

### 5. Billing
- Two-column: Current Plan + "Your Free Plan" feature list | Available Plans list + Payments & Invoices table.

### 6. Support
- Centered page. Segmented control: New Ticket / My Tickets.
- **New Ticket**: centered card — Subject, Category select, Details textarea, Upload-a-file ghost button, Submit.
- **My Tickets**: two-column — left = clickable ticket list (selected = accent border); right = an **iMessage-style chat panel**: header with ticket subject/ref + an "Export" button (downloads a plain-text transcript), scrollable message list (rounded 18px bubbles, "me" = blue `#0A84FF` right-aligned, "support" = the app's gold accent left-aligned, each bubble has a small timestamp underneath), and a pill-shaped message input that sends on **Enter** or via a Send button.

### 7. My Account (opened via the header avatar)
- Profile Photo: clicking the circular avatar itself opens the file picker (small upload-icon badge overlaid on the circle, no separate upload/remove buttons); initials fallback when no photo.
- Name renders as plain text next to the photo with a small pencil icon that toggles inline editing (no permanent text box).
- Personal Details card: username, email, phone.
- Password card: current/new/confirm with live mismatch warning and a disabled-until-valid "Update Password" button.
- Danger Zone: Log out of all devices / Delete my account.
- Save/Discard only appear in the page header once something is actually edited (dirty-check against the committed record).

### Global chrome behaviors
- **Search** (header): live dropdown as you type, matching game/event names and ticket subjects; each result is tagged by kind and clicking it navigates to the right page and opens the matching editor/panel. Shows a "No matches" state.
- **Theme toggle**: swaps the entire CSS-variable palette (see Design Tokens) — sun/moon icon reflects state.
- **Help**: opens a modal with a live-searchable list of help articles (title + one-line snippet); no matches → prompt to open a support ticket instead.
- **Exit**: `confirm()` before acting; on confirm, shows a full-screen "You've been logged out" card with a "Log Back In" button.

## Interactions & Behavior (cross-cutting patterns)
- **Flip-switch** (2-state toggle): 52×26px pill, `border-radius:999px`, background `--color-accent-2-800`, a 22px circular accent-coloured thumb sliding via `transform` with `transition: transform .2s cubic-bezier(.4,0,.2,1)`. Labels either side bold+accent-colored when active.
- **3-/4-way pill toggle**: track background `--color-accent-2-800`, one sliding accent-coloured pill indicator behind the options (`position:absolute`, animated via `left` percentage — NOT `transform: translateX` self-referential percentages, which drift out of alignment with 4+ options), option label flips to dark text when it's the active segment.
- **Custom file button**: hidden native `<input type="file">`, a visible pill button with an upload icon + the chosen filename (or "No File"), paired with a plain text input for pasting a URL instead.
- **Drag-to-reorder list**: native HTML5 drag events; dragged row drops to 40% opacity, drop target gets an inset accent ring; reordering triggers a normal state update (no FLIP animation needed — keep it simple).
- **Chip filters**: pill buttons, active = accent fill + dark text, inactive = outline.
- **Danger Zone card**: `1.5px solid #C0392B` border, red card title, each row = label+description on the left, a red action button on the right (outlined for "soft" destructive actions like reset/logout-all, solid red for actual delete).
- **Dirty-check pattern**: editors keep a `draft` object separate from the committed record; Save/Discard controls only render when the draft differs from the committed value.

## Design Tokens

### Colors — light
| Token | Value |
|---|---|
| `--color-bg` | `#F7F7F8` |
| `--color-surface` | `#FFFFFF` |
| `--color-text` | `#1F2126` |
| `--color-divider` | `rgba(31,33,38,.14)` |
| `--color-accent` (100…900) | `#FFF4D6, #FFE9AD, #FFDB74, #FED03D, #FEC10A, #D9A300, #A67D00, #745900, #453400` |
| `--color-accent-2` (100…900) | `#EDEEF0, #D9DBDF, #B8BCC4, #8D93A0, #5C616D, #3F434C, #2B2E36, #1D1F24, #121317` |
| `--color-neutral` (100…900) | `#F7F7F8, #EEEEF0, #DADBDE, #B7B9BE, #8A8D94, #63666D, #454850, #2A2C33, #1A1B1F` |
| Danger | `#C0392B` |
| Chat "me" bubble | `#0A84FF` (iMessage blue, intentionally off-palette) |

### Colors — dark
| Token | Value |
|---|---|
| `--color-bg` | `#15161A` |
| `--color-surface` | `#1E2025` |
| `--color-text` | `#F1F1F3` |
| `--color-divider` | `rgba(255,255,255,.14)` |
| `--color-accent` (100…900) | mirrored: `#453400, #745900, #A67D00, #D9A300, #FEC10A, #FED03D, #FFDB74, #FFE9AD, #FFF4D6` |
| `--color-accent-2` (100…900) | mirrored: `#121317, #1D1F24, #2B2E36, #3F434C, #5C616D, #8D93A0, #B8BCC4, #D9DBDF, #EDEEF0` |
| `--color-neutral` (100…900) | mirrored: `#1A1B1F, #2A2C33, #454850, #63666D, #8A8D94, #B7B9BE, #DADBDE, #EEEEF0, #F7F7F8` |

### Type
- `--font-heading` / `--font-body`: Inter, system-ui fallback. Headings weight 700.

### Radius
- `--radius-sm: 3px` · `--radius-md: 6px` · `--radius-lg: 10px` · pills/switches: `999px`

### Spacing
- Uses a `--space-*` scale (2/3/4/6 used throughout at roughly 8/12/16/24px) — inherited from the base component library the file loads; recreate with your own 4/8px spacing scale, values above are the effective visual result.

## Assets
- All icons are inline Lucide-style SVGs (stroke-width 2), no external icon files.
- No real photography — cover/solution images are placeholder blocks with an "upload or paste a link" pattern; wire these to your real asset storage.

## Files
- `Gaming Dashboard - Professional.dc.html` — the full design reference (single file, all screens, all states). Search it by section comments/`isXxx` state flags (e.g. `isEvents`, `isEventEditorOpen`, `isAccount`, `isSupport`) to find the exact markup/styles for any screen described above.
