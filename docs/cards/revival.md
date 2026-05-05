# Revival

Cards that return one of your **discarded** cards (already played, sitting in the discard pile) back to your hand. Cards in the **consumed pile** (those that had the Consume keyword when played) are not eligible — once consumed, they are gone for the match.

## Recall

- **Cost:** 1 energy
- **Rarity:** Common
- **Type:** Resource
- **Target:** None
- **Effect:** Return a **random** card from your discard pile to your hand. No-op if the discard pile is empty.

The cheap, blind revive. Useful when the discard pile is rich; less useful right after a reshuffle empties it.

## Recover

- **Cost:** 4 energy
- **Rarity:** Uncommon
- **Type:** Resource
- **Keywords:** **Consume**
- **Target:** None (UI prompt for choice)
- **Effect:** A modal opens showing every card in your discard pile; pick one to return to your hand. Recover itself is consumed for the match.

Targeted revival. The energy cost reflects the precision: you're effectively *re-buying* a card you've already paid for once. Recover has Consume, so you can't loop it indefinitely — at most one targeted rescue per match per copy in the deck.

## Why they exist

Revival lets the player skip the wait for the discard pile to cycle back. With reshuffling, every discarded card eventually returns to draw, but you don't get to pick when. Recall and Recover are the "I want this card *now*" tools — Recall in the cheap, random form; Recover in the expensive, chosen, one-shot form.

Cards with Consume (Big Destroy, Souls, Marionette, Martyr's Gift, Recover itself) are *not* in the discard pile after they've been played; they're in the consumed pile and unreachable by revival. Consume is the contract for "this card is finite per match."
