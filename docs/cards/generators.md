# Generators

Cards whose primary effect is to create new cards in your hand. Generators exist to soften the empty-deck cliff that consume-all imposes — see [`../design/cards.md`](../design/cards.md) for the full mechanic.

## Improvise

- **Cost:** 1 energy
- **Rarity:** Common
- **Type:** Resource
- **Target:** None
- **Effect:** Add a random common card from the library to your hand.

The cheap, high-variance flex. You don't know what you'll get; you do know it'll be common rarity (so no rare bombs, and no shiv tokens).

## Trick Bag

- **Cost:** 2 energy
- **Rarity:** Uncommon
- **Type:** Resource
- **Target:** None
- **Effect:** Add three random shiv-pool tokens to your hand.

The shiv pool is a small set of low-impact 1-cost cards that exist *only* via Trick Bag — they don't appear in the starter or in drafts. Current shivs:

- **Shiv: Strike** — gain 1 energy.
- **Shiv: Step** — draw 1.
- **Shiv: Snag** — disarm an enemy piece.

A Trick Bag play turns a 2-energy investment into three follow-up plays of energy/draw/disruption. Trick Bag is itself uncommon (draft-pool only).

## Mark Target

- **Cost:** 2 energy
- **Rarity:** Uncommon
- **Type:** Disruption (compound)
- **Target:** Enemy non-King piece
- **Effect:** Root the target for **2 turns**. Add Vine Pull to your hand.

The setup half of the Mark Target → Vine Pull combo. Two-turn root gives you time to land the follow-up; the in-hand Vine Pull is a 2-cost ticket to swap one of your pieces with that rooted enemy.

## Vine Pull

- **Cost:** 2 energy
- **Rarity:** Uncommon
- **Type:** Swap
- **Target:** A rooted enemy non-King piece + one of your pieces (two-step pick).
- **Effect:** Swap the two pieces' positions. The rooted enemy ends up where your piece was; your piece takes the rooted square.

The payoff half of the combo. The starter deck includes one copy of Vine Pull alongside Tangled Roots; Mark Target generates additional copies. Vine Pull requires a rooted target to fire — the persistent root sources in the prototype are Tangled Roots (1 turn) and Mark Target's 2-turn root.

## Shiv pool

The three shiv tokens are listed under Trick Bag above. They are data-only — they don't appear in the starter or in drafts, and their final names/effects are open follow-ups (see `TODO.md`).

## Why they exist

A 20-card deck under consume-all hits empty after about 20 plays. Generators stretch the deck by *creating* new plays during the match: Improvise turns one card into one (different) card; Trick Bag turns one card into three; Mark Target turns one play into a 2-turn combo with a guaranteed payoff. The net is fewer "I have nothing in hand" turns and more options spread across the match.
