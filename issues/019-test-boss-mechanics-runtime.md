# CH-019: Boss in-match mechanics (void squares, capture-energy) validated only statically

- **Category:** Tests — Coverage
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/bosses/library.test.ts:6-58`
- `src/game/bosses/library.ts:1-40`

## Problem

The boss library test is shape-only (valid notation, recognized modifier kinds). Two runtime mechanics genuinely lack any behavioral test: void squares destroying pieces (logic only in useCardPlay.ts:261-268 / useAiLoop.ts:246-250) and the captures-grant-captured-energy modifier (useAiLoop.ts:262 / match.ts:354), both living in untested UI hooks. (Note: hazard-wall persistence and the status-effect curse schedule ARE tested.)

## Recommendation

Add behavior tests for void-square destruction and the capture-energy modifier specifically.

## Related Issues

- CH-012 — [test-useailoop-boss-branches](012-test-useailoop-boss-branches.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
