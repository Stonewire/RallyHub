# OFFLINE-1 — Offline mode for quest play

Briefed by Rumen 12 Aug 2026, decisions locked 12 Aug. Branch `feature/offline-mode`.

## Goal

A team's device keeps playing quest stages through a dead spot. Wifi drops, phone
loses signal, group walks out of range: the app stays usable and nothing the team
did is lost. Submitting is instant (online too) and drains in the background.

Scope is **quest stages only**. Quiz and music bingo are lock-step and need the
network by nature: offline they show "needs a connection", they do not queue.

## Locked decisions (Rumen, 12 Aug 2026)

1. **Text auto-approve offline**: ship a **sha256 hash** of each accepted answer in
   the download package, not the plaintext. Client hashes the trimmed input and
   compares. Keeps text answers unreadable. `choose_answer` needs nothing new (the
   option ids are already on the device to draw the buttons) — compare the chosen id.
   Matches server rule: `btrim`, case-sensitive, any-of multiple answers. The fuzzy
   "close" verdict is staff-only and never scores, so it is not needed offline.
2. **Puzzles must work offline, instantly** (no point otherwise). Ship the
   **un-redacted puzzle config** to the joined device:
   - Wordle: ship the answer word (per-letter feedback needs it; hashing is
     pointless, brute-forceable in ms). Accepted leak.
   - Crossword: ship the answer words **and** hints work offline (Rumen chose "ship
     letters"). Accepted leak.
   - Matching: ship the pair map. (Could be hashed since ids are UUIDs, but Rumen
     accepted plaintext everywhere, so ship the config as-is for one simple path.)
   Residual risk: a determined colleague with devtools can read a puzzle answer.
   Team-building context, low stakes, accepted.
3. **Store double-spend**: non-issue. Points deduct only at facilitator completion
   under a row lock with a live re-check. Offline order = queued pending insert,
   deducts nothing. Facilitator sees overspend at fulfilment and declines. Show the
   team their pending total so it is not a surprise.
4. **Download only after join**, never before, for security. The package RPC
   requires the private team token (`x-team-token`), not just the event join token.
5. **Ship target**: apply migrations + push to `main` as each stage goes green and
   passes adversarial review. Real-device offline testing is Rumen's, after landing.

## Grounded facts (from the 12 Aug subsystem investigation)

- **Submissions insert with a client-generated UUID as the primary key**
  (`optimisticOpenSubmission`, `id: crypto.randomUUID()`, inserted as `id:` in
  `JoinGameView.tsx`). A retry of the same item hits a duplicate-key = safe no-op.
  **No dedup logic needed; the DB enforces idempotency.**
- Media (photo/video) uploads to storage via a signed URL from the
  `mint-storage-upload-url` edge function (`uploadParticipantAsset` in
  `src/lib/storage.ts`) BEFORE the DB insert.
- Post-submit already returns optimistically (`finishOpenSubmitOptimistically`
  does not await the write). The outbox generalises this.
- **Text auto-approval is a server BEFORE-INSERT trigger** `auto_approve_text_submission`
  (`supabase/migrations/20260808120000_text_auto_award_guard.sql`): matches
  `media_url` against config, flips status approved/rejected, sets points, bumps
  `teams.score` guarded by the `rallyhub.text_score_award` marker. Correct answer is
  stripped from anon config by `redact_game_config_for_live`; staff get it un-redacted
  via `caller_may_see_event_solutions` (that gate is the model for the package RPC).
- **Puzzle scoring is server RPCs** (`submit_wordle_guess`, `submit_matching_pair`,
  `validate_crossword_grid`) that re-read un-redacted config, validate, score
  (`puzzle_wordle_feedback/points`, `puzzle_matching_points`,
  `crossword_solved_word_ids`, `puzzle_crossword_points`), insert an approved
  submission, bump score under `rallyhub.puzzle_score_award`. Client mirrors exist in
  `src/lib/puzzle-engine.ts` (display-only today) — reuse them as the offline scorer.
- **Join token has no TTL**: static per-event secret `events.join_token`,
  re-minted silently from the event UUID by `ensureLiveEventAccess` on reconnect,
  as long as the event is still live. Cached in sessionStorage `rallyhub_join_token_${eventId}`.
- **Durable credential is the private team token**: `inventory_team_access.token_hash`,
  raw value in localStorage `rallyhub_current_participant_session.purchaseToken`, sent
  as `x-team-token`, survives app kill. The submissions trigger
  `submissions_guard_participant_write` already requires it to match. This is the
  credential the offline queue authenticates its drain with. Hard blockers: event
  going non-live (bootstrap returns null — keep queue, surface it), or loss of the
  localStorage team token (cache clear / re-claim rotates the hash).
- **No offline infra today**: `public/sw.js` caches only `offline.html` and passes
  all real traffic through (by design — stale JS mid-event judged worse than a
  non-loading page). No IndexedDB anywhere. PWA manifest ships and is installable.
- Upload caps (`src/lib/upload-limits.ts`): photo 15MB, video 250MB.

## iOS Safari storage rules to design around

- Eviction is **all-or-nothing per origin and silent** under disk pressure (LRU).
- A site opened in a Safari tab (not installed) is wiped after **7 days idle**.
  Home-screen install is the documented exemption.
- `navigator.storage.persist()` is heuristic on Safari (install/bookmark), treat a
  true return as a bonus.
- Large blobs in IndexedDB have a memory-spike history on WebKit → **video bytes go
  in the Cache API** (streams to disk), **queue index + metadata in IndexedDB**.
- Check `navigator.storage.estimate()` before queuing video. Hard-cap the video
  queue (3 clips or ~150MB, whichever first). Photos/text never capped.
- Push home-screen install + `persist()` so the queue and content survive.

## Architecture

New module `src/lib/offline/`:
- `idb.ts` — tiny hand-rolled IndexedDB wrapper (no new dep). Stores: `outbox`
  (queued submissions/orders, keyed by client UUID), `content` (downloaded package
  per event), `meta` (kv: package version, download state).
- `blob-cache.ts` — Cache API wrapper for media blobs (put/get/delete by key).
- `outbox.ts` — the queue: enqueue, list, drain (FIFO, one at a time), backoff,
  per-item state. Drain triggers: `online` event, window focus, an interval, and an
  explicit call after each enqueue (immediate when online = instant feel).
- `package.ts` — download-on-join: call the RPC, store content + hash text answers +
  cache media. Report progress.
- `scoring.ts` — offline authoritative scoring for text (hash) + puzzles (reuse
  `puzzle-engine.ts`), producing a provisional result reconciled on drain.
- `net.ts` — online/offline detection (`navigator.onLine` + a lightweight reachability
  ping, since onLine lies), exposed as a hook.

Server:
- `get_offline_event_package(p_event_id)` — SECURITY DEFINER, requires a valid
  `x-team-token` for a team on the event (reuse `live_team_token_matches`). Returns
  quest games with un-redacted config (text answers replaced by sha256 hashes,
  puzzle config as-is), store catalogue, event branding. NOT gated on join token
  alone. Grant to anon (token is the real gate).
- `submit_puzzle_result_offline(...)` — accepts a completed-puzzle submission from
  the drain with the guesses/solve metadata, validates + scores authoritatively
  server-side (same logic as the online RPCs), inserts the approved submission.
  This is how a puzzle finished offline becomes an authoritative score on reconnect.
- Text/photo/video/store already have server paths (trigger / signed URL / RPC); the
  outbox just replays them. Store: `place_store_order` replayed on drain.

## Stages (each its own commit(s), independently useful and revertable)

1. **Instant background-submit (online)** — outbox as the new submit transport,
   in-memory first but shaped for IDB. Submit returns to the challenge list
   instantly, drains immediately online. No offline yet. Verify online submit is
   identical-or-better. `src/lib/offline/outbox.ts`, refactor `JoinGameView`.
2. **Local persistence + download-on-join** — `idb.ts`, `blob-cache.ts`,
   `package.ts`, RPC `get_offline_event_package`. Additive.
3. **Offline queue + reconnect drain** — outbox persists to IDB, media to Cache API,
   drains on reconnect, catch-up bundle refresh. Submissions now survive offline.
4. **Offline auto-scoring** — `scoring.ts`, text hash + puzzle client scoring +
   `submit_puzzle_result_offline`. Instant offline results, server reconciles.
5. **Offline store** — catalogue offline, order queues, pending-total UI.
6. **Service worker app-shell caching** — app boots offline. Highest risk, most
   review, ships last. `public/sw.js`.
7. **Offline UI** — banners, per-item state, download progress, hints offline,
   quiz/bingo "needs connection".

## Invariants (must hold at every commit)

- **Online behaviour is identical-or-better.** The outbox online path must never be
  slower or less reliable than today's submit. Adversarial review checks this.
- Every server change is its own migration, applied via MCP, verified both ways.
- The client-UUID PK is the only dedup mechanism; never invent a second one.
- Original client timestamps preserved through the queue so the log + time-decay
  scoring stay honest.
- Never push to main while a client event is `active` (own test events fine).
- Explicit git staging only, never `git add -A` (parallel sessions in this repo).
