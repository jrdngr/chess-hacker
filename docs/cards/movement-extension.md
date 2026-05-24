# Movement-extension cards

Movement-extension cards give one of your pieces an additional movement pattern. They keep the piece's normal moveset and add a new option on top.

See [`keywords.md`](keywords.md) for keyword definitions, especially **Empower**.

## Sprint

- **Cost:** 2
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Give Haste to a friendly piece (it may move twice this turn; the first move cannot capture, the second may).
- **Design note:** First Haste card in the catalogue. The "first move can't capture" clause forces a reposition before the strike — Haste is move-then-capture, while Vanguard / Overclock allow either action in either slot.

## Vanguard

- **Cost:** 2
- **Rarity:** Common
- **Target:** own piece (must be a pawn)
- **Effect:** Target friendly **pawn** may take 2 actions this turn (moves and captures).
- **Design note:** Pawn-only Overclock at lower cost. Reuses the existing `lightning-piece` resolver with a piece-type filter so the pawn gets the same multi-action treatment Overclock grants any piece. Combos with Pawn Storm artifact (chained double-pushes) and Promotion Engine.

## Blitz

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** none
- **Effect:** All your pawns gain Haste for 3 turns.
- **Design note:** Multi-turn pawn-swarm payoff. The Haste status applied here lasts longer than Sprint's single-turn application; combos with Pawn Storm artifact, Promotion Engine, and the Garrison Mode Power for a sustained pawn assault.

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
