# CH-009: promotionRank opponent-side mirror formula is likely inverted (dead code)

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:64-75`
- `src/game/chess/rules.ts:150-154`

## Problem

The `promotionRank` opponent-side mirror formula `size.ranks - override` is likely inverted. Currently dead/unreachable, but it will misfire if a feature ever enables an opponent-side promotion-rank override.

## Recommendation

Verify the intended mirror (`size.ranks - override + 1`?) and add a unit test, or remove the dead branch until needed.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
