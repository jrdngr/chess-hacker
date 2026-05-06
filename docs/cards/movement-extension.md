# Movement-extension cards

Movement-extension cards give one of your pieces an additional movement pattern. They keep the piece's normal moveset and add a new option on top.

See [`keywords.md`](keywords.md) for keyword definitions, especially **Empower**.

## Capture-grants-Patch

All Patches have the **Consume** keyword: each play removes the Patch for the rest of the match. Combined with capture-grants-Patch, this means each capture grants exactly one empower trigger of the matching pattern.

When you capture an enemy non-King piece during a chess move, the matching Patch card is shuffled into your draw pile:

- pawn → Pawn Patch
- knight → Knight Patch
- bishop → Bishop Patch
- rook → Rook Patch
- queen → Queen Patch

This is the primary way Patches enter your deck — none of them appear in the starter (see [`starter-deck.md`](starter-deck.md)). Capturing more pieces means a richer movement-extension supply line.

## Pawn Patch

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with pawn movement (one square forward in your direction, plus diagonal-forward captures) **this turn**. Lost if you move a different piece first.
- **Design note:** the cheap Patch. Most niche on pieces that already cover those squares (kings, queens) but useful on a knight or rook that needs a quiet step or a melee capture without giving up its line. No double-push, no en passant, no promotion — those stay pawn-only.

## Knight Patch

- **Cost:** 2
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with the knight L-shape as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** Empower with the knight L-shape — the granted pattern ignores blockers like a real knight, so it's strongest on rooks/bishops (sudden forks) and on pawns (a one-turn jump break). The "use it or lose it" clause prevents pre-buffing across turns.

## Bishop Patch

- **Cost:** 2
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with diagonal sliding as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** turns a rook into a queen for a turn, gives a knight the long diagonals, lets a pawn cut across the board. No-op on bishops and queens (they already have it).

## Rook Patch

- **Cost:** 3
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with straight sliding as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** Turns a bishop into a queen, gives a knight long files and ranks. No-op on rooks and queens.

## Queen Patch

- **Cost:** 4
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with **both** straight and diagonal sliding (i.e. queen movement) as additional movement patterns **this turn**. Lost if you move a different piece first.
- **Design note:** The apex Patch. A pawn or knight briefly threatens the entire board. The +1 cost over Rook Patch reflects that the queen pattern is strictly the strongest single-piece empower available.

## Sprint

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Give Haste to a friendly piece (it may move twice this turn, neither move a capture).
- **Design note:** First Haste card in the catalogue. Cheap reposition that opens fork lines a single move can't reach. The "no captures" clause keeps it from doubling as a free attack burst on the second move; combine with Vanguard / Overclock for capture chains.

## Vanguard

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece (must be a pawn)
- **Effect:** Target friendly **pawn** may take 2 actions this turn (moves and captures).
- **Design note:** Pawn-only Overclock at lower cost. Reuses the existing `lightning-piece` resolver with a piece-type filter so the pawn gets the same multi-action treatment Overclock grants any piece. Combos with Pawn Storm artifact (chained double-pushes) and Promotion Engine.

## Blitz

- **Cost:** 3
- **Rarity:** Uncommon
- **Target:** none
- **Effect:** All your pawns gain Haste for 3 turns.
- **Design note:** Multi-turn pawn-swarm payoff. The Haste status applied here lasts longer than Sprint's single-turn application; combos with Pawn Storm artifact, Promotion Engine, and the Pawn Storm Power for a sustained pawn assault.
