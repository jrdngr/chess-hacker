# CH-048: rollDistinct can emit non-distinct piece offers

- **Category:** Game Design — Design Hole
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/progression/skirmish.ts:113-134`

## Problem

`rollDistinct` can emit non-distinct piece offers because there is no exclusion between picks.

## Recommendation

Track already-picked offers and exclude them, or document that duplicates are intentional.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
