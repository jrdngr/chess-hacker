# Power cards

Slay-the-Spire-style match-scoped passives. A Power is played once, **consumed** from the deck for the rest of the match, and grants a persistent effect that fires at the start of every subsequent player turn until the match ends. Powers do **not** carry across matches — a fresh `MatchCardState` is created at the next match start, and the player must re-acquire and re-play the Power to benefit again.

All three starter Powers cost **4** — the cost cap. Cache Warmup the prior turn (or the boss-reward "+1 energy/turn" boon) is the natural way to play one without giving up a turn's worth of utility.

See [`keywords.md`](keywords.md) for keyword definitions.

## Daemon Process

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. Gain +1 energy at the start of each of your turns for the rest of the match.
- **Design note:** A 4-energy spend that pays back 1 energy per turn. Two-Daemon stacks give +2/turn (each one is a separate entry on `MatchCardState.activePowers`). The +1 fires every start-of-turn alongside the per-turn baseline; like the boss-reward boon, it raises the floor rather than enabling a one-shot burst.

## tail -f

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. Draw 1 additional card at the start of each of your turns for the rest of the match.
- **Design note:** Powered by the same plumbing as the artifact `hand-size-bonus`: the start-of-turn refill target rises by 1, so the player auto-draws 6 instead of 5 going forward. Compounds with hand-size artifacts and zone-buffs.

## Fork Process

- **Cost:** 4
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. Take one additional chess move on each of your turns for the rest of the match.
- **Design note:** Mirrors the existing `bossExtraMoves` mechanism. After a successful player chess move, the engine checks `playerExtraMovesRemaining`; if positive it decrements and forces the turn back to the player rather than flipping to the AI. Two Forks give two extra moves per turn (3 total). Cards do **not** consume the move budget — only chess moves do.

## Why Powers are 4-cost

Powers are exponential: every turn after they land, they pay back roughly the equivalent of a 1-cost card (energy, draw, or move). Across a 12+ turn match, that compounds far past the 4-energy spend. Cost 4 reflects the immediate opportunity cost (a full turn's budget) and the upper bound of the post-banking economy. Cache Warmup is the explicit setup tool: turn N "Cache Warmup" → turn N+1 "Power" with 1 energy left over.
