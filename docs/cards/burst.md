# Burst cards

Burst cards radically change the board: extra actions, board-wide effects, or game-ending swings. They sit at the top of the cost curve — the cap is 4 in the post-banking model, so the haymakers compete for the player's full per-turn budget.

See [`keywords.md`](keywords.md) for keyword definitions.

## Exploit

- **Cost:** 3
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** enemy non-King piece your forces are attacking
- **Effect:** Remove the targeted enemy piece from the board.
- **Design note:** A conditional removal. Exploit requires positional setup — at least one of your pieces must already be threatening the target square. The setup is the work; the card is the cash-out. Consume keeps the card finite per match: each copy in the deck is one piece-removal, not a recurring threat. Cost 3 (one tier below the cap) reflects the attack-by-player restriction.

## Format C:

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** any enemy non-King piece
- **Effect:** Remove the targeted enemy piece from the board.
- **Design note:** Unconditional removal at the cost cap. Either pre-played via a Cache Warmup the prior turn (3 baseline + 2 queued = 5, leftover after the 4-cost spend) or committed as the full turn budget. Consume guarantees the haymaker stays a single moment per copy.

## Garbage Collect

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none — resolves immediately
- **Effect:** Destroy every enemy non-King piece currently attacked by one of your pieces.
- **Upgrade (Garbage Collect+):** After the initial sweep, repeat: any enemy non-King piece *newly* attacked (e.g. by a sliding piece whose line of attack opened when its blocker was destroyed) is also destroyed. Continue until a pass produces zero new destructions. Same cost.
- **Design note:** Unreachable references get freed. The reward for building a threatening position — turn N+1's earned attacks all cash out at once. Unlike Format C: (single-target, unconditional) and Exploit (single-target, requires-attack), Garbage Collect is a board-wide harvest gated on the player's positional setup. The enemy king is never destroyed in any wave, even if discovered checks reveal it as newly attacked — the recursion continues to evaluate non-king pieces; the discovered check sits as the game state after the card resolves. Pieces with Frozen / Rooted / Disarmed statuses are still destroyed if attacked — the status doesn't grant immunity. Use Cache Warmup the prior turn to leave energy for a follow-up move; otherwise it's the full turn budget.

## Why they're expensive

In the post-banking model (3 energy / turn, no carry-over) the cost cap is 4. A cost-4 burst is "this turn, instead of three small plays, I commit to one dominant effect." Cache Warmup is the only deliberate way to land a haymaker without giving up the rest of the turn — play it on turn N for +2 on turn N+1, then spend 4 on the burst with 1 energy left over.
