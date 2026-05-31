# CH-018: targeting.ts (computeValidTargetSquares / computeBoardMode) is pure but untested

- **Category:** Tests — Coverage
- **Severity:** medium
- **Status:** Done

## Resolution

Added `targeting.test.ts` against a mixed fixture position: covers the
piece-target families (enemy/enemy-non-king with attacked-by filter, own/
own-non-king, own-pawn, enemy-minor, own-promotable, two-enemy with partial
exclusion) and the square/spatial families (empty-square + walls, square allows
occupied, empty-square-own-half restriction, adjacent-empty bounds/walls). Also
covers `computeBoardMode` for play / drop-anywhere / target modes.

## Locations

- `src/components/Match/targeting.ts:6`
- `src/components/Match/targeting.ts:241`

## Problem

Two React-free pure functions drive every card-targeting click (~20 target-kind branches with wall/own-half/adjacency/attacked-by filters), with no direct tests; only a few high-traffic branches are touched indirectly via `Match.test.tsx`. Incorrect target computation would let players target illegal squares or block legal ones.

## Recommendation

Add `targeting.test.ts` covering each target-kind family against a fixture position, and `computeBoardMode` for move / card-targeting / display-only states.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
