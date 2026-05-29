# CH-022: dispatch test "on-self-pawn-move only fires for pawn-move events" tests the opposite

- **Category:** Tests — Validity
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/status/dispatch.test.ts:146-163`

## Problem

No shipped def uses `on-self-pawn-move`. The test attaches a `throttled` (`on-self-check`) status and asserts it does NOT fire on a pawn-move — zero positive coverage of the named trigger.

## Recommendation

Construct a synthetic def with `on-self-pawn-move` and assert it fires, or rename the test to describe what it actually checks.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
