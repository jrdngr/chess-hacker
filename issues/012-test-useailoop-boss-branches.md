# CH-012: useAiLoop boss/Echo/void/fallback branches are untested

- **Category:** Tests — Coverage
- **Severity:** high
- **Status:** Open

## Locations

- `src/components/Match/useAiLoop.ts:206-306`
- `src/components/Match.test.tsx:193-302`

## Problem

The most consequential UI branching is uncovered: random-legal-move fallback on engine failure/malformed UCI (:206-213), Boss C void-square destruction + clearStatusesOn (:245-252), Boss B captures-grant-captured-energy queuing (:255-264), Git-Revert capturedPieces tracking on AI captures (:266-274), and the Echo loop that decrements `bossExtraMoves` and re-forces the opponent turn (:297-304). No test renders `<Match>` with an `activeBoss`. A regression in the Echo loop could infinite-loop the AI turn; a fallback regression could lock the game on "thinking…".

## Recommendation

Add tests via the injectable `createAi` param: empty-UCI → legal fallback; AI moves onto a void square → removed + statuses cleared; capture-energy modifier → `pendingPlayerEnergyOnTurnStart` increments; `bossExtraMoves>0` → turn forced back to opponent until the queue drains.

## Related Issues

- CH-019 — [test-boss-mechanics-runtime](019-test-boss-mechanics-runtime.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
