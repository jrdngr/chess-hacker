# Sacrifice cards

Sacrifice cards destroy one of your own pieces in exchange for a strong effect. They give players a way to convert dead-weight material into resources or tempo.

See [`keywords.md`](keywords.md) for keyword definitions.

## kill -9

- **Cost:** 1
- **Rarity:** Uncommon
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy one of your own non-King pieces; draw 2 cards and gain 1 energy this turn.
- **Design note:** the introductory Sacrifice card. Net effect for 1 energy: lose a piece, draw 2, gain 1 energy — so the *real* cost is the piece, and the energy is back in the budget. Consume keeps it from looping into a deck-thinning engine; the King exclusion is non-negotiable.

## Buffer Overflow

- **Cost:** 3
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Each friendly piece in the surrounding 8 king-step-adjacent squares gets one free chess action this turn (full action — can move or capture, same as Overclock's grant).
- **Upgrade (Buffer Overflow+):** The blast pattern expands from king-step (8 squares) to king-step ∪ knight-L (16 squares). Same cost.
- **Design note:** The buffer spills; everything nearby jumps. A cluster-sacrifice haymaker: stack pieces around a pawn, then pop the pawn for multi-action tempo. The action-grant uses the same Lightning machinery as Overclock — each affected piece is treated as if it had been Overclock'd with `actions: 1` for the turn. The sacrificed piece is removed *first*, so any friendly piece on the sacrificed-piece's own square (impossible in normal play; possible after swap effects) is not counted. Consume keeps the swing scarce; the Rare rarity bounds how often it shows up in draft pools.
