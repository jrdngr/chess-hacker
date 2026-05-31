# CH-028: 3x3 king-adjacent enumeration is hand-rolled in multiple places

- **Category:** Refactor — Duplication
- **Severity:** low
- **Status:** Done

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

## Resolution

Added to `src/game/chess/coords.ts`: one exported `KING_OFFSETS` table (file-
major scan order, preserving the historical 3×3 enumeration order),
`withinBounds(size, file, rank)`, and `kingAdjacentSquares(center, size, {
includeCenter })`. Call sites now route through them:

- `effectHandlers.ts` `sacrifice-detonate` — the hand-rolled 3×3-minus-center
  loop → `kingAdjacentSquares(sq, { files, ranks })`.
- `targeting.ts` `own-piece-then-adjacent-empty` — same → `kingAdjacentSquares`.
- `effectHandlers.ts` `friendlySquaresInBlast` — local `kingSteps` table →
  the shared `KING_OFFSETS` (knight table left local; covered by CH-030).
- `zoneBuffs.ts` `regionSquares` — local `KING_RADIUS_OFFSETS` →
  `KING_OFFSETS`.
- `derivations.ts` `kingStepAdjacentSquares` — removed; mutex zones now call
  `kingAdjacentSquares(anchor, STANDARD_SIZE, { includeCenter: true })`, keeping
  the prior 8×8-frame behaviour (OverlaySets has no board-size hint; the rule
  layer filters off-board destinations).

`KING_OFFSETS` is deliberately ordered file-major (distinct from the rule
engine's orthogonal-before-diagonal move tables) so the Self-Destruct blast and
other order-sensitive callers keep their existing scan sequence.

## Related Issues

- CH-030 — [dup-misc-cleanup](030-dup-misc-cleanup.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
