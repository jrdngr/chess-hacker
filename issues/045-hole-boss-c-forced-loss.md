# CH-045: Boss C can create an unmitigated forced loss with no concede valve

- **Category:** Game Design — Design Hole
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/bosses/data/the-singularity.json`
- `docs/design/chess-rules.md:8-15,91`

## Problem

Boss C no-promotion + all-pawns endgame + draws=loss = unmitigated forced loss with no concede valve. The player can reach a position with no legal path to victory and no way out.

## Recommendation

Add a concede/restart valve, relax draws=loss for this boss, or provide a card-based win override (see proposed Kernel Panic).

## Related Issues

- CH-046 — [hole-no-clock-deadturn](046-hole-no-clock-deadturn.md)
- CH-059 — [content-counterplay-boss-c](059-content-counterplay-boss-c.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
