# Test Round 2 (after FIX-ROUND-1, V3.23.0 to V3.27.0)

Step-by-step scripts for everything that changed since your 26 Aug pass, plus
the items you had not tested yet. Tick each test pass or fail. Where an event
is needed, use a throwaway event on Claude Client (partner plan, nothing
bills) unless the test says otherwise. Billing tests use your payments test
account with Paddle sandbox cards (4242 4242 4242 4242, any future date, any
CVC).

## Test 1: Crossword clues save first time

1. Open any game library, create a crossword puzzle game.
2. Type a word, press Enter. The clue field should focus by itself.
3. Type the clue, press Enter. The clue is saved, no mouse needed.
4. Add a second word that crosses the first. Check the first word's clue is
   still there and the new crossing words each ask for their own clue.
5. Save the game, reopen it. All clues still present.

Pass when: no clue is ever lost and the whole word-then-clue flow works with
Enter only.

## Test 2: Stage boxes and Add stage

1. Open any event's editor and scroll to Stages.
2. Every stage box has a charcoal header strip; Welcome and End look slightly
   muted but match the system.
3. The Add stage button is gold and sits under the last normal stage, above
   the End box.

## Test 3: Event logo auto-resize

1. In an event's Branding section, upload a very large logo (a few MB photo)
   and then a tiny one.
2. Both upload quickly and render at a consistent size on the join page and
   display. Transparency survives on PNG logos.

## Test 4: Language dropdown placement

1. Open Organisation settings.
2. Default language now sits inside the Brand Identity card as a compact row
   with a clean dropdown. The old separate language section is gone.
3. Change it, save, reload: the admin panel follows the new language.

## Test 5: Event status menu

1. On the Events page, open an event's status menu.
2. Each option is coloured like its status. Demo says it is the one to test
   with (watermark, two teams). Active carries the charge and 24 hours
   warning with a gold alert icon.

## Test 6: Bulgarian winner wording

1. Run a Bulgarian-language event to the winner announcement.
2. Both ceremony steps say победител, never първи.

## Test 7: Clip loudness

1. In the music catalog, re-cut a clip from one quiet song and one loud song
   (change clip length to force a re-cut).
2. Play both in a bingo: they come out at roughly the same loudness.

## Test 8: Example video label

1. On an event with white UI colour, open a photo or video challenge that has
   an example video, on a phone.
2. The example video label is white (follows the event's UI colour) and
   slightly larger than before.

## Test 9: Bingo Start, first press

1. Facilitator panel, brand-new bingo stage, select it and press Start
   IMMEDIATELY, before anything warms up.
2. Music starts on the first press. Repeat a few times on fresh stages,
   including pressing Start the instant the stage is selected.
3. Also press Next between rounds rapidly. No round should need a second
   press.

## Test 10: Bingo big screen

1. Run a bingo with 3+ teams and the display open.
2. While a song plays: centre shows animated waves, NO song name anywhere.
3. Teams sit along the bottom as small coloured circles: grey while guessing,
   lit in team colour the moment a team marks, green or red at the reveal,
   grey if they never marked.

## Test 11: Keyboards

1. On a Bulgarian event, open a wordle or text challenge on a phone.
2. The Cyrillic keyboard is the standard Bulgarian Phonetic layout (я в е р т
   on the top row, not А Б В Г), all keys the same size, iPhone feel.
3. On a Spanish or French event (or any latin keyboard), hold a vowel: an
   accent bubble pops; slide or tap to pick; a quick tap types the plain
   letter. Fast two-thumb typing never drops or swaps letters.

## Test 12: Devices stay awake

1. Open the join page on a phone and the display on a tablet. Leave both
   untouched past their normal screen-off time.
2. Neither screen sleeps while the live surface is open.

## Test 13: Offline round 2 (phone or tablet, real dead spot or airplane mode)

1. Join an event online, wait a few seconds, check the readiness dot top left:
   yellow while downloading, then green.
2. Go offline. Game cover and instruction photos still show. The Powered by
   RallyHub badge shows as an image, not text.
3. Submit a photo and an auto-approve text answer: the sound effects play.
4. Solve a crossword offline: after the solved screen it returns to the list
   BY ITSELF and the tile is green immediately. Same for wordle and matching.
5. Reconnect: everything drains, scores land, tiles stay green.
6. Bonus: turn the network off BEFORE the downloads finish and check the dot
   goes red, then green after reconnect.

## Test 14: Demo keeps your teams

1. Build an event with 5 named teams and print-ready QR codes. Switch it to
   demo.
2. All 5 teams are still configured and visible on the join page.
3. Join with two phones (two teams claimed). A third phone cannot claim, with
   a clear message.
4. Switch demo to active: a warning lists what will be wiped; confirm; the
   event goes live with all 5 team slots fresh and empty, same QR codes.

## Test 15: Refunds (payments test account, sandbox)

1. Subscribe to Starter, pay with the sandbox card.
2. In Paddle sandbox, issue a FULL refund of that payment.
3. Within a minute the account drops to Pay Per Event, the subscription is
   cancelled in Paddle, and Billing no longer says Active.
4. Repeat with a PARTIAL refund on a fresh subscription: nothing changes, the
   plan stays.
5. Activate and pay for an event, then fully refund that event payment: the
   invoice shows Refunded in Billing.

## Test 16: Suspension in Billing

1. As staff, suspend the test client.
2. Their Billing tab shows a red suspended banner, the plan card says
   Suspended, and pay buttons are disabled. Events page still shows the
   existing suspension notice.
3. Unsuspend: everything returns.

## Test 17: Feature access (staff panel)

1. Open the client in the staff panel, Feature Access card: untick everything
   except Quiz (game type) and Quiz (stage type), and switch off the store.
2. As that client: New Game offers only Quiz, the games library filter shows
   only Quiz, stages offer only Quiz (plus Break if you left it on), the
   store section says it is not included, and Add stage still works.
3. Existing games of other types still open, still play in old events.
4. Re-enable everything: all options return.

## Test 18: Custom subscription (staff panel + payments account)

1. In the staff panel, enable Custom Subscription on the payments test
   client: for example 500 monthly, events included.
2. As the client: Billing shows Custom subscription with the amount, no plan
   change form. Events will not activate until the subscription is started
   (clear message).
3. Start the subscription: checkout charges exactly the custom amount.
4. Activate an event: EUR 0 invoice (events included), but extra teams above
   five still show as chargeable in the dialog.

## Test 19: Open joining

1. Create an event, switch on Open joining in the Teams card (the team list
   disappears behind a note). Activate it (base price only, the dialog says
   team charges settle at the end).
2. On phones, scan the join QR: the page offers Join as a new team. Create 3
   teams from 3 phones; each picks a name and photo and plays normally.
   Rejoin a team (the small link) gets you back into an existing team.
3. The facilitator and display show the new teams appearing live.
4. End the event (archive it). On a paying account with 6+ teams joined, an
   Additional team fees invoice appears in Billing for the teams above five.
5. While the event is active, the Open joining switch is locked.

## Test 20: Recurring event

1. Create an event, switch on Recurring, activate, play a round with a team,
   then archive it.
2. The event page offers Start next run. It warns what gets wiped; confirm.
3. The event returns to Ready. The SAME join QR code works. The old run's
   invoice shows as Earlier run in Billing.
4. Activate again: a fresh charge for the new run. Teams and data start
   clean.

## Test 21: Logins and domains (backlog)

1. Log in with your USERNAME (not email) on app.rallyhub.games.
2. Run the forgot-password flow once; the email arrives and works.
3. Try a client login on admin.rallyhub.games: rejected with a jump link.
4. Open one old bookmarked subdomain link (client.app.rallyhub.games): it
   lands on the new path-based admin.

## Test 22: Tablet kiosk (backlog)

1. On the real tablet, open the tablet link, enter the PIN, award points to a
   team. Score updates live.
2. Record a video challenge on the tablet and play it back WITH sound.

## Test 23: PWA install (backlog)

1. Install the app to the home screen on iPhone and on the Android tablet via
   the install guides. Both open full screen from the icon.

## Test 24: Matching puzzle offline (backlog)

Covered inside Test 13 step 4; tick it separately so we know it ran.
