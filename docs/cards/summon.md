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

## Git Revert

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** a friendly piece that was captured or destroyed this match (chosen from a list), then an empty square in your half
- **Effect:** Choose a friendly piece that was removed from the board this match (by enemy capture, sacrifice, trap, or any other means). Place it on any empty square in your half of the board.
- **Upgrade (Git Revert+):** The revived piece enters with **Shield** (captures targeting it are illegal until your next turn).
- **Design note:** resurrection at the cost cap. Undoes the opponent's best capture or lets you sacrifice a piece with kill -9 / Self-Destruct and bring it back — though the combo costs 5+ energy across two turns and burns two Consume cards, so it's a one-shot per match. The own-half placement restriction prevents dropping a queen behind enemy lines. The piece revives with no statuses — it's a fresh start. The upgrade granting Shield gives the revived piece a turn of protection to get settled. Kings cannot be "captured" so they never appear in the eligible list.
