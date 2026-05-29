# CH-005: pending-energy-loss-on-no-capture ignores its validated amount and hardcodes a penalty of 1

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/cards/effectHandlers.ts:439-446`
- `src/game/cards/match.ts:351`
- `src/game/cards/cardValidator.ts:575-583`

## Problem

The handler validates and accepts an `amount` field but then applies a fixed penalty of 1 regardless. Any card tuned to a larger penalty silently behaves as 1.

## Recommendation

Use the validated `amount` in the penalty calculation, and add a test with `amount > 1`.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
