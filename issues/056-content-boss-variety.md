# CH-056: Only 3 fixed bosses, one per act, with no archetype variety

- **Category:** Game Design — Content
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/bosses/library.ts`
- `docs/design/bosses.md`

## Problem

Only 3 fixed bosses, one per act, no archetype variety (no tempo/spatial/debuff/swarm boss).

## Recommendation

Add bosses covering missing archetypes, and consider a small per-act pool so runs vary.

## Proposed Content

Proposed bosses — The Cartographer (Act-2 7x7 spatial boss: no player Sanctuaries, maze of 6 indestructible walls + 2 pushback squares, every 3 turns place a new wall on a random player square); The Overseer (player-side debuff boss: hand size −1, center zone-buff grants boss +1 energy, turn-start Disarm a random player non-pawn).

## Related Issues

- CH-051 — [content-square-effect-cards](051-content-square-effect-cards.md)
- CH-050 — [content-player-status-cards](050-content-player-status-cards.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
