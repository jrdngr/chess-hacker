# CH-023: every-n-turns test gap and tautological skirmish assertions

- **Category:** Tests — Validity
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/status/dispatch.test.ts:77-102`
- `src/game/progression/skirmish.test.ts:73-78`

## Problem

The `every-n-turns` dispatch test never checks a non-multiple turn > N (e.g. 5,6,7), so a "fires every turn ≥ N" bug would pass. The skirmish offer assertions compare runtime output to the same exported constants used to build it (tautological).

## Recommendation

Add a non-multiple turn assertion to the every-n-turns test; assert skirmish offers against independent expected values, not the constants that generated them.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
