# Summon cards

Summon cards create new pieces on empty squares.

## Reinforce

- **Cost:** 4
- **Rarity:** Rare
- **Target:** an empty square in your half (ranks 1..⌊totalRanks/2⌋)
- **Effect:** Place a new player pawn on the targeted square. The piece behaves like a normal pawn from that point — including the start-rank double-push gate.
- **Design note:** the prototype's first Summon card. Recovers from material loss without needing a capture; the own-half restriction prevents drop-onto-the-back-rank shenanigans. Combos with Pawn Storm artifact (any-rank double-push lets the new pawn rocket forward) and Promotion Engine (rank-7 promotion shortens the path to a new queen).

## Fork

- **Cost:** 3
- **Rarity:** Uncommon
- **Target:** one of your non-King pieces + a king-step-adjacent empty square (two-step pick)
- **Effect:** Summon a pawn on the targeted adjacent empty square.
- **Upgrade (Fork+):** Summon a copy of the source piece's type instead of a pawn (so a Fork+ from a knight summons a knight; from a rook, a rook; etc.). Same cost.
- **Design note:** A process forks — a child appears next to its parent. Cheaper than Reinforce because it requires an existing piece as an anchor, and the spawn location is tightly constrained. The King is excluded as a source so the upgrade cannot summon a second king (which would be illegal under standard chess). Spawned pawns follow normal pawn rules from that point on — promotion on the far rank still applies. Doesn't trigger Traps because the new piece *appears*; it doesn't *enter* the square.
