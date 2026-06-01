# Resource cards

Resource cards manipulate the deck or provide information. They don't act on the board directly — they support everything else.

See [`keywords.md`](keywords.md) for keyword definitions.

## Stack Trace

- **Cost:** 0
- **Rarity:** Common
- **Target:** none
- **Effect:** Look at the top 3 cards of your deck; put them back in any order.
- **Design note:** A 0-cost cantrip — pure information, no board effect. Sets the deck-shaping tone of the run. Doesn't draw, *fixes* what you'll draw. With cycling, scrying lets you push your strongest cards toward the top of the next cycle.

## Port Scan

- **Cost:** 1
- **Rarity:** Common
- **Target:** none
- **Effect:** Draw 2 cards.
- **Upgrade (Port Scan+):** Costs 0.
- **Design note:** the deck's basic draw engine — pure card advantage at a low price. Where Stack Trace *fixes* what you draw, Port Scan refills hand volume so you have more plays to make. A staple of the Sysadmin / Pentester starter decks.

## Cache Warmup

- **Cost:** 1
- **Rarity:** Common
- **Target:** none
- **Effect:** Gain +2 energy at the start of your next turn.
- **Upgrade (Cache Warmup+):** +3 energy instead.
- **Design note:** a one-turn tempo loan — pay 1 now, get 2 (net +1) next turn, front-loading energy for a planned big play (a Garrison Mode setup, a Format C:). Deliberately rationed across the curated starter decks so the shop's first purchase still matters.

## Heartbleed

- **Cost:** 1
- **Rarity:** Uncommon
- **Target:** none
- **Effect:** Gain energy equal to the number of enemy pieces you've captured this match.
- **Upgrade (Heartbleed+):** Costs 0.
- **Design note:** a scaling burst that pays off an aggressive game — every capture this match (chess or card) feeds the counter. Weak early, explosive late; cycles (no Consume) so a capture-heavy deck can fire it repeatedly. Reads `playerCaptureCount`, which card-kills increment too (CH-006).

## Bookmark

- **Cost:** 1
- **Rarity:** Uncommon
- **Target:** a card in your hand
- **Effect:** Apply **Retain** to the targeted hand card — it isn't sent to the discard pile by the end-of-turn forced discard.
- **Upgrade (Bookmark+):** Costs 0.
- **Design note:** lets you bank a key card (an Exploit, a haymaker) across turns until the moment is right, instead of being forced to discard or play it. Pairs with the Sysadmin deck's Exploit. Cannot target the Bookmark slot itself or an already-retained card.

## Insert Probe

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** none
- **Keywords:** Consume
- **Effect:** Reveal the engine's eval bar and best move arrow for 3 turns.
- **Upgrade (Insert Probe+):** Lasts 5 turns.
- **Design note:** pure information card — doesn't alter the board, but gives the player Stockfish-grade analysis for a limited window. Cost 6 + Consume ensures it's a deliberate investment. The eval bar shows the position score; the best-move arrow highlights the engine's recommended move. Both update reactively if the board changes (walls placed, pieces moved by other cards). If the dev panel's "Show Eval Bar" and "Show Best Move" toggles are both already on, the card still consumes but adds no additional effect.
