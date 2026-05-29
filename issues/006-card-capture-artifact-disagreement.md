# CH-006: Card-destroyed enemy pieces don't fire on-capture artifacts

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Open

## Locations

- `src/components/Match/sideEffects.ts:167-169`
- `src/components/Match/sideEffects.ts:268-271`
- `src/components/Match/useCardPlay.ts:298-303`

## Problem

Card-destroyed enemy pieces increment `playerCaptureCount` (e.g. Heartbleed) but do NOT fire draw-on-capture/energy-on-capture artifacts, which only trigger on chess-move captures. The two "on capture" systems disagree about what counts as a capture, which is surprising for players building a capture-payoff deck.

## Recommendation

Decide whether card-destruction counts as a capture for artifact triggers and unify both paths behind a single helper.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
