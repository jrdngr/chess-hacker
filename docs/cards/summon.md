# Summon cards

Summon cards create new pieces on empty squares.

## Reinforce

- **Cost:** 8
- **Rarity:** Rare
- **Target:** an empty square in your half (ranks 1..⌊totalRanks/2⌋)
- **Effect:** Place a new player pawn on the targeted square. The piece behaves like a normal pawn from that point — including the start-rank double-push gate.
- **Design note:** the prototype's first Summon card. Recovers from material loss without needing a capture; the own-half restriction prevents drop-onto-the-back-rank shenanigans. Combos with Pawn Storm artifact (any-rank double-push lets the new pawn rocket forward) and Promotion Engine (rank-7 promotion shortens the path to a new queen).

## Fork

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** one of your non-King pieces + a king-step-adjacent empty square (two-step pick)
- **Effect:** Summon a pawn on the targeted adjacent empty square.
- **Upgrade (Fork+):** Summon a copy of the source piece's type instead of a pawn (so a Fork+ from a knight summons a knight; from a rook, a rook; etc.). Same cost.
- **Design note:** A process forks — a child appears next to its parent. Cheaper than Reinforce because it requires an existing piece as an anchor, and the spawn location is tightly constrained. The King is excluded as a source so the upgrade cannot summon a second king (which would be illegal under standard chess). Spawned pawns follow normal pawn rules from that point on — promotion on the far rank still applies. Doesn't trigger Traps because the new piece *appears*; it doesn't *enter* the square.

## Swarm Protocol

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** one of your pawns
- **Effect:** Summon a pawn on every empty square orthogonally adjacent to the chosen pawn (up to 4 — N/S/E/W). Walled and occupied squares are skipped.
- **Upgrade (Swarm Protocol+):** Costs 5.
- **Design note:** the Summon archetype's go-wide payoff (CH-055). A single pawn in open space blooms into a phalanx of up to five — instant board presence and a wall of bodies. Best in the center early before squares fill up; cramped or edge positions yield fewer spawns, which is the intended cost of poor placement. With the **Hive Mind** artifact the first of the summoned pawns enters Shielded, and summon-cost −2 makes this a 4-energy swarm. Like Fork, the new pawns *appear* (no Trap trigger) and follow normal pawn rules thereafter.

## Overmind

- **Cost:** 11
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** an empty square in your half
- **Effect:** Summon a **knight** on the targeted empty square in your half.
- **Upgrade (Overmind+):** Cost 10.
- **Design note:** the top-end summon (CH-057, filling the cost-11 hole). Where Reinforce drops a pawn for 8, Overmind drops a fully-mobile knight for 11 — immediate attacking presence and fork threats rather than a slow promoter. Consume + Rare + the steep price keep it a deliberate haymaker reached via a big capture or patient saving.

## Git Revert

- **Cost:** 8
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** a friendly piece that was captured or destroyed this match (chosen from a list), then an empty square in your half
- **Effect:** Choose a friendly piece that was removed from the board this match (by enemy capture, sacrifice, trap, or any other means). Place it on any empty square in your half of the board.
- **Upgrade (Git Revert+):** The revived piece enters with **Shield** (captures targeting it are illegal until your next turn).
- **Design note:** resurrection at the expensive tier. Undoes the opponent's best capture or lets you sacrifice a piece with Self-Destruct and bring it back — though the combo costs 10 energy and burns two Consume cards, so it's a major commitment. The own-half placement restriction prevents dropping a queen behind enemy lines. The piece revives with no statuses — it's a fresh start. The upgrade granting Shield gives the revived piece a turn of protection to get settled. Kings cannot be "captured" so they never appear in the eligible list.
