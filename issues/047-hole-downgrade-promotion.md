# CH-047: Downgrade + promotion interaction is unspecified

- **Category:** Game Design — Design Hole
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:582-585`
- `docs/cards/keywords.md:41-45`

## Problem

A downgraded piece reaching the far rank would promote via `addPawnMoves`. The interaction between Downgrade and promotion is unspecified in docs.

## Recommendation

Specify the intended behavior in keywords.md and add a test.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
