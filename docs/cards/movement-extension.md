# Movement-extension cards

Movement-extension cards give one of your pieces an additional movement pattern. They keep the piece's normal moveset and add a new option on top.

See [`keywords.md`](keywords.md) for keyword definitions, especially **Empower**.

## Capture-grants-Soul

When you capture an enemy non-King piece during a chess move, the matching Soul card is shuffled into your draw pile:

- pawn → Pawn Soul
- knight → Knight Soul
- bishop → Bishop Soul
- rook → Rook Soul
- queen → Queen Soul

This is the primary way Souls enter your deck — none of them appear in the starter (see [`starter-deck.md`](starter-deck.md)). Capturing more pieces means a richer movement-extension supply line.

## Pawn Soul

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with pawn movement (one square forward in your direction, plus diagonal-forward captures) **this turn**. Lost if you move a different piece first.
- **Design note:** the cheap Soul. Most niche on pieces that already cover those squares (kings, queens) but useful on a knight or rook that needs a quiet step or a melee capture without giving up its line. No double-push, no en passant, no promotion — those stay pawn-only.

## Knight Soul

- **Cost:** 3
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with the knight L-shape as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** Empower with the knight L-shape — the granted pattern ignores blockers like a real knight, so it's strongest on rooks/bishops (sudden forks) and on pawns (a one-turn jump break). The "use it or lose it" clause prevents pre-buffing across turns.

## Bishop Soul

- **Cost:** 3
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with diagonal sliding as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** turns a rook into a queen for a turn, gives a knight the long diagonals, lets a pawn cut across the board. No-op on bishops and queens (they already have it).

## Rook Soul

- **Cost:** 4
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with straight sliding as an additional movement pattern **this turn**. Lost if you move a different piece first.
- **Design note:** Turns a bishop into a queen, gives a knight long files and ranks. No-op on rooks and queens.

## Queen Soul

- **Cost:** 5
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Target own piece: **Empower** with **both** straight and diagonal sliding (i.e. queen movement) as additional movement patterns **this turn**. Lost if you move a different piece first.
- **Design note:** The apex Soul. A pawn or knight briefly threatens the entire board. The +1 cost over Rook Soul reflects that the queen pattern is strictly the strongest single-piece empower available.
