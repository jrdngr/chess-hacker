# CH-014: sacrifice-detonate core effect (adjacent-enemy destruction + drawCount) is untested

- **Category:** Tests — Validity
- **Severity:** high
- **Status:** Open

## Locations

- `src/game/cards/effectHandlers.ts:544-562`
- `src/game/cards/match.test.ts:191-216,405-437`

## Problem

Self Destruct's entire purpose is the 8-neighbor detonation loop and (upgraded) drawing. Both Self Destruct tests place only an isolated own pawn — no adjacent enemy — and neither uses the upgraded variant. The opponent-filter branch and the `drawCount` branch never execute. A regression breaking adjacency targeting (wrong bounds, including own pieces, removing the king) or the upgrade draw would pass green.

## Recommendation

Add a test sacrificing a piece with multiple adjacent enemies (including an adjacent king to confirm it is spared, and a board edge to confirm bounds) asserting the full remove-piece set; add an upgraded-variant test asserting hand grows by 2.

## Related Issues

- CH-013 — [test-self-destruct-noop](013-test-self-destruct-noop.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
