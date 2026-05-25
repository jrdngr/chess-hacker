# Movement-extension cards

Movement-extension cards give one of your pieces an additional movement pattern. They keep the piece's normal moveset and add a new option on top.

See [`keywords.md`](keywords.md) for keyword definitions, especially **Empower** and **Haste**.

## Vanguard

- **Cost:** 2
- **Rarity:** Common
- **Target:** own piece (must be a pawn)
- **Effect:** **Haste** own pawn (moves twice this turn, captures allowed on both moves).
- **Design note:** Pawn-only Haste at lower cost than Overclock. Reuses the existing `lightning-piece` resolver with a piece-type filter. Combos with Pawn Storm artifact (chained double-pushes) and Promotion Engine.

## Side Channel

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece (must be a pawn)
- **Effect:** Target own pawn: **Empower** with a 1-square diagonal step (any of the four diagonals) **this turn**, no capture. Lost if you move a different piece first.
- **Design note:** named for the security term — a non-standard path that bypasses the normal access route. Lets a pawn slip onto a colour it would never otherwise reach: round walls, sidestep an opposing pawn structure, or jink onto a key square. Empower never captures (see [`keywords.md`](keywords.md)), so the diagonal step is movement-only — the pawn still relies on its native diagonal-forward capture for taking pieces.

## Lateral Movement

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece (must be a pawn)
- **Effect:** Target own pawn: **Empower** with a 1-square horizontal step (left or right) **this turn**, no capture. Lost if you move a different piece first.
- **Design note:** also a security term — an attacker pivoting sideways through a network. Lets a pawn change file once without first capturing, then resume its forward push the next turn. Combos with Promotion Engine (slip onto a clearer file) and with Pawn Storm tempo (re-align the wave). Movement-only; native captures are unaffected.

## SSH Tunnel

- **Cost:** 7
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own non-King piece, then any empty square on the board
- **Effect:** Teleport the targeted friendly piece to the chosen empty square. The piece ignores all geometry — no path, no line of sight, no walls. It simply appears on the destination.
- **Upgrade (SSH Tunnel+):** Can also target your King.
- **Design note:** the ultimate repositioning tool — bypass the entire board topology for one piece. Cost 7 + Consume reflects the power of unconstrained placement. Distinct from Switch Files (swaps two of your pieces, both must exist) and Extract (swaps with an enemy piece). The upgrade allowing King teleportation is a potent escape hatch from checkmate setups.
