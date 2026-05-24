# Resource cards

Resource cards generate energy, draw cards, or manipulate the deck. They don't act on the board directly — they fuel everything else.

See [`keywords.md`](keywords.md) for keyword definitions.

## Port Scan

- **Cost:** 2
- **Rarity:** Common
- **Target:** none
- **Effect:** Draw 2 cards.
- **Design note:** the workhorse draw card. Net +1 card in hand for 2 energy. With cycling the drawn cards may be ones you've already played this match — the strength is acceleration through your deck, not pure card advantage. Two copies in the starter so the player almost always has draw available.

## Stack Trace

- **Cost:** 0
- **Rarity:** Common
- **Target:** none
- **Effect:** Look at the top 3 cards of your deck; put them back in any order.
- **Design note:** A 0-cost cantrip — pure information, no board effect. Sets the deck-shaping tone of the run. Doesn't draw, *fixes* what you'll draw. With cycling, scrying lets you push your strongest cards toward the top of the next cycle.

## Cache Warmup

- **Cost:** 1
- **Rarity:** Common
- **Target:** none
- **Effect:** Gain +2 energy at the start of your next turn.
- **Design note:** the only deliberate way to break the 3-energy ceiling on a future turn now that energy doesn't bank. Pay 1 this turn (still leaves 2 for utility) → land 5 next turn (3 baseline + 2 queued) → spend the full 5 on a haymaker plus a 1-cost card. Stacks if you play multiple Cache Warmups in the same turn.

## Bookmark

- **Cost:** 1
- **Rarity:** Uncommon
- **Target:** another card in your hand
- **Effect:** Apply **Retain** to the chosen card. It stays in your hand at end-of-turn discards until you play it.
- **Design note:** lets the player save a card across turn rollovers. Useful for the cost-4 haymaker drawn in a turn you can't afford it (no Cache Warmup on hand) — Bookmark it, draw fresh next turn, then play. Cannot target already-retained slots.

  Implementation: hand entries carry a per-instance `retained` flag (see `MatchCardState.hand` in `src/game/types.ts`). The flag survives end-of-turn discards but is dropped when the card is played.

## Insert Probe

- **Cost:** 3
- **Rarity:** Uncommon
- **Target:** none
- **Keywords:** Consume
- **Effect:** Reveal the engine's eval bar and best move arrow for 3 turns.
- **Upgrade (Insert Probe+):** Lasts 5 turns.
- **Design note:** pure information card — doesn't alter the board, but gives the player Stockfish-grade analysis for a limited window. High cost + Consume ensures it's a deliberate investment. The eval bar shows the position score; the best-move arrow highlights the engine's recommended move. Both update reactively if the board changes (walls placed, pieces moved by other cards). If the dev panel's "Show Eval Bar" and "Show Best Move" toggles are both already on, the card still consumes but adds no additional effect.

## Heartbleed

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** none
- **Effect:** Gain 1 energy for each enemy piece you have captured this match (uncapped).
- **Upgrade (Heartbleed+):** Also draw 1 card.
- **Design note:** the scaling resource card — weak early (0–1 captures = marginal), explosive late (5+ captures = a full turn's energy on top of the baseline). Rewards aggressive play and piece trading. Non-Consume so it cycles back; each time you draw it later in the match, it's stronger. The capture counter includes pieces taken by chess moves, Traps (capture), and destroy effects (Exploit, Format C:, etc.) — anything that removed an enemy piece from the board counts. A build-around card for aggressive decks.
