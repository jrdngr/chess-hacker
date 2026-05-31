# CH-013: "Self Destruct" test silently no-ops on its seed and never calls playCard

- **Category:** Tests — Validity
- **Severity:** high
- **Status:** Done

## Resolution

Both Self Destruct tests and the sibling Stack Trace test now force the card
into hand directly (single-card deck + explicit `st.hand`) and removed the
`if (idx === -1) return` escape hatch, so they always exercise `playCard` and
its assertions instead of silently no-opping on the seed.

## Locations

- `src/game/cards/match.test.ts:191-216`
- `src/game/cards/match.testHelpers.ts:11`

## Problem

The test shuffles an 8-card deck and does `findIndex(... "self-destruct")`. With `STARTING_HAND_SIZE=3` and `makeRng(9)`, the opening hand is `[firewall, firewall, firewall]` so `idx === -1`, and `startPlayerTurn` does not draw on turn 0→1. The test takes the early-return `if (idx === -1) { expect(...).toBe(true); return; }` and never calls `playCard`, never asserts the remove-piece side effect or energy/draw. It passes by asserting only that the card exists in the deck — a near-tautology.

## Recommendation

Force the card into hand (single-card deck or set `st.hand` directly) and remove the silent `if (idx === -1) return` escape hatch here and at the sibling lines 223 and 420.

## Related Issues

- CH-014 — [test-sacrifice-detonate-untested](014-test-sacrifice-detonate-untested.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
