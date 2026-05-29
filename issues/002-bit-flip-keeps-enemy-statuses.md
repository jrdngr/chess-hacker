# CH-002: Bit Flip (convert-piece) keeps enemy-applied statuses on the converted piece

- **Category:** Code — Correctness
- **Severity:** medium
- **Status:** Open

## Locations

- `src/components/Match/sideEffects.ts:278-283`
- `src/game/cards/match.ts:997-1015`
- `src/game/cards/data/bit-flip.json`

## Problem

`convert-piece` does `removePiece` + `placePiece(side:"player")` but never calls `clearStatusesOn(fx.square)` — unlike sibling destructive handlers (`garbage-collect` at :273-274, `remove-random-own-minor` at :306-307). Status entries are keyed by square only (the `side` field is never consulted by `isFrozen`/`isRooted`/etc.), so a freeze/root applied to an enemy minor before Bit Flip persists and now suppresses the player's newly-acquired piece.

## Recommendation

Call `clearStatusesOn(next, fx.square)` after converting the piece. Add a test that converts a frozen enemy piece and asserts it is no longer frozen.

## Related Issues

- CH-001 — [ssh-tunnel-teleport-phantom](001-ssh-tunnel-teleport-phantom.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
