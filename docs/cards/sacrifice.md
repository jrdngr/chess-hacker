# Sacrifice cards

Sacrifice cards destroy one of your own pieces in exchange for a strong effect. They give players a way to convert dead-weight material into tempo or enemy removal.

See [`keywords.md`](keywords.md) for keyword definitions.

## Martyr Protocol

- **Cost:** 1
- **Rarity:** Common
- **Target:** own pawn
- **Effect:** Destroy one of your pawns. Gain 2 energy and draw 1 card.
- **Upgrade (Martyr Protocol+):** Gain 3 energy instead of 2.
- **Design note:** the cheap sacrifice enabler the archetype lacked (CH-055). Turns a dead-weight pawn into tempo + a card — a net-positive trade when a pawn is already doomed or blocking your own lines. The anchor for sacrifice builds: with the **Scavenger** artifact it nets +4 energy, and it feeds Git Revert's resurrection pool. Common + cost 1 so it shows up early and often.

## kill -9

- **Cost:** 1
- **Rarity:** Uncommon
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Gain 2 energy and draw 1 card.
- **Upgrade (kill -9+):** Gain 3 energy instead of 2.
- **Design note:** the broader sibling of Martyr Protocol — sacrifices *any* non-King piece, not just a pawn, for the same tempo + card. Use it to clear a piece that's blocking your own lines, or to fuel a sacrifice/Scavenger engine with a larger body. The destroyed piece joins the Git Revert resurrection pool.

## Buffer Overflow

- **Cost:** 7
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Each friendly piece in the surrounding 8 king-step-adjacent squares gets one free chess action this turn (full action — can move or capture, same as Overclock's grant).
- **Upgrade (Buffer Overflow+):** The blast pattern expands from king-step (8 squares) to king-step ∪ knight-L (16 squares). Same cost.
- **Design note:** The buffer spills; everything nearby jumps. A cluster-sacrifice haymaker: stack pieces around a pawn, then pop the pawn for multi-action tempo. The action-grant uses the same Lightning machinery as Overclock — each affected piece is treated as if it had been Overclock'd with `actions: 1` for the turn. The sacrificed piece is removed *first*, so any friendly piece on the sacrificed-piece's own square (impossible in normal play; possible after swap effects) is not counted. Consume keeps the swing scarce; the Rare rarity bounds how often it shows up in draft pools.

## Self-Destruct

- **Cost:** 3
- **Rarity:** Uncommon
- **Keywords:** **Consume**
- **Target:** own non-King piece
- **Effect:** Destroy the targeted piece. Destroy all enemy non-King pieces on the 4 orthogonally adjacent squares (N/S/E/W) around it. Diagonal neighbours are spared.
- **Upgrade (Self-Destruct+):** Also draw 2 cards after the detonation resolves.
- **Design note:** the AoE sacrifice — position a piece in the thick of the enemy formation, then detonate it. Compared to Buffer Overflow (tempo payoff: allied actions), Self-Destruct's payoff is enemy removal. Cost 3 and orthogonal-only adjacency (CH-037) keep the swing in check — on cramped boards the old cost-2, all-8-neighbours version was a refund-positive board wipe. Rewards lining a piece up against an orthogonal cluster. The enemy king is never destroyed (non-King restriction). Pieces destroyed by Self-Destruct are eligible for Git Revert resurrection.
