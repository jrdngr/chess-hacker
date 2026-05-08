# Revival

Cards that return one of your **discarded** cards (already played, sitting in the discard pile) back to your hand. Cards in the **consumed pile** (those that had the Consume keyword when played) are not eligible — once consumed, they are gone for the match.

## Restore from Backup

- **Cost:** 1 energy
- **Rarity:** Uncommon
- **Type:** Resource
- **Keywords:** **Consume**
- **Target:** None (UI prompt for choice)
- **Effect:** A modal opens showing every card in your discard pile; pick one to return to your hand. Restore from Backup itself is consumed for the match.

Targeted revival. The 1-cost reflects that the card is one-shot (Consume) and gone for the match after one use; cheap enough to splash into combo lines that need a specific tool back. Restore from Backup has Consume, so you can't loop it indefinitely — at most one targeted rescue per match per copy in the deck.

## Why it exists

Revival lets the player skip the wait for the discard pile to cycle back. With reshuffling, every discarded card eventually returns to draw, but you don't get to pick when. Restore from Backup is the "I want this card *now*" tool — chosen, one-shot, cheap.

Cards with Consume (Format C:, Patches, Remote Access, kill -9, Restore from Backup itself) are *not* in the discard pile after they've been played; they're in the consumed pile and unreachable by revival. Consume is the contract for "this card is finite per match."

The earlier Restore Point card (random revive, cost 1) was retired in the power-curve overhaul; the random-revive code path is still valid in the schema (status effects or future cards may use it), but no card definition currently invokes it.
