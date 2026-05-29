# CH-017: Chess draw rules & special-move execution are under-tested

- **Category:** Tests — Coverage
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/chess/engine.ts:455-462`
- `src/game/chess/engine.test.ts:60-132`
- `src/game/chess/rules.test.ts:32`

## Problem

The engine detects fifty-move (:458-459), threefold (:461-462), and insufficient material, but tests cover only insufficient material. No test produces a 50-move or threefold draw. En passant is never tested for legality or execution (the only hit is a FEN round-trip). Promotion is tested only for auto-queen — no underpromotion, and no test that the Promotion-Engine rank override actually promotes when executed via `engine.move`.

## Recommendation

Add engine tests for: halfmove→100 draw, threefold repetition, EP enumeration+execution (removes the passed pawn), underpromotion to knight/rook, and override-rank promotion through `engine.move`.

## Related Issues

- CH-003 — [sanctuary-shield-en-passant](003-sanctuary-shield-en-passant.md)
- CH-009 — [promotion-rank-mirror-inverted](009-promotion-rank-mirror-inverted.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
