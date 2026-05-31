# CH-008: outcome() reports stalemate (draw) for any king-less side with no moves

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Done

## Resolution

Fixed at the engine root: `outcome()` only reports stalemate when the side to
move actually has a king; a king-less side with no moves (both sides king-less,
e.g. the empty placement board) now returns `ongoing`. The Match.tsx
`placement.active` guard is retained because it still protects against
mid-placement king asymmetry (one side's king placed before the other's, which
reads as a king-capture); its comment was updated to say so.

## Locations

- `src/game/chess/engine.ts:436-465`
- `src/game/chess/rules.ts:505-509`
- `src/components/Match.tsx`

## Problem

`outcome()` reports stalemate for any king-less side with no moves, not just the empty placement board. Commit 94765ae worked around this in `Match.tsx` via a `placement.active` guard rather than fixing the engine, so the engine still returns a misleading result in other king-less situations.

## Recommendation

Fix the root cause in the engine: distinguish "no king on board" from genuine stalemate, and remove the UI-level workaround if possible.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
