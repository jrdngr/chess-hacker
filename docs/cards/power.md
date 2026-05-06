# Power cards

Slay-the-Spire-style match-scoped passives. A Power is played once, **consumed** from the deck for the rest of the match, and grants a persistent effect that fires at the start of every subsequent player turn until the match ends. Powers do **not** carry across matches — a fresh `MatchCardState` is created at the next match start, and the player must re-acquire and re-play the Power to benefit again.

All Powers cost **4** — the cost cap. Cache Warmup the prior turn (or the boss-reward "+1 energy/turn" boon) is the natural way to play one without giving up a turn's worth of utility.

See [`keywords.md`](keywords.md) for keyword definitions.

## Pawn Storm Power

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. At the start of each of your turns, your pawns gain Haste until end of turn.
- **Design note:** Pawn-swarm payoff. Every player pawn on the board enters the turn with the Haste status (move twice, no captures), so a long pawn front becomes a hard wall to break. Combos with the Pawn Storm artifact (any-rank double-push), Promotion Engine (rank-7 promotion), and Vanguard / Blitz on the same turn.

## Garrison Mode

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. At the start of each of your turns, your pieces on rank 1 (except the king) are shielded until your next turn.
- **Design note:** Defensive Power restricted to the back rank, **king excluded**. Castling pieces get a permanent insurance policy as long as the Power is active; the king itself is still capturable so checkmate remains possible. Skips a piece on rank 1 only if it's the king — a rook, knight, or bishop sitting on rank 1 is shielded every turn.

## Why Powers are 4-cost

Powers are exponential: every turn after they land, they pay back roughly the equivalent of a 1-cost card (Haste application, persistent shield, etc.). Across a 12+ turn match, that compounds far past the 4-energy spend. Cost 4 reflects the immediate opportunity cost (a full turn's budget) and the upper bound of the post-banking economy. Cache Warmup is the explicit setup tool: turn N "Cache Warmup" → turn N+1 "Power" with 1 energy left over.

## Deferred Power: Tactical Override

A third Power — a free 1-square non-capture move per turn — was scoped during the power-curve overhaul but deferred. It needs a dedicated player-action mechanic (a per-turn 1-square king-step budget distinct from the existing `extra-chess-move-per-turn` budget, which counts whole moves). See `docs/roadmap/open-questions.md` if you pick it up.
