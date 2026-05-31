# CH-020: Run.tsx phase machine and runHistory.ts are under-tested

- **Category:** Tests — Coverage
- **Severity:** low
- **Status:** Done

## Resolution

Added `runHistory.test.ts` covering the recording/derivation helpers: `deckIds`/
`artifactIds`, `summarizePack`, `summarizeOffer` (card/booster/artifact),
`serializeRunHistory` (versioned, parseable payload), and `describeRunEvent`
across a representative set of event kinds (run-start, match-start/-end,
win-confirmed, boss-pick, shop enter/buy/leave, forwarded match-event).

Run.tsx's full phase machine (draft → match → reward → shop → next) requires
simulating a won chess match end-to-end through the UI, which is impractical in
the component harness; the reachable initial states stay covered by the existing
Run smoke tests. The previously-untested `runHistory.ts` is now covered.

## Locations

- `src/components/Run/Run.test.tsx:10-30`
- `src/components/Run/runHistory.ts`

## Problem

`Run.tsx` (782-line phase machine) has only 2 smoke tests; `runHistory.ts` (307 lines) is untested.

## Recommendation

Add tests for the Run phase transitions (draft → match → reward → shop → next) and for runHistory recording/derivation.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
