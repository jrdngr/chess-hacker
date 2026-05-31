# CH-023: every-n-turns test gap and tautological skirmish assertions

- **Category:** Tests — Validity
- **Severity:** low
- **Status:** Done

## Resolution

every-n-turns: added non-multiple turns above N (5,6,7,9,10,11) to the
non-firing assertions, so a "fires every turn >= N" regression is now caught.
Skirmish: the offer test now asserts against independent literals (3 choices,
5 skip gold) instead of the constants used to build the offer, and separately
pins the constants to those literals so an intentional change surfaces here.

## Locations

- `src/game/status/dispatch.test.ts:77-102`
- `src/game/progression/skirmish.test.ts:73-78`

## Problem

The `every-n-turns` dispatch test never checks a non-multiple turn > N (e.g. 5,6,7), so a "fires every turn ≥ N" bug would pass. The skirmish offer assertions compare runtime output to the same exported constants used to build it (tautological).

## Recommendation

Add a non-multiple turn assertion to the every-n-turns test; assert skirmish offers against independent expected values, not the constants that generated them.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
