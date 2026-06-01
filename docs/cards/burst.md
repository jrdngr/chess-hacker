# Burst cards

Burst cards radically change the board: piece destruction, transformations, or game-ending swings. They sit at the expensive-to-haymaker end of the cost curve (6–15), requiring captures or patient saving to reach.

See [`keywords.md`](keywords.md) for keyword definitions.

## Exploit

- **Cost:** 8
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** enemy non-King piece your forces are attacking
- **Effect:** Remove the targeted enemy piece from the board.
- **Design note:** A conditional removal. Exploit requires positional setup — at least one of your pieces must already be threatening the target square. The setup is the work; the card is the cash-out. Consume keeps the card finite per match: each copy in the deck is one piece-removal, not a recurring threat. Cost 8 reflects the attack-by-player restriction — cheaper than the unconditional Format C:.

## Format C:

- **Cost:** 12
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** any enemy non-King piece
- **Effect:** Remove the targeted enemy piece from the board.
- **Design note:** Unconditional removal at haymaker cost. Requires a queen capture's worth of energy or long saving. Consume guarantees the haymaker stays a single moment per copy.

## Garbage Collect

- **Cost:** 15
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none — resolves immediately
- **Effect:** Destroy every enemy non-King piece currently attacked by one of your pieces.
- **Upgrade (Garbage Collect+):** After the initial sweep, repeat: any enemy non-King piece *newly* attacked (e.g. by a sliding piece whose line of attack opened when its blocker was destroyed) is also destroyed. Continue until a pass produces zero new destructions. Same cost.
- **Design note:** Unreachable references get freed. The reward for building a threatening position — turn N+1's earned attacks all cash out at once. Unlike Format C: (single-target, unconditional) and Exploit (single-target, requires-attack), Garbage Collect is a board-wide harvest gated on the player's positional setup. The enemy king is never destroyed in any wave, even if discovered checks reveal it as newly attacked — the recursion continues to evaluate non-king pieces; the discovered check sits as the game state after the card resolves. Pieces with Frozen / Rooted / Disarmed statuses are still destroyed if attacked — the status doesn't grant immunity. Cost 15 makes this the most expensive card in the game — you need a queen capture plus significant savings to reach it.

## Mass Exploit

- **Cost:** 9
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none — resolves immediately
- **Effect:** Destroy every enemy non-King piece currently attacked by one of your pieces — a **single** sweep (no chasing of discovered attacks).
- **Upgrade (Mass Exploit+):** Cost 8.
- **Design note:** the mid-curve board-harvest (CH-057, filling the cost-9 hole). Sits between Exploit (cost 8, single attacked target) and Garbage Collect (cost 15, recursive board-wide). Same setup-dependent payoff as Garbage Collect's first wave but one-shot and far cheaper — reward a threatening position without the queen-capture price tag. The enemy king is never destroyed.

## Polymorphism

- **Cost:** 6
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own non-King piece (queen cannot be targeted)
- **Effect:** Transform target friendly piece one tier up. Pawn → Knight or Bishop (player's choice). Knight or Bishop → Rook. Rook → Queen. The piece stays on its current square; only its type changes.
- **Upgrade (Polymorphism+):** Cost 5.
- **Design note:** a cheaper path to power than capturing and promoting — pay 6 energy to jump a piece up one tier. The pawn→minor choice adds a decision point (knight for forks, bishop for long-range). Rook→Queen is the premium transformation. Queen cannot be targeted (nothing above queen). Consume keeps the transformation one-shot per copy; Rare limits how many copies appear in draft pools.
