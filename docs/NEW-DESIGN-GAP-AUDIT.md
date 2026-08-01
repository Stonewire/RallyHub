# New design vs implementation: full gap audit

Date: 2026-08-01
Branch: `feature/new-design`
Design reference: `new-design/Gaming Dashboard - Professional.dc.html` plus `new-design/README.md`
Method: five parallel audits, one per surface, each comparing the design HTML against the real implementation and against `main` (the pre-redesign app).

The design is a prototype. Where it disagrees with the running app, the app is often right, because the app has years of real constraints behind it. This document separates those cases from genuine gaps.

---

## 1. Design fields with no database column

These cannot be built as UI alone. Each needs a schema change first. Listed worst first.

| Field | Where the design shows it | Status today |
|---|---|---|
| **Event location** | Event editor Primary Settings, and a pin row on every event card | No `location` column on `events`. Not built. |
| **Ticket category** | Support, New Ticket form | No `category` column on `support_tickets`. **Currently faked**: the value is concatenated into the ticket body as `Category: X\n\n...`. Support staff cannot filter or report on it. |
| **Profile photo** | My Account, and the header avatar | No `avatar_url` on `profiles`. **The card is shipped and does nothing** (see section 2). |
| **Profile phone** | My Account, Personal Details | No `phone` on `profiles` (only on `organizations`). Not built. |
| **Ticket file attachment** | Support, "Upload a File" | No attachments table or bucket. Button ships visibly disabled. |
| **Current password** | My Account, Password card | No re-authentication endpoint exists. Field omitted, so password changes need no current password. |
| **Quiz points per correct answer** | Game editor, Quiz | No field in `GameConfig`. Not built. |
| **Text game approval mode (Auto vs Review)** | Game editor, Text | No storage field. App infers judging from `points_type === 'range'` instead. |
| **Deleted By** | Deleted Games table column | No `deleted_by` column. Column omitted. |
| **Stat card "+2 from last week"** | Dashboard stat cards | No historical comparison in the data. Deliberately omitted rather than faked. |

---

## 2. Shipped but non-functional

These read as finished features to anyone clicking around. They are the most damaging category, because they promise something and silently do nothing.

1. **Profile Photo card** (`MyAccountPanel.tsx:180-187`). Renders an avatar with an upload badge. There is no click target, no file input, no handler, no column. Nothing happens.
2. **Help Centre modal** (`HelpModal.tsx:9`). `HELP_ARTICLES` is an empty array, so the search box can only ever return the empty state. The design ships 6 articles. Article rows are also not clickable.
3. **Upload a File** on Support (`SupportPage.tsx:147`). Permanently disabled.
4. **Logo dropzone** on Organisation. Says "Drag & drop your logo here" but has no drop handler, so it is click-only. Says "Max 2MB" but `handleLogoChange` enforces no size or type limit.
5. **"Manage Payment Details"** on Organisation carries an external-link icon but routes internally to the Billing tab, not to Paddle.

---

## 3. Contradictions needing a decision

The design and the running code state different facts. These are not implementation gaps, they are conflicts where somebody has to choose. Several are customer facing.

### Billing and pricing (highest risk, all customer facing)
| Topic | Design says | Code says |
|---|---|---|
| Free plan event limit | "Maximum 1 event per month" | `rookie.monthlyEventLimit: null`, i.e. unlimited |
| Free plan team limit | "Maximum of 2 team users" | `teamLimit: 5`, and it means teams per event, not users |
| Starter price | EUR 15/mo | EUR 20/mo |
| Pro price | EUR 25/mo | EUR 200/mo |
| Business tier | Exists, EUR 45/mo, EUR 49 per event | Does not exist at all |
| VAT | Invoice column reads "Total (incl. VAT)" | `VAT_DISCLAIMER = 'All prices exclude VAT.'`, shown in three places |

### Behaviour
| Topic | Design says | Code says |
|---|---|---|
| **Reset event data** | Clears teams, stages and branding; keeps name, status, date, location | Clears teams, submissions, scores, chat and live progress; **keeps** games, stages and branding. The semantics are inverted. |
| Wordle scoring | Each guess costs 5%, floor 10% | Each extra guess removes 10% of remaining |
| Match Pairs scoring | Each mistake costs 10% | Each incorrect match costs 5% |
| Bingo clip length | 30 / 60 / 90 seconds | Type permits `30 | 90` only. Adding 60 is a schema plus clip-generation change. |
| Quiz rounds | A "Rounds" number input | A round builder with named rounds and an enable toggle |
| Team minimum | Minimum 5 teams, enforced | Floor is 1 |
| Delete an Active event | Button label flips to "Archive" | Always says "Delete", always soft-deletes to Bin |

My recommendation on the two that matter most: keep the **app's** reset semantics (safer, and clearing branding on reset would surprise people) and change the design copy; and treat the **code** as the source of truth on pricing until you confirm otherwise, since those numbers are live.

---

## 4. In the design, not yet built

Ordered roughly by user impact.

**Organisation**
- Colour picker popover with hex plus R/G/B sliders. Currently the swatch opens the OS colour picker. This is the single largest unbuilt piece on that screen.
- Country is a free-text field; the design specifies a fixed dropdown.
- Tablet Access "Save" is wired to the page-wide dirty flag, so editing the org name makes it appear. The design intends it to track only the PIN field.

**Billing**
- "Upgrade Plan" and "Cancel Plan" buttons. There is no cancel-subscription control anywhere in the app; cancellation only happens as a side effect of account deletion.
- Per-plan "Upgrade" / "Current plan" buttons on the plan cards.
- Invoices render as cards, not the design's table with Date / Event Name / Total / Status columns.

**Games**
- Preview modal (TV mock plus phone mock side by side). Absent entirely.
- Background Designer for Quiz and Music Bingo (Image vs Colours switch, 4 swatches, live previews). Only 3 plain colour inputs exist, and they are unreachable when editing an existing quiz.
- Cover image and solution image "paste a URL" inputs. File upload only.
- Solution video link for Video games.
- Add Group modal: the source-group selector.
- Deleted Games: Cover, Type, Groups and Deleted By columns, and bulk permanent delete.
- Music Library: mini player transport (prev / next / progress bar); only a single play control exists.
- Game editor Save has no dirty check, so it is always enabled.

**Events**
- Location field (blocked, see section 1).
- Quest stage picker interaction. The design uses a checkbox list with Select All and an explicit Save, with pending selections auto-committing on stage or group change. The implementation uses one-click chips that add immediately. This is a genuine behavioural difference, not a styling one.
- Break stage seconds field (minutes only today).
- Date filter by specific date, month or year (range only today).
- Event Links labels: design says Player Join / Spectator View / Host Console, app says Facilitator / Display / Teams.
- Event name 40-character cap.
- Status editable inside the editor (it lives in the page header instead).
- The sliding accent indicator on the 4-way stage toggle.

**Shell**
- The flip-switch component. Every 2-state toggle in the design (Display, UI Colour, Purchase Items, Branding, Points Static/Range, Text style, approval) is specified as a 52x26 sliding pill. All are implemented as 2-segment pills instead. Consistent, but consistently different from the design.
- Search results do not open their target. Games and tickets land on bare list pages; only events deep-link.
- Theme toggle icon is **inverted** versus the design (design shows the current state, app shows the target state).
- Header avatar is gold; the design specifies slate.
- Help modal is 420px wide, design says 520px, and it has no max-height or scroll.

---

## 5. What the design silently drops

The design was drawn for one idealised user and omits a great deal the app actually does. **The implementation kept all of these**, which was the right call, but it means the design is not a complete specification and should not be followed literally.

**Commercial**
Promo codes, subscription change with proration preview, Paddle billing portal, unpaid-invoice surface, "Pay now" per-invoice checkout, payment history, monthly event-usage and plan-limit warnings, partner/comped notices, VAT disclaimer, event activation and invoicing flow.

**Operational**
Game import, Inventory Library, group management (create, rename, delete, collapse, per-group install), drag-to-reorder for games and events, per-card actions, search boxes on every list, platform/super-admin install flows, music upload and clip generation, bulk operations.

**Safety**
Bin and soft-delete with 30-day restore for both games and events, permanent-delete confirmations, unsaved-changes navigation blockers, event status lifecycle rules, demo-mode guards, org-suspension gating, archived as a first-class status, duplicate event, event activity log.

**Support and roles**
Ticket status grouping (Open / In Progress / Resolved), unread badges, realtime sync, mark-as-read, add/remove user, role assignment, per-role navigation variants.

**Dashboard**
"Your plan" card and "Quick links" card were on the old dashboard and are now gone from both the design and the app. Recent events also lost their status indicator and absolute date, and the page lost the personalised "Welcome, {org name}" title.

---

## 6. What the design genuinely adds

New ideas worth keeping, all now built unless noted:

- The 40px header itself, which did not exist. Everything below follows from it.
- Global search across games, events and tickets.
- Global "New Game" and "New Event" buttons.
- Help Centre (shell built, content missing).
- Exit with a confirm and a "You've been logged out" screen.
- Header avatar as the My Account entry point.
- Flattened Organisation and Billing navigation, replacing the collapsible Org Settings group.
- The shared red Danger Zone pattern, now used on Organisation, My Account and the event editor.
- "Download all your data" on Organisation and "Download all event files" on events.
- Log out of all devices, and self-service account deletion (both built this session, backed by a real RPC).
- Status filter chips and a date filter on the events list.
- The 4-column stat strip on event cards.
- Participation chart on the dashboard (the design only asked for a placeholder; a real chart was built).
- Public/Private visibility tags on settings cards.
- Support: Export transcript, Enter-to-send, iMessage-style bubbles.

---

## 7. Suggested order of work

1. **Decide the contradictions in section 3.** Pricing and VAT are customer facing and cheap to fix once decided. Nothing else should ship before those are right.
2. **Remove or finish the four non-functional items in section 2.** A visible control that does nothing is worse than an absent one. Fastest honest fix: hide the profile photo card and the file-upload button until their columns exist, and either write the 6 help articles or hide the Help button.
3. **Fix the cheap true gaps**: theme icon direction, avatar colour, Help modal size and scroll, search opening its target, Event Links labels, tablet Save dirty scoping, logo size enforcement.
4. **Then the schema-backed features**, in value order: event location, ticket category, then phone and profile photo.
5. **Then the larger unbuilt pieces**: colour picker popover, game preview modal, Background Designer, quest picker interaction model.
