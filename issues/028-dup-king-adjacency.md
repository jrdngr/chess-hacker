# CH-028: 3x3 king-adjacent enumeration is hand-rolled in multiple places

- **Category:** Refactor — Duplication
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/cards/effectHandlers.ts:546-557`
- `src/components/Match/targeting.ts:64-76`
- `src/game/cards/effectHandlers.ts:683-714`
- `src/game/overlays/zoneBuffs.ts:43-63`
- `src/components/Match/derivations.ts:97-111`

## Problem

The `for df in -1..1, for dr in -1..1, skip center, bounds-check, build square` pattern is copy-pasted (2 literal copies) and expressed as offset tables elsewhere. `derivations.ts` hardcodes 0..7/1..8 bounds while others read dynamic size, so on non-8x8 boards the overlay builder enumerates squares in a different frame than the rule/effect layers.

## Recommendation

Extract `kingAdjacentSquares(center, size)` + a `withinBounds` predicate; unify `KING_RADIUS_OFFSETS`/`kingSteps` into one exported table.

## Related Issues

- CH-030 — [dup-misc-cleanup](030-dup-misc-cleanup.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
