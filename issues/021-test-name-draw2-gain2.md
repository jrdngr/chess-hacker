# CH-021: Misleading test name "draw 2, gain 2 energy"

- **Category:** Tests — Validity
- **Severity:** low
- **Status:** Done

## Resolution

Renamed the test to "Self Destruct: base sacrifices own non-king piece (no
draw, no energy gain)", matching the base `sacrifice-detonate` behavior. The
`drawCount: 2` upgrade variant is covered by the new CH-014 tests.

## Locations

- `src/game/cards/match.test.ts:191`
- `src/game/cards/data/self-destruct.json:8-21`
- `src/game/cards/effectHandlers.ts:538-563`

## Problem

The base card is `sacrifice-detonate` with no energy gain; `drawCount:2` exists only on the upgrade. The test name describes a retired version. The assertions match real behavior, so no bug is hidden — purely a misleading name.

## Recommendation

Rename the test to reflect actual behavior.

## Related Issues

- CH-013 — [test-self-destruct-noop](013-test-self-destruct-noop.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
