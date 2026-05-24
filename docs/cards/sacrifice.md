# Sacrifice cards

Sacrifice cards destroy one of your own pieces in exchange for a strong effect. They give players a way to convert dead-weight material into tempo or enemy removal.

See [`keywords.md`](keywords.md) for keyword definitions.

## Buffer Overflow

- **Cost:** 7
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Each friendly piece in the surrounding 8 king-step-adjacent squares gets one free chess action this turn (full action — can move or capture, same as Overclock's grant).
- **Upgrade (Buffer Overflow+):** The blast pattern expands from king-step (8 squares) to king-step ∪ knight-L (16 squares). Same cost.
- **Design note:** The buffer spills; everything nearby jumps. A cluster-sacrifice haymaker: stack pieces around a pawn, then pop the pawn for multi-action tempo. The action-grant uses the same Lightning machinery as Overclock — each affected piece is treated as if it had been Overclock'd with `actions: 1` for the turn. The sacrificed piece is removed *first*, so any friendly piece on the sacrificed-piece's own square (impossible in normal play; possible after swap effects) is not counted. Consume keeps the swing scarce; the Rare rarity bounds how often it shows up in draft pools.

## Self-Destruct

- **Cost:** 2
- **Rarity:** Uncommon
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Destroy all enemy non-King pieces on the 8 king-step-adjacent squares around it.
- **Upgrade (Self-Destruct+):** Also draw 2 cards after the detonation resolves.
- **Design note:** the AoE sacrifice — position a piece in the thick of the enemy formation, then detonate it. Compared to Buffer Overflow (tempo payoff: allied actions), Self-Destruct's payoff is enemy removal. Cost 2 is low because you're also paying a piece and the card is Consume. Devastating when a pawn can be parked next to 2–3 enemy pieces. The enemy king is never destroyed (non-King restriction). Pieces destroyed by Self-Destruct are eligible for Git Revert resurrection.
