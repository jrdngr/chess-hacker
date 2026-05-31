# CH-022: dispatch test "on-self-pawn-move only fires for pawn-move events" tests the opposite

- **Category:** Tests — Validity
- **Severity:** low
- **Status:** Done

## Resolution

Added positive coverage for `on-self-pawn-move`: a delegating `vi.mock` of
`./library` injects a synthetic `pawn-pinger` def (trigger `on-self-pawn-move`,
all other ids fall through to the real library). Tests now assert the trigger
fires on a self pawn-move and does NOT fire on a non-pawn-move (check). The
original (oppositely-named) assertion was kept and renamed to "a non-pawn-move
status (on-self-check) does not fire on a pawn-move event".

## Locations

- `src/game/status/dispatch.test.ts:146-163`

## Problem

No shipped def uses `on-self-pawn-move`. The test attaches a `throttled` (`on-self-check`) status and asserts it does NOT fire on a pawn-move — zero positive coverage of the named trigger.

## Recommendation

Construct a synthetic def with `on-self-pawn-move` and assert it fires, or rename the test to describe what it actually checks.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
